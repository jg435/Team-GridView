export interface ProtectedLoad {
  id: string;
  name: string;
  priority: 1 | 2 | 3 | 4 | 5;
  mw: number;
  inviolable: boolean;
}

export interface JobManifestItem {
  id: string;
  name: string;
  mw: number;
  restart_minutes: number;
  marginal_cost_per_mwh: number;
  is_priority_load: boolean;
}

export interface TranscriptMessage {
  sender: "iso" | "dc" | "validator" | "system";
  kind: "speech" | "tool_call" | "tool_result" | "narrate";
  text: string;
  payload: Record<string, unknown>;
  ts_local: string;
}

export interface GridSnapshot {
  tick: number;
  ts_local: string;
  frequency_hz: number;
  base_demand_mw: number;
  dc_load_mw: number;
  committed_shed_mw: number;
  total_load_mw: number;
  gen_capacity_mw: number;
  gen_tripped_mw: number;
  gen_available_mw: number;
  p_gen_eff_mw: number;
  reserve_margin_pct: number;
  blackout: boolean;
  blackout_severity: number;
  f_caution: number;
  f_nominal: number;
}

export interface RunResult {
  shed_mw: number;
  shed_mwh: number;
  caution_ticks: number;
  caution_min_sim: number;
  brownout_ticks: number;
  peak_severity: number;
  avoided_customers: number;
  avoided_brownout_min: number;
  avoided_dollars: number;
  avoided_co2_tons: number;
}

export interface AppState {
  mode: "idle" | "baseline" | "gridparley";
  scenario_tick: number;
  grid: GridSnapshot;
  transcript: TranscriptMessage[];
  finished: boolean;
  protected_loads: ProtectedLoad[];
  job_manifest: JobManifestItem[];
  result: RunResult;
  thinking: string | null;
  thinking_actor: "iso" | "dc" | "validator" | null;
}
