"""GridParley backend — FastAPI app with WebSocket replay + agent orchestration."""
from __future__ import annotations
import asyncio
import json
import os

from dotenv import load_dotenv
load_dotenv()  # read backend/.env if present (OPENROUTER_API_KEY, OPENROUTER_MODEL, DEMO_MODE)
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from grid_model import GridState, F_NOMINAL, F_CAUTION, step
from policy import JOB_MANIFEST, PROTECTED_LOADS, required_curtailment_mw, curtailment_trigger
from validator import validate_dc_proposal
from replay import demo_window_ticks
import scenarios.heat_dome as heat_dome


# === Run state ============================================================

@dataclass
class TranscriptMessage:
    sender: str            # "iso" | "dc" | "validator" | "system"
    kind: str              # "speech" | "tool_call" | "tool_result" | "narrate"
    text: str
    payload: dict = field(default_factory=dict)
    ts_local: str = ""


@dataclass
class RunState:
    mode: str = "idle"             # "idle" | "baseline" | "gridparley"
    scenario_tick: int = 0
    grid: GridState = field(default_factory=GridState)
    transcript: list[TranscriptMessage] = field(default_factory=list)
    finished: bool = False
    blackout_announced: bool = False
    # accumulated counters for the result panel:
    caution_ticks: int = 0          # ticks spent below 59.95 Hz
    brownout_ticks: int = 0         # ticks with blackout_severity > 0.3
    peak_severity: float = 0.0      # max blackout_severity seen
    final_committed_shed_mw: float = 0.0

    def to_dict(self) -> dict:
        g = self.grid
        # Compute counterfactual result: what GridParley saved (or would have saved) vs baseline.
        # Approximations rooted in publicly cited numbers:
        #   - shed MWh = committed_shed_mw × 0.5 hour
        #   - avoided brownout customers ≈ 4200 MW residential / 3 kW per home = ~1.4M homes total in
        #     metro Boston; assume 5% would have been UFLS'd in a sustained excursion
        #   - dollar impact: $150 per customer-hour blackout (Hashemian/EPRI lit, conservative)
        #   - carbon: gas peaker ~430 kg CO2/MWh; 110 MWh shed avoids spinning a peaker for 0.5h
        shed_mwh = g.committed_shed_mw * 0.5
        if self.mode == "gridparley" and g.committed_shed_mw > 0:
            avoided_customers = 70_000   # 5% of metro Boston
            avoided_minutes = 30
            avoided_dollars = int(avoided_customers * (avoided_minutes / 60.0) * 150)
            avoided_co2_tons = round(shed_mwh * 0.43, 1)
        else:
            avoided_customers = 0
            avoided_minutes = 0
            avoided_dollars = 0
            avoided_co2_tons = 0
        result = {
            "shed_mw": round(g.committed_shed_mw, 0),
            "shed_mwh": round(shed_mwh, 1),
            "caution_ticks": self.caution_ticks,
            "caution_min_sim": self.caution_ticks * 5,
            "brownout_ticks": self.brownout_ticks,
            "peak_severity": round(self.peak_severity, 2),
            "avoided_customers": avoided_customers,
            "avoided_brownout_min": avoided_minutes,
            "avoided_dollars": avoided_dollars,
            "avoided_co2_tons": avoided_co2_tons,
        }
        return {
            "mode": self.mode,
            "scenario_tick": self.scenario_tick,
            "result": result,
            "grid": {
                "tick": g.tick,
                "ts_local": g.ts_local,
                "frequency_hz": round(g.frequency_hz, 4),
                "base_demand_mw": round(g.base_demand_mw, 1),
                "dc_load_mw": round(g.dc_load_mw, 1),
                "committed_shed_mw": round(g.committed_shed_mw, 1),
                "total_load_mw": round(g.total_load_mw, 1),
                "gen_capacity_mw": round(g.gen_capacity_mw, 1),
                "gen_tripped_mw": round(g.gen_tripped_mw, 1),
                "gen_available_mw": round(g.gen_available_mw, 1),
                "p_gen_eff_mw": round(g.p_gen_eff_mw, 1),
                "reserve_margin_pct": round(g.reserve_margin_pct, 2),
                "blackout": g.blackout,
                "blackout_severity": round(g.blackout_severity, 2),
                "f_caution": F_CAUTION,
                "f_nominal": F_NOMINAL,
            },
            "transcript": [asdict(m) for m in self.transcript],
            "finished": self.finished,
            "protected_loads": [
                {"id": p.id, "name": p.name, "priority": p.priority, "mw": p.mw, "inviolable": p.inviolable}
                for p in PROTECTED_LOADS
            ],
            "job_manifest": [
                {"id": j.id, "name": j.name, "mw": j.mw, "restart_minutes": j.restart_minutes,
                 "marginal_cost_per_mwh": j.marginal_cost_per_mwh, "is_priority_load": j.is_priority_load}
                for j in JOB_MANIFEST
            ],
        }


_run_state: RunState = RunState()
_run_lock = asyncio.Lock()
_subscribers: list[asyncio.Queue] = []


async def broadcast(state_dict: dict) -> None:
    payload = json.dumps({"type": "state", "data": state_dict})
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


# === Scenario runner ======================================================

async def run_scenario(mode: str) -> None:
    """Drive the demo window forward one tick per second of wall time.
    mode = 'baseline' (no agents) | 'gridparley' (with agent negotiation).
    """
    from agents.orchestrator import run_negotiation  # lazy to allow no-API-key runs

    global _run_state
    async with _run_lock:
        _run_state = RunState(mode=mode)
    ticks = demo_window_ticks()
    if not ticks:
        return
    rs = _run_state
    rs.grid.dc_load_mw = heat_dome.DC_LOAD_MW

    for i, t in enumerate(ticks):
        rs.scenario_tick = i
        rs.grid.tick = t["tick"]
        rs.grid.ts_local = t["ts_local"]
        rs.grid.base_demand_mw = float(t["demand_mw"])

        # apply scenario events at this tick
        for ev in heat_dome.find_events(i):
            if ev.kind == "gen_trip":
                rs.grid.gen_tripped_mw = ev.payload["mw"]
            elif ev.kind == "narrate":
                rs.transcript.append(TranscriptMessage(
                    sender="system", kind="narrate",
                    text=ev.payload["text"], ts_local=rs.grid.ts_local,
                ))
            elif ev.kind == "arm_agents" and mode == "gridparley":
                rs.grid.curtailment_armed = True
                # run the negotiation BLOCKING the tick loop briefly so the audience can read it
                await broadcast(rs.to_dict())
                await run_negotiation(rs, broadcast)

        # advance physics
        step(rs.grid)

        # accumulate counters
        if rs.grid.frequency_hz < 59.95:
            rs.caution_ticks += 1
        if rs.grid.blackout_severity > 0.3:
            rs.brownout_ticks += 1
        if rs.grid.blackout_severity > rs.peak_severity:
            rs.peak_severity = rs.grid.blackout_severity

        # broadcast post-step
        await broadcast(rs.to_dict())
        await asyncio.sleep(1.0)

    rs.finished = True
    await broadcast(rs.to_dict())


# === FastAPI app ==========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(lifespan=lifespan, title="GridParley")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "ok": True,
        "openrouter_key": bool(os.getenv("OPENROUTER_API_KEY")),
        "demo_mode": os.getenv("DEMO_MODE", "live"),
        "model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5"),
    }


@app.get("/state")
async def get_state():
    return _run_state.to_dict()


@app.post("/run/{mode}")
async def run(mode: str):
    if mode not in ("baseline", "gridparley"):
        return {"error": f"unknown mode {mode}"}
    asyncio.create_task(run_scenario(mode))
    return {"started": mode}


@app.post("/reset")
async def reset():
    global _run_state
    _run_state = RunState()
    await broadcast(_run_state.to_dict())
    return {"ok": True}


@app.websocket("/ws")
async def ws(ws: WebSocket):
    await ws.accept()
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=128)
    _subscribers.append(q)
    try:
        # send initial state
        await ws.send_text(json.dumps({"type": "state", "data": _run_state.to_dict()}))
        while True:
            msg = await q.get()
            await ws.send_text(msg)
    except WebSocketDisconnect:
        pass
    finally:
        if q in _subscribers:
            _subscribers.remove(q)
