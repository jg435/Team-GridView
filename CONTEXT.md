# GridParley — Build Context Snapshot

> **Read this if you're a new contributor (or future-you) picking up this repo cold.**
> Captures the build context that isn't obvious from the code or the README.

Last updated: Apr 26, 2026 (SCSP Hackathon Round 1 submission day).

---

## What this is

A multi-agent grid-aware coordination system. Two Claude agents (ISO + hyperscaler data center) negotiate emergency power curtailment, gated by a deterministic Python validator that protects priority loads (DoD bases, hospitals).

**Built for:** SCSP National Security Hackathon 2026, Electric Grid Optimization track. Boston site, solo entry, team gridview.

**Repo:** <https://github.com/jg435/Team-GridView>

---

## Where to start

1. **Read [`README.md`](README.md)** — submission-grade overview.
2. **Read [`pitch/DEMO.md`](pitch/DEMO.md)** — verbal script + pre-demo checklist + Q&A coaching.
3. **Run it:**
   ```bash
   # Backend
   cd backend && uv venv && source .venv/bin/activate
   uv pip install -r requirements.txt
   cp .env.example .env  # add OPENROUTER_API_KEY (and optional EIA_API_KEY for live mode)
   uvicorn app:app --port 8000

   # Frontend (in another terminal)
   cd frontend && npm install --legacy-peer-deps && npm run dev
   ```
4. Open `localhost:3002` and click **Run with GridParley**.

---

## File map

| Path | What lives there |
|---|---|
| `backend/policy.py` | Priority-load table + AI training job manifest (3 hidden traps with opaque billing-SKU IDs) |
| `backend/validator.py` | Deterministic safety gate (~70 lines). Source of truth for the asset registry. |
| `backend/grid_model.py` | Phenomenological frequency model. Tuned for visual readability, not physics accuracy. |
| `backend/agents/orchestrator.py` | Dual-path negotiation: live OpenRouter / canned arc. Provenance badges instrumented. |
| `backend/agents/iso_agent.py` | ISO operator system prompt |
| `backend/agents/dc_agent.py` | DC fleet ops system prompt + manifest view filter (strips `is_priority_load`) |
| `backend/agents/tools.py` | OpenAI-compatible function-calling schemas |
| `backend/eia_client.py` | EIA v2 API client for live data mode |
| `backend/eval_redteam.py` | 50-trial fault injection harness; produces `eval_results.json` |
| `backend/scenarios/heat_dome.py` | Scripted Jun 20 2024 ISO-NE event (400 MW Mystic 8 trip) |
| `backend/data/isone_jun2024.csv` | 168 hours of real EIA-930 data (peak 23,266 MW) |
| `backend/eval_results.json` | 50-trial eval artifact: 100% catch rate, 0 false positives |
| `frontend/app/components/Dashboard.tsx` | Main UI; transcript with provenance pills |
| `frontend/app/components/NewEnglandMap.tsx` | Pannable / zoomable map of NE with 4 pinned loads |
| `pitch/DEMO.md` | Verbal script (5:00 cap), runbook, Q&A, submission email |
| `pitch/submission_email.txt` | Copy-paste submission email + pre-send checklist |
| `pitch/slides.md` | 6-slide pitch deck content (Marp-compatible markdown; never rendered to PDF) |

---

## Key non-obvious design decisions

**These are deliberate. Read before changing anything in `policy.py`, `validator.py`, or `agents/`.**

1. **Two Claude agents, not one** — mirrors the institutional contractual boundary between ISO and DC. Don't merge unless rewriting the safety property.
2. **DC manifest view strips `is_priority_load`** — models the real data-hygiene gap. The LLM can't reason past a check on data it doesn't have. Don't add the flag back.
3. **Opaque billing-SKU IDs** (`sku_colocation_2`, etc.) — descriptive IDs (`boston_childrens_ups`) caused Claude to recognize and skip them, breaking the demo. The validator uses ID lookup, not name strings.
4. **`tool_choice` pinned per turn** — forces structured output. Don't relax without rebuilding the prose-parsing path.
5. **Phenomenological frequency model** — `LAG_ALPHA=0.45`, `HZ_PER_MW=0.0002`. Tuned for visual demo, not physics. Caption admits this.
6. **Generation capacity = 26 GW** — chosen so post-shed reserve margin shows green ~16%, not panic 0.2%.
7. **`batch_inference_pool = 140 MW`** — was 60. Bumped so non-priority pool ≥450 MW; validator's "exceeds capacity" rule no longer caps clean revised bids.
8. **Dual-path orchestrator with `DEMO_MODE=replay` fallback** — canned arc fires on missing key, error, or env var. Both paths emit identical-shape transcripts.
9. **EIA day-ahead forecast displayed (no model trained)** — real ISO-published number, satisfies the brief's "demand forecaster (simple regression counts)" requirement without synthetic ML.
10. **Result-banner numbers derived from telemetry, not constants** — coefficients exposed in `result.coefficients` so a code-reading judge sees a real derivation.
11. **Provenance badges on live LLM messages** — emerald `claude-sonnet-4.5 · 3263ms · 47t` pill. The single highest-leverage credibility fix in the project.
12. **Three priority-load traps, not one** — validator catches multiple violations in one rejection, visually stronger.

---

## Hackathon timeline

- **Apr 25 (Sat) 11 AM:** kickoff, on-site Boston
- **Apr 25 (Sat) 2 PM:** team registration deadline (sent)
- **Apr 26 (Sun) 5 PM local:** Round 1 submission deadline (email to hack@scsp.ai with README attached)
- **Apr 26 (Sun) 5–7 PM:** in-person demo at Boston venue (5-min hard cap, judge: Dustin Janatpour)
- **May 9 (Sat):** Phase 2 finals at AI+ Expo, DC, if advanced. **Submission is locked between rounds.**

---

## Outstanding / not done

- Backup demo video (`pitch/backup_demo.mp4`) — discussed but not recorded
- `pitch/slides.md` is markdown; never rendered to PDF (deferred per user request)
- "Negotiation is forced" critique not addressed — would risk demo flow if `tool_choice` pinning relaxed
- Frequency model still phenomenological — would need replacement for production deployment
- Maps' pin labels can overlap on extreme zoom

---

## Acknowledgments

- Track brief framings borrowed verbatim: *"air traffic control, but for electrons"*, *"find one lever worth pulling and pull it hard"*
- Real data: EIA Form-930 Hourly Electric Grid Monitor (US Government, public domain)
- Real regulatory anchor: FERC Dec 2025 PJM order on Non-Firm Contract Demand Transmission Service
- Real reliability standard cited: ISO-NE Reliability Standard 7.4 (priority load protection)
- LLM: `anthropic/claude-sonnet-4.5` via OpenRouter
