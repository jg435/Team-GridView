"""Phenomenological frequency model for ISO-NE.

Not a true swing equation — instead, a first-order lag toward an imbalance-driven
target frequency. Tuned so a 400 MW uncovered trip dips frequency to ~59.92 Hz
over 2-3 ticks, and a 240 MW agent-committed shed recovers it above 59.95 Hz.
"""
from dataclasses import dataclass

F_NOMINAL = 60.0
F_BLACKOUT = 59.5
F_CAUTION = 59.95

S_BASE_MW = 30000.0
HZ_PER_MW = 0.0002          # frequency droop per MW of uncovered trip
LAG_ALPHA = 0.45            # first-order lag toward target each tick
NOISE_HZ = 0.003            # cosmetic flicker

@dataclass
class GridState:
    tick: int = 0
    ts_local: str = ""
    base_demand_mw: float = 14000.0
    dc_load_mw: float = 800.0
    committed_shed_mw: float = 0.0
    gen_capacity_mw: float = 24000.0
    gen_tripped_mw: float = 0.0
    frequency_hz: float = F_NOMINAL
    p_gen_eff_mw: float = 0.0
    p_load_eff_mw: float = 0.0
    blackout: bool = False
    blackout_severity: float = 0.0       # 0..1
    curtailment_armed: bool = False

    @property
    def total_load_mw(self) -> float:
        return self.base_demand_mw + max(0.0, self.dc_load_mw - self.committed_shed_mw)

    @property
    def gen_available_mw(self) -> float:
        return self.gen_capacity_mw - self.gen_tripped_mw

    @property
    def reserve_margin_pct(self) -> float:
        load = self.total_load_mw
        if load <= 0:
            return 0.0
        return (self.gen_available_mw - load) / load * 100.0


def step(state: GridState, dt_sec: float = 1.0) -> GridState:
    # MW of imbalance uncovered after agent commitment
    tripped_uncovered = max(0.0, state.gen_tripped_mw - state.committed_shed_mw)
    target_freq = F_NOMINAL - tripped_uncovered * HZ_PER_MW
    # first-order lag toward target
    state.frequency_hz += LAG_ALPHA * (target_freq - state.frequency_hz)
    # tiny cosmetic noise so the line isn't flat
    import random
    state.frequency_hz += random.uniform(-NOISE_HZ, NOISE_HZ)
    state.p_gen_eff_mw = state.total_load_mw - tripped_uncovered
    state.p_load_eff_mw = state.total_load_mw
    if state.frequency_hz < F_BLACKOUT:
        state.blackout = True
        state.blackout_severity = min(1.0, state.blackout_severity + 0.25)
    elif state.frequency_hz < F_CAUTION:
        state.blackout_severity = min(1.0, state.blackout_severity + 0.05)
    else:
        state.blackout_severity = max(0.0, state.blackout_severity - 0.1)
    return state
