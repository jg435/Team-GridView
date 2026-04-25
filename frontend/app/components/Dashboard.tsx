"use client";
import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import type { AppState, TranscriptMessage } from "@/app/lib/types";

const BACKEND = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

const initialGrid: AppState["grid"] = {
  tick: 0, ts_local: "", frequency_hz: 60.0,
  base_demand_mw: 0, dc_load_mw: 0, committed_shed_mw: 0, total_load_mw: 0,
  gen_capacity_mw: 0, gen_tripped_mw: 0, gen_available_mw: 0, p_gen_eff_mw: 0,
  reserve_margin_pct: 0, blackout: false, blackout_severity: 0,
  f_caution: 59.95, f_nominal: 60.0,
};

const initialState: AppState = {
  mode: "idle", scenario_tick: 0, grid: initialGrid,
  transcript: [], finished: false, protected_loads: [], job_manifest: [],
};

interface ChartPoint {
  tick: number;
  ts: string;
  freq: number;
  demand: number;
  total: number;
}

export default function Dashboard() {
  const [state, setState] = useState<AppState>(initialState);
  const [series, setSeries] = useState<ChartPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const lastTickRef = useRef<number>(-1);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state") {
          const s: AppState = msg.data;
          setState(s);
          // Append a chart point only when scenario_tick advances
          if (s.scenario_tick !== lastTickRef.current && s.mode !== "idle") {
            lastTickRef.current = s.scenario_tick;
            setSeries((prev) => [
              ...prev,
              {
                tick: s.scenario_tick,
                ts: s.grid.ts_local,
                freq: s.grid.frequency_hz,
                demand: s.grid.base_demand_mw,
                total: s.grid.total_load_mw,
              },
            ]);
          }
        }
      } catch {}
    };
    ws.onclose = () => { wsRef.current = null; };
    return () => { ws.close(); };
  }, []);

  const trigger = async (path: "run/baseline" | "run/gridparley" | "reset") => {
    if (path === "reset") {
      setSeries([]); lastTickRef.current = -1;
    } else {
      setSeries([]); lastTickRef.current = -1;
    }
    await fetch(`${BACKEND}/${path}`, { method: "POST" }).catch(() => {});
  };

  const g = state.grid;
  const freqColor =
    g.frequency_hz < 59.5 ? "text-red-500"
      : g.frequency_hz < 59.95 ? "text-amber-400"
        : "text-emerald-400";
  const reserveColor =
    g.reserve_margin_pct < 5 ? "text-red-500"
      : g.reserve_margin_pct < 10 ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="text-sm uppercase tracking-widest text-zinc-500">ISO-NE Control · Demo</div>
          <h1 className="text-2xl font-semibold tracking-tight">
            GridParley <span className="text-zinc-500 font-normal">— Grid-Aware AI Agents</span>
          </h1>
        </div>
        <div className="flex gap-2 items-center">
          <ModeBadge mode={state.mode} finished={state.finished} />
          <button onClick={() => trigger("run/baseline")}
            disabled={state.mode !== "idle" && !state.finished}
            className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm font-medium disabled:opacity-40">
            Run Baseline
          </button>
          <button onClick={() => trigger("run/gridparley")}
            disabled={state.mode !== "idle" && !state.finished}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-40">
            Run with GridParley
          </button>
          <button onClick={() => trigger("reset")}
            className="px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm">
            Reset
          </button>
        </div>
      </header>

      {/* Top stats strip */}
      <div className="grid grid-cols-4 gap-px bg-zinc-800 border-b border-zinc-800 shrink-0">
        <Stat label="Frequency" value={`${g.frequency_hz.toFixed(3)} Hz`} sub={g.ts_local} valueClass={freqColor} />
        <Stat label="Reserve Margin" value={`${g.reserve_margin_pct.toFixed(1)} %`} sub={`Cap ${(g.gen_capacity_mw/1000).toFixed(1)} GW · Trip ${g.gen_tripped_mw.toFixed(0)} MW`} valueClass={reserveColor} />
        <Stat label="Base Demand" value={`${(g.base_demand_mw/1000).toFixed(2)} GW`} sub={`+ DC ${(g.dc_load_mw - g.committed_shed_mw).toFixed(0)} MW`} />
        <Stat label="Curtailed" value={`${g.committed_shed_mw.toFixed(0)} MW`} sub={state.mode === "gridparley" ? "GridParley active" : "—"} valueClass={g.committed_shed_mw > 0 ? "text-emerald-400" : "text-zinc-500"} />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-px bg-zinc-800 min-h-0">
        {/* Chart */}
        <section className="col-span-8 bg-zinc-950 p-4 flex flex-col min-h-0">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Grid State (Jun 20 2024 · ISO-NE replay)</div>
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="tick" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="freq" domain={[59.5, 60.2]} stroke="#fbbf24" tick={{ fontSize: 11 }} width={48} />
                <YAxis yAxisId="mw" orientation="right" stroke="#60a5fa" tick={{ fontSize: 11 }} width={64}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)}G`} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 4, fontSize: 12 }}
                  labelStyle={{ color: "#a1a1aa" }} />
                <ReferenceLine yAxisId="freq" y={60} stroke="#52525b" strokeDasharray="2 2" />
                <ReferenceLine yAxisId="freq" y={59.95} stroke="#f59e0b" strokeDasharray="2 2" label={{ value: "caution", fill: "#f59e0b", fontSize: 10, position: "insideRight" }} />
                <Line yAxisId="freq" type="monotone" dataKey="freq" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} name="Frequency (Hz)" />
                <Line yAxisId="mw" type="monotone" dataKey="demand" stroke="#60a5fa" strokeWidth={2} dot={false} isAnimationActive={false} name="Demand (MW)" />
                <Line yAxisId="mw" type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} name="Demand + DC (MW)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Right column: protected loads + job manifest */}
        <aside className="col-span-4 bg-zinc-950 p-4 overflow-auto min-h-0">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Protected Loads</div>
          <div className="grid grid-cols-1 gap-2 mb-6">
            {state.protected_loads.map((p) => (
              <div key={p.id}
                className={`rounded-md border p-3 ${
                  p.inviolable
                    ? "border-emerald-700/50 bg-emerald-900/10"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{p.name}</span>
                  <span className={p.inviolable ? "text-emerald-400" : "text-zinc-400"}>
                    {p.inviolable ? "● PROTECTED" : `P${p.priority}`}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">{p.mw.toFixed(0)} MW · Priority {p.priority}{p.inviolable ? " · Inviolable" : ""}</div>
              </div>
            ))}
          </div>
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Hyperscaler Job Manifest</div>
          <div className="space-y-1">
            {state.job_manifest.map((j) => (
              <div key={j.id}
                className={`rounded-sm px-2 py-1.5 text-xs flex justify-between items-center ${
                  j.is_priority_load ? "bg-red-950/40 border border-red-900/50" : "bg-zinc-900/40 border border-zinc-800"
                }`}>
                <span className="truncate pr-2">
                  {j.is_priority_load && "⚠ "}{j.name}
                </span>
                <span className="text-zinc-500 shrink-0">{j.mw.toFixed(0)}MW · {j.restart_minutes}m</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Transcript */}
      <section className="border-t border-zinc-800 bg-zinc-950 max-h-[34vh] overflow-auto shrink-0">
        <div className="px-6 py-2 text-xs uppercase tracking-widest text-zinc-500 sticky top-0 bg-zinc-950 border-b border-zinc-800">
          Negotiation Transcript {state.transcript.length > 0 && <span className="text-zinc-600 normal-case">· {state.transcript.length} messages</span>}
        </div>
        <div className="px-6 py-3 space-y-2">
          {state.transcript.length === 0 && (
            <div className="text-sm text-zinc-600">No traffic. Trigger a run to see the ISO ↔ DC ↔ Validator negotiation.</div>
          )}
          {state.transcript.map((m, i) => <TranscriptRow key={i} m={m} />)}
        </div>
      </section>
    </div>
  );
}

function ModeBadge({ mode, finished }: { mode: AppState["mode"]; finished: boolean }) {
  const label =
    mode === "idle" ? "IDLE"
      : mode === "baseline" ? (finished ? "BASELINE COMPLETE" : "BASELINE RUNNING")
        : (finished ? "GRIDPARLEY COMPLETE" : "GRIDPARLEY RUNNING");
  const cls =
    mode === "idle" ? "bg-zinc-800 text-zinc-400"
      : mode === "baseline" ? "bg-amber-900/40 text-amber-300 border border-amber-800/50"
        : "bg-emerald-900/40 text-emerald-300 border border-emerald-800/50";
  return <span className={`text-xs uppercase tracking-widest px-3 py-1.5 rounded-md ${cls}`}>{label}</span>;
}

function Stat({ label, value, sub, valueClass = "" }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-zinc-950 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`text-2xl font-mono font-semibold ${valueClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

function TranscriptRow({ m }: { m: TranscriptMessage }) {
  const senderStyles: Record<string, { label: string; bar: string; text: string; bg: string }> = {
    iso:       { label: "ISO-NE",   bar: "bg-blue-500",    text: "text-blue-300",    bg: "bg-blue-950/20 border-blue-900/40" },
    dc:        { label: "DC FLEET", bar: "bg-purple-500",  text: "text-purple-300",  bg: "bg-purple-950/20 border-purple-900/40" },
    validator: { label: "POLICY",   bar: "bg-rose-500",    text: "text-rose-300",    bg: "bg-rose-950/30 border-rose-800/60" },
    system:    { label: "SYSTEM",   bar: "bg-zinc-500",    text: "text-zinc-400",    bg: "bg-zinc-900/40 border-zinc-800" },
  };
  const s = senderStyles[m.sender] || senderStyles.system;
  const isReject = m.kind === "tool_result" && (m.payload as { status?: string })?.status === "rejected";
  return (
    <div className={`flex gap-3 rounded-md border ${s.bg} px-3 py-2`}>
      <div className={`w-1 rounded-sm ${isReject ? "bg-rose-500" : s.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-mono uppercase tracking-widest ${s.text}`}>
            {s.label}
            <span className="ml-2 text-zinc-600 normal-case">{m.kind}</span>
            {isReject && <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px]">REJECTED</span>}
          </span>
          <span className="text-zinc-600">{m.ts_local}</span>
        </div>
        <div className="text-sm text-zinc-200 leading-snug">{m.text}</div>
      </div>
    </div>
  );
}
