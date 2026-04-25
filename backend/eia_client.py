"""EIA v2 API client for live ISO-NE demand.

Free API: register at https://www.eia.gov/opendata/register.php for a key.
Rate limit ~1000 req/hour, plenty for our use.

The /electricity/rto/region-data dataset publishes hourly demand for each
balancing authority (`respondent`). We pull `D` (demand) for `ISNE`.
Data lags ~1-3 hours behind wall clock; "live" means the most recent
hour EIA has ingested.
"""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

EIA_BASE = "https://api.eia.gov/v2/electricity/rto/region-data/data/"


async def fetch_isone_recent_hours(hours_back: int = 8) -> list[dict]:
    """Return up to `hours_back` most-recent hourly demand rows for ISO-NE.

    Each row: {"ts_utc": "...", "ts_local": "...", "demand_mw": float}
    """
    api_key = os.getenv("EIA_API_KEY")
    if not api_key:
        raise RuntimeError("EIA_API_KEY not set; cannot pull live data")

    end = datetime.now(timezone.utc)
    start = end - timedelta(hours=hours_back + 4)  # +4 to be safe given EIA lag
    params = {
        "api_key": api_key,
        "frequency": "hourly",
        "data[0]": "value",
        "facets[respondent][]": "ISNE",
        "facets[type][]": "D",  # D = demand (megawatthours)
        "start": start.strftime("%Y-%m-%dT%H"),
        "end":   end.strftime("%Y-%m-%dT%H"),
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 24,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(EIA_BASE, params=params)
        resp.raise_for_status()
        body = resp.json()

    rows = body.get("response", {}).get("data", [])
    out: list[dict] = []
    for r in rows:
        try:
            ts_utc = r["period"]                       # "YYYY-MM-DDTHH"
            mw = float(r["value"])
            # Convert UTC hour to local ET (UTC-5/-4); naive: assume EDT (-4) for summer.
            ts_dt = datetime.fromisoformat(ts_utc + ":00:00").replace(tzinfo=timezone.utc)
            ts_local = ts_dt - timedelta(hours=4)
            out.append({
                "ts_utc": ts_utc,
                "ts_local": ts_local.strftime("%m/%d/%Y %-I:%M:%S %p"),
                "demand_mw": mw,
            })
        except (KeyError, ValueError, TypeError):
            continue
    out.sort(key=lambda r: r["ts_utc"])  # ascending
    return out[-hours_back:]


def has_eia_key() -> bool:
    return bool(os.getenv("EIA_API_KEY"))
