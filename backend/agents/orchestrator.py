"""Negotiation orchestrator.

Two paths:
  • LIVE: OpenRouter-hosted LLM (default Claude Sonnet) drives a multi-turn
    negotiation through OpenAI-compatible function calling. Validator gates
    every tool call.
  • REPLAY: deterministic canned arc (fallback if no key, error, or
    `DEMO_MODE=replay`).

Both paths produce identical user-visible state — same transcript shape,
same final committed_shed_mw — so the demo always works.
"""
from __future__ import annotations
import asyncio
import json
import os
from typing import Awaitable, Callable

from policy import JOB_MANIFEST, required_curtailment_mw
from validator import validate_dc_proposal
from agents.tools import ISO_TOOLS, DC_TOOLS
from agents.iso_agent import ISO_SYSTEM_PROMPT
from agents.dc_agent import DC_SYSTEM_PROMPT, fleet_manifest_view

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.5")
APP_REFERER = "https://github.com/jg435/Team-GridView"
APP_TITLE = "GridParley - SCSP Hackathon 2026"


async def run_negotiation(rs, broadcast: Callable[[dict], Awaitable[None]]) -> None:
    """Entry point called by app.run_scenario at the arm_agents tick."""
    use_canned = (
        os.getenv("DEMO_MODE", "").lower() == "replay"
        or not os.getenv("OPENROUTER_API_KEY")
    )
    if use_canned:
        return await _run_canned(rs, broadcast)
    try:
        await _run_live(rs, broadcast)
    except Exception as e:
        await _emit(rs, broadcast, "system", "narrate",
                    f"⚠ Live agent loop error: {type(e).__name__}: {e}. Falling back to canned demo arc.")
        await _run_canned(rs, broadcast)


# ---------- shared emit helper ----------

async def _emit(rs, broadcast, sender: str, kind: str, text: str, payload: dict | None = None):
    from app import TranscriptMessage
    rs.transcript.append(TranscriptMessage(
        sender=sender, kind=kind, text=text,
        payload=payload or {}, ts_local=rs.grid.ts_local,
    ))
    await broadcast(rs.to_dict())
    await asyncio.sleep(0.6)


# ---------- LIVE path: OpenRouter-hosted LLM ----------

def _make_client():
    from openai import AsyncOpenAI
    return AsyncOpenAI(
        api_key=os.environ["OPENROUTER_API_KEY"],
        base_url=OPENROUTER_BASE_URL,
        default_headers={
            "HTTP-Referer": APP_REFERER,
            "X-Title": APP_TITLE,
        },
    )


def _first_tool_call(message, name: str):
    for tc in (message.tool_calls or []):
        if tc.function.name == name:
            return tc
    return None


def _parse_args(tc) -> dict:
    try:
        return json.loads(tc.function.arguments)
    except json.JSONDecodeError:
        return {}


async def _run_live(rs, broadcast):
    client = _make_client()

    g = rs.grid
    requested = max(200, int(required_curtailment_mw(g.frequency_hz, g.reserve_margin_pct)))
    if requested < 50:
        requested = 240

    # === Turn 1: ISO request_curtailment ===
    iso_user = (
        f"Current grid telemetry:\n"
        f"  ts: {g.ts_local}\n"
        f"  frequency: {g.frequency_hz:.4f} Hz\n"
        f"  reserve_margin: {g.reserve_margin_pct:.2f} %\n"
        f"  base_demand: {g.base_demand_mw:.0f} MW\n"
        f"  data_center_load: {g.dc_load_mw:.0f} MW\n"
        f"  generation_tripped: {g.gen_tripped_mw:.0f} MW\n"
        f"\nA generator just tripped. Issue a `request_curtailment` tool call. "
        f"Need at least {requested} MW shed within 90 seconds."
    )
    iso_resp = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        max_tokens=512,
        temperature=0,
        tools=ISO_TOOLS,
        tool_choice={"type": "function", "function": {"name": "request_curtailment"}},
        messages=[
            {"role": "system", "content": ISO_SYSTEM_PROMPT},
            {"role": "user", "content": iso_user},
        ],
    )
    iso_msg = iso_resp.choices[0].message
    req_tc = _first_tool_call(iso_msg, "request_curtailment")
    if req_tc is None:
        raise RuntimeError("ISO did not call request_curtailment")
    req_args = _parse_args(req_tc)
    requested_mw = int(req_args.get("mw_required", requested))
    deadline_s = int(req_args.get("deadline_seconds", 90))
    iso_reason = str(req_args.get("reason", ""))
    await _emit(rs, broadcast, "iso", "speech",
                iso_reason or f"Request {requested_mw} MW shed within {deadline_s}s.",
                {"mw_required": requested_mw, "deadline_s": deadline_s})

    # === Turn 2: DC propose_shed (likely BAD bid) ===
    manifest_json = json.dumps(fleet_manifest_view(), indent=2)
    dc_messages = [
        {"role": "system", "content": DC_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"Your fleet manifest (sheddable workloads):\n```json\n{manifest_json}\n```\n\n"
            f"ISO-NE just requested {requested_mw} MW shed within {deadline_s}s. "
            f"Reason: {iso_reason!r}.\n"
            f"Call `propose_shed` with the cheapest, fastest-restart combination that "
            f"meets the request."
        )},
    ]
    dc_resp = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        max_tokens=512,
        temperature=0,
        tools=DC_TOOLS,
        tool_choice={"type": "function", "function": {"name": "propose_shed"}},
        messages=dc_messages,
    )
    dc_msg = dc_resp.choices[0].message
    propose_tc = _first_tool_call(dc_msg, "propose_shed")
    if propose_tc is None:
        raise RuntimeError("DC did not call propose_shed")
    p_args = _parse_args(propose_tc)
    paused_ids = list(p_args.get("paused_job_ids", []))
    total = int(p_args.get("total_shed_mw", 0))
    notes = str(p_args.get("notes", ""))
    await _emit(rs, broadcast, "dc", "tool_call",
                notes or f"Proposing {total} MW from {len(paused_ids)} workloads.",
                {"paused_job_ids": paused_ids, "total_shed_mw": total,
                 "marginal_cost_per_mwh": p_args.get("marginal_cost_per_mwh"),
                 "restart_minutes": p_args.get("restart_minutes")})

    # Validator gate
    result = validate_dc_proposal(paused_ids, total, requested_mw)
    await _emit(rs, broadcast, "validator", "tool_result", result.reason, result.to_tool_result())

    # If rejected, give DC one revision turn
    if not result.ok:
        dc_messages.extend([
            {
                "role": "assistant",
                "content": dc_msg.content,
                "tool_calls": [{
                    "id": propose_tc.id,
                    "type": "function",
                    "function": {"name": propose_tc.function.name, "arguments": propose_tc.function.arguments},
                }],
            },
            {
                "role": "tool",
                "tool_call_id": propose_tc.id,
                "content": json.dumps(result.to_tool_result()),
            },
            {"role": "user", "content": (
                "Validator rejected. Drop the flagged IDs and propose again with replacements "
                "from the training pool only. Call `propose_shed` again."
            )},
        ])
        dc_resp2 = await client.chat.completions.create(
            model=DEFAULT_MODEL,
            max_tokens=512,
            temperature=0,
            tools=DC_TOOLS,
            tool_choice={"type": "function", "function": {"name": "propose_shed"}},
            messages=dc_messages,
        )
        dc_msg2 = dc_resp2.choices[0].message
        propose_tc2 = _first_tool_call(dc_msg2, "propose_shed")
        if propose_tc2 is None:
            raise RuntimeError("DC failed to revise after validator reject")
        p2 = _parse_args(propose_tc2)
        paused_ids = list(p2.get("paused_job_ids", []))
        total = int(p2.get("total_shed_mw", 0))
        notes = str(p2.get("notes", ""))
        await _emit(rs, broadcast, "dc", "tool_call",
                    notes or f"Revised: {total} MW from {len(paused_ids)} workloads.",
                    {"paused_job_ids": paused_ids, "total_shed_mw": total})
        result = validate_dc_proposal(paused_ids, total, requested_mw)
        await _emit(rs, broadcast, "validator", "tool_result", result.reason, result.to_tool_result())
        if not result.ok:
            raise RuntimeError("Revision still invalid")

    # === Turn 3: ISO accept ===
    iso2_user = (
        f"Data center has committed: {total} MW shed via job IDs {paused_ids}. "
        f"Validator approved. Call `accept_proposal`."
    )
    iso_resp2 = await client.chat.completions.create(
        model=DEFAULT_MODEL,
        max_tokens=300,
        temperature=0,
        tools=ISO_TOOLS,
        tool_choice={"type": "function", "function": {"name": "accept_proposal"}},
        messages=[
            {"role": "system", "content": ISO_SYSTEM_PROMPT},
            {"role": "user", "content": iso2_user},
        ],
    )
    iso_msg2 = iso_resp2.choices[0].message
    accept_tc = _first_tool_call(iso_msg2, "accept_proposal")
    accept_args = _parse_args(accept_tc) if accept_tc else {}
    note = (
        accept_args.get("settlement_note")
        or f"Accepted: {total} MW × 30 min @ $180/MWh ≈ ${total*0.5*180:.0f}. Commit signed."
    )
    await _emit(rs, broadcast, "iso", "speech", note, {"committed_mw": total})

    # Apply commitment to grid
    rs.grid.committed_shed_mw = float(total)
    await broadcast(rs.to_dict())


# ---------- REPLAY path: canned arc ----------

async def _run_canned(rs, broadcast):
    g = rs.grid
    requested = max(200, int(required_curtailment_mw(g.frequency_hz, g.reserve_margin_pct)))
    if requested < 50:
        requested = 240

    await _emit(rs, broadcast, "iso", "speech",
        f"Frequency excursion {g.frequency_hz:.3f} Hz, reserve {g.reserve_margin_pct:.1f}%. "
        f"Requesting {requested} MW shed within 90s. Priority loads must remain.",
        {"requested_mw": requested, "deadline_s": 90})

    bad_ids = ["batch_inference_pool", "llama_70b_finetune", "boston_childrens_ups", "llama_405b_run_a"]
    bad_total = sum(j.mw for j in JOB_MANIFEST if j.id in bad_ids)
    await _emit(rs, broadcast, "dc", "tool_call",
        f"Proposing {bad_total:.0f} MW shed from 4 workloads (lowest restart cost first): "
        f"batch inference, 70B fine-tune, colocation-2 SKU, and 405B run A.",
        {"paused_job_ids": bad_ids, "total_shed_mw": bad_total})

    result = validate_dc_proposal(bad_ids, bad_total, requested)
    await _emit(rs, broadcast, "validator", "tool_result", result.reason, result.to_tool_result())

    good_ids = ["batch_inference_pool", "llama_70b_finetune", "llama_405b_run_a", "llama_405b_run_b"]
    chosen, total = [], 0.0
    for jid in good_ids:
        j = next(j for j in JOB_MANIFEST if j.id == jid)
        chosen.append(jid); total += j.mw
        if total >= requested: break
    await _emit(rs, broadcast, "dc", "tool_call",
        f"Acknowledged. Revised: {total:.0f} MW training-pool only. "
        f"Pausing {len(chosen)} workloads. Hanscom, Mass General, Children's UPS untouched.",
        {"paused_job_ids": chosen, "total_shed_mw": total})

    result2 = validate_dc_proposal(chosen, total, requested)
    await _emit(rs, broadcast, "validator", "tool_result", result2.reason, result2.to_tool_result())

    await _emit(rs, broadcast, "iso", "speech",
        f"Accepted. Settlement: {total:.0f} MW × 30 min @ $180/MWh ≈ ${total*0.5*180:.0f}. "
        f"Commit signed, dispatching to SCADA.",
        {"committed_mw": total})

    rs.grid.committed_shed_mw = float(total)
    await broadcast(rs.to_dict())
