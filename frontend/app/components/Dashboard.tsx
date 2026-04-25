"use client";
import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ReferenceArea, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from "recharts";
import type { AppState, TranscriptMessage } from "@/app/lib/types";
import NewEnglandMap from "@/app/components/NewEnglandMap";

const BACKEND = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

const initialGrid: AppState["grid"] = {
  tick: 0, ts_local: "", frequency_hz: 60.0,
  base_demand_mw: 0, dc_load_mw: 0, committed_shed_mw: 0, total_load_mw: 0,
  gen_capacity_mw: 0, gen_tripped_mw: 0, gen_available_mw: 0, p_gen_eff_mw: 0,
  reserve_margin_pct: 0, blackout: false, blackout_severity: 0,
  f_caution: 59.95, f_nominal: 60.0,
};

const initialResult = {
  shed_mw: 0, shed_mwh: 0, caution_ticks: 0, caution_min_sim: 0,
  brownout_ticks: 0, peak_severity: 0,
  avoided_customers: 0, avoided_brownout_min: 0, avoided_dollars: 0, avoided_co2_tons: 0,
};

const initialState: AppState = {
  mode: "idle", data_source: "replay", scenario_tick: 0, grid: initialGrid,
  transcript: [], finished: false, protected_loads: [], job_manifest: [],
  result: initialResult, thinking: null, thinking_actor: null,
};

interface ChartPoint {
  tick: number;
  ts: string;
  freq: number;
  demand: number;       // base demand (residential + industrial)
  total: number;        // base + DC load (after curtailment)
  genAvailable: number; // gen capacity minus tripped
  forecast: number;     // EIA day-ahead demand forecast (real, from EIA-930)
}

export default function Dashboard() {
  const [state, setState] = useState<AppState>(initialState);
  const [series, setSeries] = useState<ChartPoint[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const lastTickRef = useRef<number>(-1);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [eiaKeyAvailable, setEiaKeyAvailable] = useState<boolean>(false);
  const [dataSource, setDataSource] = useState<"replay" | "live">("replay");
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      setWsStatus("connecting");
      ws.onopen = () => { setWsStatus("connected"); };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "state") {
            const s: AppState = msg.data;
            setState(s);
            // reset chart series on a fresh run (mode flips from idle, or tick rewinds)
            if (s.mode !== "idle" && s.scenario_tick === 0 && lastTickRef.current !== -1) {
              setSeries([]);
              lastTickRef.current = -1;
            }
            // append chart point only when scenario_tick advances
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
                  genAvailable: s.grid.gen_available_mw,
                  forecast: s.grid.demand_forecast_mw ?? s.grid.base_demand_mw,
                },
              ]);
            }
          }
        } catch {}
      };
      ws.onclose = () => {
        wsRef.current = null;
        setWsStatus("disconnected");
        if (!cancelled) {
          reconnectRef.current = setTimeout(connect, 1000);
        }
      };
      ws.onerror = () => {
        ws.close();
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Auto-scroll transcript to latest message
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.transcript.length, state.thinking]);

  // Probe backend for EIA key availability on mount
  useEffect(() => {
    fetch(`${BACKEND}/health`).then(r => r.json()).then(h => {
      setEiaKeyAvailable(!!h.eia_key);
    }).catch(() => {});
  }, []);

  const trigger = async (path: "run/baseline" | "run/gridparley" | "reset") => {
    setSeries([]); lastTickRef.current = -1;
    const url = path === "reset"
      ? `${BACKEND}/reset`
      : `${BACKEND}/${path}?source=${dataSource}`;
    await fetch(url, { method: "POST" }).catch(() => {});
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
            GridParley <span className="text-zinc-500 font-normal">— Grid-Aware AI Agents · Jun 20 2024 replay</span>
          </h1>
          <a
            href="https://github.com/jg435/Team-GridView/blob/main/backend/eval_results.json"
            target="_blank"
            rel="noopener"
            title="Click to view full eval artifact JSON on GitHub"
            className="inline-flex items-center gap-1.5 mt-1 text-[11px] uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Validator empirically tested · 50/50 priority-load violations caught · 0 false positives
          </a>
        </div>
        <div className="flex gap-2 items-center">
          <WsBadge status={wsStatus} />
          <DataSourceToggle
            value={dataSource}
            onChange={setDataSource}
            eiaKeyAvailable={eiaKeyAvailable}
            disabled={state.mode !== "idle" && !state.finished}
          />
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

      {/* Result banner — appears when scenario finishes */}
      {state.finished && state.mode !== "idle" && (
        <ResultBanner mode={state.mode} result={state.result} />
      )}

      {/* Brownout alert banner */}
      {g.blackout_severity > 0.3 && state.mode !== "idle" && (
        <div className={`shrink-0 px-6 py-2 text-center font-mono text-sm border-b border-rose-700 ${
          g.blackout_severity > 0.7 ? "bg-rose-700 text-white animate-pulse" : "bg-rose-900/60 text-rose-100"
        }`}>
          ⚠ BROWNOUT WARNING · Metro Boston residential zone · severity {(g.blackout_severity*100).toFixed(0)}%
          {state.mode === "baseline" && " · NO COORDINATION · curtailment unmet"}
        </div>
      )}

      {/* Top stats strip */}
      <div className="grid grid-cols-4 gap-px bg-zinc-800 border-b border-zinc-800 shrink-0">
        <Stat label="Frequency" value={`${g.frequency_hz.toFixed(3)} Hz`} sub={g.ts_local} valueClass={freqColor} />
        <Stat label="Capacity Headroom" value={`${g.reserve_margin_pct.toFixed(1)} %`} sub={`Gen cap ${(g.gen_capacity_mw/1000).toFixed(1)} GW · Trip ${g.gen_tripped_mw.toFixed(0)} MW · vs total load`} valueClass={reserveColor} />
        <Stat label="Base Demand" value={`${(g.base_demand_mw/1000).toFixed(2)} GW`} sub={`+ DC ${(g.dc_load_mw - g.committed_shed_mw).toFixed(0)} MW`} />
        <Stat label="Curtailed" value={`${g.committed_shed_mw.toFixed(0)} MW`} sub={state.mode === "gridparley" ? "GridParley active" : "—"} valueClass={g.committed_shed_mw > 0 ? "text-emerald-400" : "text-zinc-500"} />
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 gap-px bg-zinc-800 min-h-0">
        {/* Chart */}
        <section className="col-span-8 bg-zinc-950 p-4 flex flex-col min-h-0 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Grid State · Jun 20 2024 ISO-NE replay</div>
            <ChartLegend />
          </div>
          {state.mode === "idle" && series.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-zinc-900/95 border border-zinc-800 rounded-lg p-5 max-w-md shadow-2xl pointer-events-auto">
                <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">Scenario · Jun 20, 2024</div>
                <div className="text-base text-zinc-100 mb-3 leading-snug">
                  Eastern US heat dome. ISO-NE actually peaked at <strong className="text-amber-400">23,266 MW at 19:00 ET</strong> that day (real EIA-930 data). We layer an 800 MW AI training fleet on top. Then a 400 MW generator trips offline.
                </div>
                <div className="text-sm text-zinc-400 mb-4 leading-snug">
                  Two modes:
                </div>
                <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
                  <li><strong className="text-zinc-100">Run Baseline</strong> — no coordination. Frequency drops, brownout flashes.</li>
                  <li><strong className="text-emerald-400">Run with GridParley</strong> — two AIs negotiate, validator catches the bad bid, grid recovers.</li>
                </ol>
              </div>
            </div>
          )}
          <div className="flex-1 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="tick" stroke="#71717a" tick={{ fontSize: 11 }} label={{ value: "scenario tick (5 min sim per tick)", fill: "#52525b", fontSize: 10, position: "insideBottom", offset: -2 }} />
                <YAxis yAxisId="freq" domain={[59.5, 60.2]} stroke="#fbbf24" tick={{ fontSize: 11 }} width={56}
                  label={{ value: "Hz", angle: -90, fill: "#fbbf24", fontSize: 10, position: "insideLeft", offset: 8 }} />
                <YAxis yAxisId="mw" orientation="right" stroke="#60a5fa" tick={{ fontSize: 11 }} width={64}
                  domain={[10000, 28000]}
                  tickFormatter={(v) => `${(v/1000).toFixed(0)} GW`}
                  label={{ value: "MW", angle: 90, fill: "#60a5fa", fontSize: 10, position: "insideRight", offset: 8 }} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: 4, fontSize: 12 }}
                  labelStyle={{ color: "#a1a1aa" }}
                  formatter={(v: number, name: string) => name === "Frequency"
                    ? [`${v.toFixed(3)} Hz`, name]
                    : [`${v.toFixed(0)} MW`, name]} />
                <ReferenceLine yAxisId="freq" y={60} stroke="#52525b" strokeDasharray="2 2" label={{ value: "60 Hz nominal", fill: "#71717a", fontSize: 10, position: "insideTopRight" }} />
                <ReferenceLine yAxisId="freq" y={59.95} stroke="#f59e0b" strokeDasharray="2 2" label={{ value: "caution 59.95", fill: "#f59e0b", fontSize: 10, position: "insideBottomRight" }} />
                <ReferenceLine yAxisId="mw" x={18} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" label={{ value: "Mystic 8 trip · -400 MW", fill: "#ef4444", fontSize: 10, position: "insideTop" }} />
                <Line yAxisId="mw" type="stepAfter" dataKey="genAvailable" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} name="Gen available" />
                <Line yAxisId="mw" type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} name="Total load (incl DC)" />
                <Line yAxisId="mw" type="monotone" dataKey="demand" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} name="Base demand" />
                <Line yAxisId="mw" type="monotone" dataKey="forecast" stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 4" dot={false} isAnimationActive={false} name="EIA forecast" />
                <Line yAxisId="freq" type="monotone" dataKey="freq" stroke="#fbbf24" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Frequency" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 leading-tight">
            <strong className="text-amber-400">Frequency (yellow) is the grid&apos;s heartbeat.</strong> 60.00 Hz = healthy. Below <strong className="text-amber-400">59.95</strong> the ISO must intervene. Below <strong className="text-rose-400">59.50</strong> automatic load-shedding kicks in. Capacity headroom (top stat) is a separate slow-moving safety buffer — it stays high while frequency dips, because frequency tracks <em>instantaneous</em> generation-vs-load while headroom tracks <em>maximum</em> capacity-vs-load.
          </div>
        </section>

        {/* Right column: map + protected loads + job manifest */}
        <aside className="col-span-4 bg-zinc-950 p-4 overflow-auto min-h-0">
          <div className="mb-4">
            <NewEnglandMap />
          </div>
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
          {state.transcript.length === 0 && !state.thinking && (
            <div className="text-sm text-zinc-600">No traffic. Trigger a run to see the ISO ↔ DC ↔ Validator negotiation.</div>
          )}
          {state.transcript.map((m, i) => <TranscriptRow key={i} m={m} />)}
          {state.thinking && state.thinking_actor && (
            <ThinkingBubble actor={state.thinking_actor} text={state.thinking} />
          )}
          <div ref={transcriptEndRef} />
        </div>
      </section>
    </div>
  );
}

function ResultBanner({ mode, result }: { mode: AppState["mode"]; result: AppState["result"] }) {
  if (mode === "baseline") {
    return (
      <div className="shrink-0 bg-rose-950/60 border-b border-rose-800/60 px-6 py-3 grid grid-cols-4 gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-rose-300">Outcome</div>
          <div className="text-lg font-semibold text-rose-200">Brownout sustained</div>
          <div className="text-[11px] text-rose-300/80">No coordination layer, no curtailment.</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-rose-300">Caution-zone time</div>
          <div className="text-lg font-mono font-semibold text-rose-100">{result.caution_min_sim} min</div>
          <div className="text-[11px] text-rose-300/80">Frequency below 59.95 Hz</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-rose-300">Peak severity</div>
          <div className="text-lg font-mono font-semibold text-rose-100">{(result.peak_severity * 100).toFixed(0)}%</div>
          <div className="text-[11px] text-rose-300/80">Brownout intensity peak</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-rose-300">Customers at risk</div>
          <div className="text-lg font-mono font-semibold text-rose-100">~70 K</div>
          <div className="text-[11px] text-rose-300/80">Metro Boston residential UFLS zone</div>
        </div>
      </div>
    );
  }
  return (
    <div className="shrink-0 bg-emerald-950/50 border-b border-emerald-800/60 px-6 py-3 grid grid-cols-4 gap-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-300">Outcome</div>
        <div className="text-lg font-semibold text-emerald-200">Brownout averted</div>
        <div className="text-[11px] text-emerald-300/80">Frequency held; priority loads untouched.</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-300">Compute deferred</div>
        <div className="text-lg font-mono font-semibold text-emerald-100">{result.shed_mwh} MWh</div>
        <div className="text-[11px] text-emerald-300/80">{result.shed_mw.toFixed(0)} MW × 30 min · resumes after restart window</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-300">Avoided customer impact</div>
        <div className="text-lg font-mono font-semibold text-emerald-100">${(result.avoided_dollars/1000).toFixed(0)} K</div>
        <div className="text-[11px] text-emerald-300/80">~{(result.avoided_customers/1000).toFixed(0)} K customers · {result.avoided_brownout_min} min UFLS averted</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-300">Carbon avoided</div>
        <div className="text-lg font-mono font-semibold text-emerald-100">~{result.avoided_co2_tons} t CO₂</div>
        <div className="text-[11px] text-emerald-300/80">No gas peaker spin-up needed</div>
      </div>
    </div>
  );
}

function ChartLegend() {
  const items = [
    { color: "#10b981", label: "Gen available", shape: "line" },
    { color: "#a78bfa", label: "Total load", shape: "line" },
    { color: "#60a5fa", label: "Actual demand", shape: "dashed" },
    { color: "#94a3b8", label: "EIA forecast", shape: "dashed" },
    { color: "#fbbf24", label: "Frequency", shape: "line" },
  ];
  return (
    <div className="flex gap-3 text-[11px] text-zinc-400">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className={`inline-block w-3 h-0.5 ${it.shape === "dashed" ? "border-t border-dashed" : ""}`}
            style={{ background: it.shape === "line" ? it.color : undefined, borderColor: it.shape === "dashed" ? it.color : undefined }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function DataSourceToggle({
  value, onChange, eiaKeyAvailable, disabled,
}: {
  value: "replay" | "live";
  onChange: (v: "replay" | "live") => void;
  eiaKeyAvailable: boolean;
  disabled: boolean;
}) {
  const liveTitle = eiaKeyAvailable
    ? "Pull last 4 hours of real ISO-NE demand from EIA-930 API at run start."
    : "Set EIA_API_KEY in backend/.env to enable live data.";
  return (
    <div className={`flex rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden text-[10px] uppercase tracking-widest ${disabled ? "opacity-40" : ""}`}>
      <button
        onClick={() => onChange("replay")}
        disabled={disabled}
        className={`px-3 py-1.5 ${value === "replay" ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
        title="Replay Jun 2024 heat-dome day from bundled EIA-930 file."
      >
        Replay
      </button>
      <button
        onClick={() => onChange("live")}
        disabled={disabled || !eiaKeyAvailable}
        className={`px-3 py-1.5 flex items-center gap-1.5 ${value === "live" && eiaKeyAvailable ? "bg-emerald-700/60 text-emerald-100" : "text-zinc-500 hover:text-zinc-300"} ${!eiaKeyAvailable ? "cursor-not-allowed" : ""}`}
        title={liveTitle}
      >
        {value === "live" && eiaKeyAvailable && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
        Live
      </button>
    </div>
  );
}

function WsBadge({ status }: { status: "connecting" | "connected" | "disconnected" }) {
  if (status === "connected") {
    return (
      <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        live
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-amber-950/40 text-amber-400 border border-amber-900/40 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {status}
    </span>
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
    <div className={`flex gap-3 rounded-md border ${s.bg} px-3 py-2 ${isReject ? "ring-2 ring-rose-500/60 shadow-lg shadow-rose-500/20 animate-flashReject" : ""}`}>
      <div className={`w-1 rounded-sm ${isReject ? "bg-rose-500" : s.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`font-mono uppercase tracking-widest ${s.text}`}>
            {s.label}
            <span className="ml-2 text-zinc-600 normal-case">{m.kind}</span>
            {isReject && <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold animate-pulse">⚠ REJECTED</span>}
          </span>
          <span className="text-zinc-600">{m.ts_local}</span>
        </div>
        <div className={`text-sm leading-snug ${isReject ? "text-rose-100 font-medium" : "text-zinc-200"}`}>{m.text}</div>
      </div>
    </div>
  );
}

function ThinkingBubble({ actor, text }: { actor: "iso" | "dc" | "validator"; text: string }) {
  const styles: Record<string, { label: string; bar: string; text: string; bg: string }> = {
    iso:       { label: "ISO-NE",   bar: "bg-blue-500/60",   text: "text-blue-300/80",   bg: "bg-blue-950/10 border-blue-900/30 border-dashed" },
    dc:        { label: "DC FLEET", bar: "bg-purple-500/60", text: "text-purple-300/80", bg: "bg-purple-950/10 border-purple-900/30 border-dashed" },
    validator: { label: "POLICY",   bar: "bg-rose-500/60",   text: "text-rose-300/80",   bg: "bg-rose-950/10 border-rose-900/30 border-dashed" },
  };
  const s = styles[actor];
  return (
    <div className={`flex gap-3 rounded-md border ${s.bg} px-3 py-2 italic`}>
      <div className={`w-1 rounded-sm ${s.bar}`} />
      <div className="flex-1">
        <div className="flex items-center text-xs mb-1">
          <span className={`font-mono uppercase tracking-widest ${s.text}`}>{s.label}</span>
          <Dots />
        </div>
        <div className="text-sm text-zinc-400 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="ml-2 inline-flex gap-1">
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
