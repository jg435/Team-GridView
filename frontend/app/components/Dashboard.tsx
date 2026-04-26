"use client";
import { useEffect, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import type { AppState, ProtectedLoad, TranscriptMessage } from "@/app/lib/types";

const BACKEND = "http://localhost:8000";
const WS_URL = "ws://localhost:8000/ws";

const initialGrid: AppState["grid"] = {
  tick: 0, ts_local: "", frequency_hz: 60.0,
  base_demand_mw: 0, demand_forecast_mw: 0,
  dc_load_mw: 0, committed_shed_mw: 0, total_load_mw: 0,
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
  mode: "idle", scenario_tick: 0, grid: initialGrid,
  transcript: [], finished: false, protected_loads: [], job_manifest: [],
  result: initialResult, thinking: null, thinking_actor: null,
};

interface ChartPoint {
  tick: number;
  freq: number;
  total: number;
  genAvailable: number;
  forecast: number;
}

type FreqStatus = "healthy" | "caution" | "danger";

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
            if (s.mode !== "idle" && s.scenario_tick === 0 && lastTickRef.current !== -1) {
              setSeries([]);
              lastTickRef.current = -1;
            }
            if (s.scenario_tick !== lastTickRef.current && s.mode !== "idle") {
              lastTickRef.current = s.scenario_tick;
              setSeries((prev) => [
                ...prev,
                {
                  tick: s.scenario_tick,
                  freq: s.grid.frequency_hz,
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
      ws.onerror = () => { ws.close(); };
    };
    connect();
    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.transcript.length, state.thinking]);

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
  const baselineDone = state.mode === "baseline" && state.finished;
  const gridparleyDone = state.mode === "gridparley" && state.finished;

  const freqStatus: FreqStatus =
    g.frequency_hz < 59.5 ? "danger"
      : g.frequency_hz < 59.95 ? "caution"
        : "healthy";

  return (
    <div className="min-h-screen w-full bg-[#0d0c0a] text-stone-100 font-sans flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-stone-900 shrink-0">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-semibold tracking-tight text-stone-100">GridParley</span>
          <span className="text-[11px] text-stone-500 hidden sm:inline">grid-aware agent negotiation · ISO-NE</span>
        </div>
        <div className="flex items-center gap-3">
          <WsBadge status={wsStatus} />
          {state.mode !== "idle" && (
            <button onClick={() => trigger("reset")}
              className="text-[11px] uppercase tracking-widest text-stone-500 hover:text-stone-200 transition">
              reset
            </button>
          )}
        </div>
      </header>

      {state.mode === "idle" ? (
        <IdleHero
          dataSource={dataSource}
          onDataSourceChange={setDataSource}
          eiaKeyAvailable={eiaKeyAvailable}
          onStart={() => trigger("run/baseline")}
        />
      ) : (
        <>
          <HeroStrip
            freq={g.frequency_hz}
            freqStatus={freqStatus}
            headroomPct={g.reserve_margin_pct}
            dcLoadMw={g.dc_load_mw}
            shedMw={g.committed_shed_mw}
            ts={g.ts_local}
            mode={state.mode}
            finished={state.finished}
            protectedLoads={state.protected_loads}
          />
          {state.finished && <ResultRow mode={state.mode} result={state.result} />}
          {g.blackout_severity > 0.3 && !state.finished && (
            <BrownoutStrip severity={g.blackout_severity} mode={state.mode} />
          )}

          <div className="flex-1 grid grid-cols-12 min-h-0 border-t border-stone-900">
            <section className="col-span-7 p-5 min-h-0 flex flex-col border-r border-stone-900">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  grid trace · jun 20 2024 ISO-NE
                </div>
                <ChartLegend />
              </div>
              <div className="flex-1 min-h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="#1c1917" strokeDasharray="3 3" />
                    <XAxis dataKey="tick" stroke="#57534e" tick={{ fontSize: 11 }}
                      label={{ value: "scenario tick (5 min/tick)", fill: "#44403c", fontSize: 10, position: "insideBottom", offset: -2 }} />
                    <YAxis yAxisId="freq" domain={[59.5, 60.2]} stroke="#fbbf24" tick={{ fontSize: 11 }} width={56}
                      label={{ value: "Hz", angle: -90, fill: "#fbbf24", fontSize: 10, position: "insideLeft", offset: 8 }} />
                    <YAxis yAxisId="mw" orientation="right" stroke="#a78bfa" tick={{ fontSize: 11 }} width={64}
                      domain={[10000, 28000]}
                      tickFormatter={(v) => `${(v/1000).toFixed(0)} GW`}
                      label={{ value: "MW", angle: 90, fill: "#a78bfa", fontSize: 10, position: "insideRight", offset: 8 }} />
                    <Tooltip
                      contentStyle={{ background: "#0d0c0a", border: "1px solid #292524", borderRadius: 4, fontSize: 12 }}
                      labelStyle={{ color: "#a8a29e" }}
                      formatter={(v, name) => {
                        const n = typeof v === "number" ? v : Number(v);
                        return name === "Frequency"
                          ? [`${n.toFixed(3)} Hz`, name as string]
                          : [`${n.toFixed(0)} MW`, name as string];
                      }} />
                    <ReferenceLine yAxisId="freq" y={60} stroke="#44403c" strokeDasharray="2 2"
                      label={{ value: "60 Hz nominal", fill: "#57534e", fontSize: 10, position: "insideTopRight" }} />
                    <ReferenceLine yAxisId="freq" y={59.95} stroke="#f59e0b" strokeDasharray="2 2"
                      label={{ value: "caution 59.95", fill: "#f59e0b", fontSize: 10, position: "insideBottomRight" }} />
                    <ReferenceLine yAxisId="mw" x={18} stroke="#fb7185" strokeWidth={1.5} strokeDasharray="4 2"
                      label={{ value: "Mystic 8 trip · −400 MW", fill: "#fb7185", fontSize: 10, position: "insideTop" }} />
                    <Line yAxisId="mw" type="stepAfter" dataKey="genAvailable" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} name="Gen available" />
                    <Line yAxisId="mw" type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} name="Total load" />
                    <Line yAxisId="mw" type="monotone" dataKey="forecast" stroke="#78716c" strokeWidth={1} strokeDasharray="2 4" dot={false} isAnimationActive={false} name="EIA forecast" />
                    <Line yAxisId="freq" type="monotone" dataKey="freq" stroke="#fbbf24" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Frequency" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="col-span-5 flex flex-col min-h-0 bg-[#0a0908]">
              <div className="px-5 py-2 text-[10px] uppercase tracking-[0.18em] text-stone-500 border-b border-stone-900 flex items-center justify-between shrink-0">
                <span>negotiation transcript</span>
                {state.transcript.length > 0 && (
                  <span className="text-stone-600 normal-case tracking-normal">
                    {state.transcript.length} msgs
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-auto px-5 py-3 space-y-2">
                {state.transcript.length === 0 && !state.thinking && (
                  <div className="text-sm text-stone-600 italic">
                    {state.mode === "baseline"
                      ? "Baseline run — no agents talking. Watch the chart."
                      : "Waiting for ISO ↔ DC ↔ Validator to start…"}
                  </div>
                )}
                {state.transcript.map((m, i) => <TranscriptRow key={i} m={m} />)}
                {state.thinking && state.thinking_actor && (
                  <ThinkingBubble actor={state.thinking_actor} text={state.thinking} />
                )}
                <div ref={transcriptEndRef} />
              </div>

              {baselineDone && (
                <div className="border-t border-amber-900/40 bg-amber-950/20 p-4 shrink-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-amber-400 mb-2">same scenario · with coordination →</div>
                  <button onClick={() => trigger("run/gridparley")}
                    className="w-full px-4 py-3 rounded-md bg-amber-400 hover:bg-amber-300 text-stone-950 text-sm font-semibold transition shadow-lg shadow-amber-400/20">
                    Now run with GridParley
                  </button>
                </div>
              )}
              {gridparleyDone && (
                <div className="border-t border-stone-900 p-4 shrink-0">
                  <button onClick={() => trigger("reset")}
                    className="w-full px-4 py-3 rounded-md border border-stone-700 hover:border-stone-500 text-stone-300 text-sm font-medium transition">
                    Reset · run again
                  </button>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function IdleHero({
  dataSource, onDataSourceChange, eiaKeyAvailable, onStart,
}: {
  dataSource: "replay" | "live";
  onDataSourceChange: (v: "replay" | "live") => void;
  eiaKeyAvailable: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8 min-h-0">
      <div className="max-w-2xl w-full">
        <div className="text-[11px] uppercase tracking-[0.22em] text-amber-400 mb-3">
          Demo scenario · stress test
        </div>
        <h2 className="text-3xl font-medium leading-snug text-stone-100 mb-4">
          Eastern US heat dome, June 20 2024 — real ISO-NE grid conditions from EIA-930
          <span className="text-stone-500 font-normal"> (peak <span className="text-amber-300 font-semibold tabular-nums">23 GW</span>)</span>.
          We add a projected <span className="text-violet-300 font-semibold">800 MW AI training fleet</span>,
          then trip a <span className="text-rose-300 font-semibold">400 MW generator</span>.
        </h2>
        <p className="text-lg text-stone-300 mb-6 leading-relaxed">
          Watch what breaks — then watch GridParley negotiate the fix.
        </p>
        <p className="text-sm text-stone-500 italic mb-8 leading-relaxed">
          The fleet and the trip are projected — they didn&apos;t happen on Jun 20. The dynamics aren&apos;t projected: ERCOT manually curtailed crypto miners during Winter Storm Elliott. GridParley automates that pattern and adds priority awareness, so a validator catches <em>&ldquo;you just shed the hospital&rsquo;s UPS&rdquo;</em> before it happens.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button onClick={onStart}
            className="px-6 py-3 rounded-md bg-amber-400 hover:bg-amber-300 text-stone-950 text-base font-semibold transition shadow-lg shadow-amber-400/15">
            ▶ Run baseline · no coordination
          </button>
          <DataSourceToggle
            value={dataSource}
            onChange={onDataSourceChange}
            eiaKeyAvailable={eiaKeyAvailable}
            disabled={false}
          />
        </div>
        <div className="mt-10 pt-5 border-t border-stone-900">
          <a href="https://github.com/jg435/Team-GridView/blob/main/backend/eval_results.json"
             target="_blank" rel="noopener"
             className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-emerald-400 hover:text-emerald-300 transition">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Validator empirically tested · 50/50 caught · 0 false positives
          </a>
        </div>
      </div>
    </div>
  );
}

function HeroStrip({
  freq, freqStatus, headroomPct, dcLoadMw, shedMw, ts, mode, finished, protectedLoads,
}: {
  freq: number;
  freqStatus: FreqStatus;
  headroomPct: number;
  dcLoadMw: number;
  shedMw: number;
  ts: string;
  mode: AppState["mode"];
  finished: boolean;
  protectedLoads: ProtectedLoad[];
}) {
  const freqColor = freqStatus === "danger" ? "text-rose-400"
    : freqStatus === "caution" ? "text-amber-300"
      : "text-emerald-300";
  const headroomColor = headroomPct < 5 ? "text-rose-400"
    : headroomPct < 10 ? "text-amber-300"
      : "text-stone-100";
  const dcDrawing = Math.max(0, dcLoadMw - shedMw);
  return (
    <div className="px-6 py-4 grid grid-cols-12 gap-6 items-center border-b border-stone-900 shrink-0">
      <div className="col-span-12 md:col-span-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-1">grid frequency</div>
        <div className="flex items-baseline gap-2">
          <span className={`text-6xl font-semibold font-mono tabular-nums leading-none ${freqColor}`}>
            {freq.toFixed(3)}
          </span>
          <span className="text-xl text-stone-500 font-light">Hz</span>
          <FreqStatusPill status={freqStatus} />
        </div>
        <div className="text-[11px] text-stone-500 mt-2 font-mono">
          {ts || "—"} · target 60.000 · caution &lt;59.95 · UFLS &lt;59.50
        </div>
      </div>
      <div className="col-span-6 md:col-span-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-1">capacity headroom</div>
        <div className={`text-2xl font-semibold tabular-nums ${headroomColor}`}>
          {headroomPct.toFixed(1)}<span className="text-stone-500 text-sm font-normal ml-1">%</span>
        </div>
      </div>
      <div className="col-span-6 md:col-span-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-violet-400 mb-1">DC fleet</div>
        <div className="text-2xl font-semibold tabular-nums text-violet-200">
          {dcDrawing.toFixed(0)}<span className="text-stone-500 text-sm font-normal ml-1">MW</span>
        </div>
        <div className="text-[10px] text-stone-500 mt-0.5 font-mono">
          {dcLoadMw > 0 ? `of ${dcLoadMw.toFixed(0)} MW cap` : "—"}
        </div>
      </div>
      <div className="col-span-6 md:col-span-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-stone-500 mb-1">curtailed</div>
        <div className={`text-2xl font-semibold tabular-nums ${shedMw > 0 ? "text-amber-300" : "text-stone-500"}`}>
          {shedMw.toFixed(0)}<span className="text-stone-500 text-sm font-normal ml-1">MW</span>
        </div>
        <div className="text-[10px] text-stone-500 mt-0.5 font-mono">
          {mode === "gridparley" && shedMw > 0 ? "deferred · off-peak" : mode === "baseline" ? "no coordination" : "—"}
        </div>
      </div>
      <div className="col-span-6 md:col-span-2 flex flex-col items-stretch md:items-end gap-2">
        <ModeBadge mode={mode} finished={finished} />
        <ProtectedPills loads={protectedLoads} />
      </div>
    </div>
  );
}

function FreqStatusPill({ status }: { status: FreqStatus }) {
  const map = {
    healthy: { label: "healthy", cls: "bg-emerald-950/40 text-emerald-300 border-emerald-900/50" },
    caution: { label: "caution", cls: "bg-amber-950/40 text-amber-300 border-amber-900/50" },
    danger:  { label: "danger",  cls: "bg-rose-950/50 text-rose-300 border-rose-900/60 animate-pulse" },
  } as const;
  const m = map[status];
  return (
    <span className={`ml-2 text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${m.cls}`}>
      {m.label}
    </span>
  );
}

function ProtectedPills({ loads }: { loads: ProtectedLoad[] }) {
  const abbrev = (n: string) => {
    if (n.includes("Hanscom")) return "Hanscom AFB";
    if (n.includes("General")) return "MGH";
    if (n.includes("Children")) return "Children's UPS";
    if (n.toLowerCase().includes("metro")) return "Metro Bos.";
    return n;
  };
  if (!loads.length) return null;
  return (
    <div className="flex gap-1.5 flex-wrap md:justify-end">
      {loads.map((l) => (
        <span key={l.id}
          className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border ${
            l.inviolable
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
              : "border-stone-800 bg-stone-900/60 text-stone-400"
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${l.inviolable ? "bg-emerald-400" : "bg-stone-500"}`} />
          {abbrev(l.name)}
        </span>
      ))}
    </div>
  );
}

function ResultRow({ mode, result }: { mode: AppState["mode"]; result: AppState["result"] }) {
  if (mode === "baseline") {
    return (
      <div className="shrink-0 bg-rose-950/30 border-b border-rose-900/50 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-6">
        <ResultStat tone="bad" label="Outcome" value="Brownout sustained" sub="No coordination · no curtailment" />
        <ResultStat tone="bad" label="Caution time" value={`${result.caution_min_sim} min`} sub="Below 59.95 Hz" />
        <ResultStat tone="bad" label="Peak severity" value={`${(result.peak_severity * 100).toFixed(0)}%`} sub="Brownout intensity" />
        <ResultStat tone="bad" label="Customers at risk" value="~70 K" sub="Metro Boston UFLS zone (simulated)" />
      </div>
    );
  }
  return (
    <div className="shrink-0 bg-emerald-950/25 border-b border-emerald-900/50 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-6">
      <ResultStat tone="good" label="Outcome" value="Brownout averted" sub="Frequency held · priority loads safe" />
      <ResultStat tone="good" label="Compute deferred" value={`${result.shed_mwh} MWh`} sub={`${result.shed_mw.toFixed(0)} MW × 30 min`} />
      <ResultStat tone="good" label="Avoided impact" value={`$${(result.avoided_dollars/1000).toFixed(0)} K`} sub={`~${(result.avoided_customers/1000).toFixed(0)} K customers · ${result.avoided_brownout_min} min UFLS`} />
      <ResultStat tone="good" label="Carbon avoided" value={`~${result.avoided_co2_tons} t CO₂`} sub="No peaker spin-up" />
    </div>
  );
}

function ResultStat({ tone, label, value, sub }: { tone: "good" | "bad"; label: string; value: string; sub: string }) {
  const labelCls = tone === "good" ? "text-emerald-400" : "text-rose-400";
  const valueCls = tone === "good" ? "text-emerald-100" : "text-rose-100";
  const subCls   = tone === "good" ? "text-emerald-300/70" : "text-rose-300/70";
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-[0.22em] ${labelCls}`}>{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${valueCls}`}>{value}</div>
      <div className={`text-[11px] ${subCls}`}>{sub}</div>
    </div>
  );
}

function BrownoutStrip({ severity, mode }: { severity: number; mode: AppState["mode"] }) {
  const intense = severity > 0.7;
  return (
    <div className={`shrink-0 px-6 py-2 text-center font-mono text-sm border-b ${
      intense ? "bg-rose-700 text-white border-rose-600 animate-pulse" : "bg-rose-950/60 text-rose-100 border-rose-900/60"
    }`}>
      ⚠ BROWNOUT <span className="opacity-70">(sim.)</span> · Metro Boston · severity {(severity * 100).toFixed(0)}%
      {mode === "baseline" && " · no coordination"}
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
    ? "Pull last 4 hours of real ISO-NE demand from EIA-930 at run start."
    : "Set EIA_API_KEY in backend/.env to enable live data.";
  return (
    <div className={`flex rounded-md border border-stone-800 bg-stone-950 overflow-hidden text-[10px] uppercase tracking-[0.18em] ${disabled ? "opacity-40" : ""}`}>
      <button
        onClick={() => onChange("replay")}
        disabled={disabled}
        className={`px-3 py-2 ${value === "replay" ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:text-stone-300"}`}
        title="Replay Jun 2024 heat-dome day from bundled EIA-930 file."
      >
        Replay
      </button>
      <button
        onClick={() => onChange("live")}
        disabled={disabled || !eiaKeyAvailable}
        className={`px-3 py-2 flex items-center gap-1.5 ${value === "live" && eiaKeyAvailable ? "bg-emerald-900/40 text-emerald-200" : "text-stone-500 hover:text-stone-300"} ${!eiaKeyAvailable ? "cursor-not-allowed" : ""}`}
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
      <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        live
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded bg-amber-950/40 text-amber-400 border border-amber-900/40 flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      {status}
    </span>
  );
}

function ModeBadge({ mode, finished }: { mode: AppState["mode"]; finished: boolean }) {
  const label =
    mode === "idle" ? "idle"
      : mode === "baseline" ? (finished ? "baseline · complete" : "baseline · running")
        : (finished ? "gridparley · complete" : "gridparley · running");
  const cls =
    mode === "idle" ? "bg-stone-900 text-stone-400 border-stone-800"
      : mode === "baseline" ? "bg-rose-950/40 text-rose-200 border-rose-900/50"
        : "bg-emerald-950/40 text-emerald-200 border-emerald-900/50";
  return (
    <span className={`text-[10px] uppercase tracking-[0.22em] px-3 py-1.5 rounded-md border text-center ${cls}`}>
      {label}
    </span>
  );
}

function ChartLegend() {
  const items = [
    { color: "#fbbf24", label: "Frequency" },
    { color: "#34d399", label: "Gen avail" },
    { color: "#a78bfa", label: "Total load" },
    { color: "#78716c", label: "EIA forecast", dashed: true },
  ];
  return (
    <div className="flex gap-3 text-[11px] text-stone-400">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className={`inline-block w-3 h-0.5 ${it.dashed ? "border-t border-dashed" : ""}`}
            style={{ background: it.dashed ? undefined : it.color, borderColor: it.dashed ? it.color : undefined }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function TranscriptRow({ m }: { m: TranscriptMessage }) {
  const senderStyles: Record<string, { label: string; bar: string; text: string; bg: string }> = {
    iso:       { label: "ISO-NE",   bar: "bg-sky-500",     text: "text-sky-300",    bg: "bg-sky-950/20 border-sky-900/40" },
    dc:        { label: "DC FLEET", bar: "bg-violet-500",  text: "text-violet-300", bg: "bg-violet-950/20 border-violet-900/40" },
    validator: { label: "POLICY",   bar: "bg-rose-500",    text: "text-rose-300",   bg: "bg-rose-950/30 border-rose-800/60" },
    system:    { label: "SYSTEM",   bar: "bg-stone-500",   text: "text-stone-400",  bg: "bg-stone-900/40 border-stone-800" },
  };
  const s = senderStyles[m.sender] || senderStyles.system;
  const isReject = m.kind === "tool_result" && (m.payload as { status?: string })?.status === "rejected";
  const p = m.payload as { path?: "live" | "canned"; model?: string; latency_ms?: number; tokens?: number };
  const isLive = p?.path === "live";
  const isCanned = p?.path === "canned";
  return (
    <div className={`flex gap-3 rounded-md border ${s.bg} px-3 py-2 ${isReject ? "ring-2 ring-rose-500/60 shadow-lg shadow-rose-500/20 animate-flashReject" : ""}`}>
      <div className={`w-1 rounded-sm ${isReject ? "bg-rose-500" : s.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1 gap-2">
          <span className={`font-mono uppercase tracking-[0.16em] ${s.text} flex items-center gap-2 flex-wrap`}>
            <span>{s.label}</span>
            <span className="text-stone-600 normal-case tracking-normal">{m.kind}</span>
            {isReject && <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold animate-pulse">⚠ REJECTED</span>}
            {isLive && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-[9px] normal-case tracking-normal">
                {p?.model?.split("/").pop() ?? "live"} · {p?.latency_ms != null ? `${p.latency_ms}ms` : "live"}
                {p?.tokens != null ? ` · ${p.tokens}t` : ""}
              </span>
            )}
            {isCanned && (
              <span className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-stone-400 text-[9px] normal-case tracking-normal">canned</span>
            )}
          </span>
          <span className="text-stone-600 shrink-0 font-mono">{m.ts_local}</span>
        </div>
        <div className={`text-sm leading-snug ${isReject ? "text-rose-100 font-medium" : "text-stone-200"}`}>{m.text}</div>
      </div>
    </div>
  );
}

function ThinkingBubble({ actor, text }: { actor: "iso" | "dc" | "validator"; text: string }) {
  const styles: Record<string, { label: string; bar: string; text: string; bg: string }> = {
    iso:       { label: "ISO-NE",   bar: "bg-sky-500/60",    text: "text-sky-300/80",    bg: "bg-sky-950/10 border-sky-900/30 border-dashed" },
    dc:        { label: "DC FLEET", bar: "bg-violet-500/60", text: "text-violet-300/80", bg: "bg-violet-950/10 border-violet-900/30 border-dashed" },
    validator: { label: "POLICY",   bar: "bg-rose-500/60",   text: "text-rose-300/80",   bg: "bg-rose-950/10 border-rose-900/30 border-dashed" },
  };
  const s = styles[actor];
  return (
    <div className={`flex gap-3 rounded-md border ${s.bg} px-3 py-2 italic`}>
      <div className={`w-1 rounded-sm ${s.bar}`} />
      <div className="flex-1">
        <div className="flex items-center text-xs mb-1">
          <span className={`font-mono uppercase tracking-[0.16em] ${s.text}`}>{s.label}</span>
          <Dots />
        </div>
        <div className="text-sm text-stone-400 leading-snug">{text}</div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="ml-2 inline-flex gap-1">
      <span className="w-1 h-1 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1 h-1 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1 h-1 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
