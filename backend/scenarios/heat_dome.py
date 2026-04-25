"""Scripted heat-dome scenario: Jun 17, 2024 ISO-NE evening peak.

A 400 MW generator trip fires at scenario tick 18 (~simulated 18:30 ET),
forcing curtailment. The Curtailment trigger arms at scenario tick 20.
"""
from dataclasses import dataclass

# Scenario tick numbers (relative to demo window, not absolute replay tick)
TICK_GEN_TRIP   = 18    # 400 MW generator trip
TICK_TRIP_FULL  = 20    # trip ramped fully in
TICK_ARM_AGENTS = 21    # ISO agent fires curtailment request
TICK_END        = 47    # end of demo window (4 hours of sim time)

GEN_TRIP_MW = 400.0
DC_LOAD_MW  = 800.0     # synthetic AI training fleet baseline


@dataclass
class ScenarioEvent:
    tick: int
    kind: str            # "gen_trip" | "narrate" | "arm_agents"
    payload: dict


EVENTS: list[ScenarioEvent] = [
    ScenarioEvent(0,  "narrate", {"text": "Jun 20 2024, 13:00 ET — Eastern US heat dome day 4. ISO-NE afternoon peak ramp begins."}),
    ScenarioEvent(12, "narrate", {"text": "14:00 ET — demand crosses 21 GW. Reserves tight; data center fleet running 800 MW of training."}),
    ScenarioEvent(TICK_GEN_TRIP, "gen_trip", {"mw": GEN_TRIP_MW, "name": "Mystic 8 (combined cycle)"}),
    ScenarioEvent(TICK_GEN_TRIP, "narrate", {"text": "GENERATOR TRIP: Mystic 8, 400 MW offline. Frequency excursion imminent."}),
    ScenarioEvent(TICK_ARM_AGENTS, "arm_agents", {}),
]


def find_events(tick: int) -> list[ScenarioEvent]:
    return [e for e in EVENTS if e.tick == tick]
