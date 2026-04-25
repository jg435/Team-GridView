"""Replay engine: streams ISO-NE Jun 14-20 2024 demand at 5 sim-min per tick."""
from dataclasses import dataclass
from pathlib import Path
import csv

DATA_PATH = Path(__file__).parent / "data" / "isone_jun2024.csv"

@dataclass
class HourlyRow:
    ts_utc: str
    ts_local: str
    demand_mw: float
    demand_forecast_mw: float
    net_gen_mw: float
    interchange_mw: float


def load_hours() -> list[HourlyRow]:
    rows: list[HourlyRow] = []
    with DATA_PATH.open() as f:
        reader = csv.DictReader(f)
        for r in reader:
            try:
                rows.append(HourlyRow(
                    ts_utc=r["ts_utc"],
                    ts_local=r["ts_local"],
                    demand_mw=float(r["demand_mw"]),
                    demand_forecast_mw=float(r["demand_forecast_mw"] or 0),
                    net_gen_mw=float(r["net_gen_mw"] or 0),
                    interchange_mw=float(r["interchange_mw"] or 0),
                ))
            except (ValueError, KeyError):
                continue
    return rows


# 1 tick = 5 sim minutes. 12 ticks = 1 hour. Linearly interpolate between hourly rows.
TICKS_PER_HOUR = 12

def expand_to_ticks(hours: list[HourlyRow]) -> list[dict]:
    out: list[dict] = []
    for i in range(len(hours) - 1):
        a, b = hours[i], hours[i + 1]
        for k in range(TICKS_PER_HOUR):
            f = k / TICKS_PER_HOUR
            out.append({
                "tick": i * TICKS_PER_HOUR + k,
                "ts_local": a.ts_local if k == 0 else f"{a.ts_local} +{5*k}m",
                "demand_mw": a.demand_mw + (b.demand_mw - a.demand_mw) * f,
                "forecast_mw": a.demand_forecast_mw + (b.demand_forecast_mw - a.demand_forecast_mw) * f,
            })
    return out


# Demo window: Jun 20 2024, 13:00-17:00 ET — actual peak day of the heat dome,
# rising from ~19 GW to 23 GW. Scripted gen trip fires mid-window.
# 4 hours × 12 ticks/hour = 48 ticks. With 1 wall-sec per tick, that's a 48s replay.
def demo_window_ticks() -> list[dict]:
    rows = load_hours()
    ticks = expand_to_ticks(rows)
    start_h, end_h = 161, 165   # absolute hour indices into our 168-hour file
    start_t = start_h * TICKS_PER_HOUR
    end_t = end_h * TICKS_PER_HOUR
    return [t for t in ticks if start_t <= t["tick"] < end_t]


if __name__ == "__main__":
    hours = load_hours()
    print(f"loaded {len(hours)} hourly rows")
    print(f"first: {hours[0].ts_local} demand={hours[0].demand_mw}")
    print(f"peak: {max(h.demand_mw for h in hours):.0f} MW")
    print(f"demo window: {len(demo_window_ticks())} ticks")
