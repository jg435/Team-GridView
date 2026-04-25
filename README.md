# GridParley

> Grid-aware AI agents that negotiate workload curtailment between ISO-NE and a hyperscaler data-center fleet — under FERC's new Non-Firm Contract Demand framework, with deterministic safety rails that protect DoD priority loads and hospitals.

| | |
|---|---|
| **Team** | team gridview |
| **Track** | Electric Grid Optimization |
| **Members** | Jayesh Gupta (solo) |
| **Site** | Boston |
| **Repo** | <https://github.com/jg435/Team-GridView> |
| **Demo** | `localhost:3002` after `npm run dev` (instructions below) |

---

## What we built

**The problem.** US data-center load grew 22% in 2025 and is on track to triple by 2030. ISO New England has the tightest reserve margins in the country and serves Hanscom AFB, multiple naval installations, and major Boston hospitals. In **December 2025 the FERC ordered PJM to create a *Non-Firm Contract Demand Transmission Service*** — a new tariff that lets AI co-located loads contract for *interruptible* service during grid emergencies. **It's a policy primitive with no operating layer.** When ISO-NE's control room needs 240 MW shed in 90 seconds, who do they call? How do they verify the data center didn't accidentally sell them a hospital's UPS load?

**The solution.** GridParley is a multi-agent system where:

1. An **ISO control-room agent** (Claude, with tool use) monitors grid telemetry and issues structured curtailment requests to the colocated hyperscaler data-center fleet.
2. A **data-center fleet agent** (Claude, with a separate tool surface) chooses which AI training jobs to pause — minimizing cost and restart latency — and proposes a structured commitment.
3. A **deterministic policy validator** (no LLM) sits between the agents and the grid model. It enforces ISO-NE Reliability Standard 7.4: **Hanscom AFB, Mass General, and Boston Children's Hospital co-located UPS load are *inviolable***. Every agent tool call is checked before it touches the grid model.

**The hero moment.** In the demo, the DC agent's first proposal accidentally includes priority loads (mis-classified as normal SKUs in the workload-scheduling team's billing manifest, but the validator's asset registry knows the truth). The validator interjects in red, citing the policy reference. The DC agent self-corrects on the next turn. The grid recovers. Hospitals and the AFB stay on.

**Why hybrid.** Pure-LLM grid agents are unsafe — hallucinated MW values can knock out a hospital. Pure-rules optimizers can't negotiate over ambiguous priorities or explain themselves to a control-room operator. We do both: deterministic safety, generative communication.

---

## Empirical validation (the headline)

We ran a **50-trial red-team / fault-injection eval** against the policy validator. Each trial perturbs:

- the DC agent's selection-rule instruction (8 prompt variants)
- the requested MW target (240–440 MW)
- the manifest entry order (shuffled per trial)

The DC fleet manifest contains **3 mis-classified priority loads**, each disguised as a normal billing SKU.

| Metric | Result |
|---|---|
| Bids that proposed ≥1 priority load | **50 / 50** (100%) |
| Validator rejected violation bids | **50 / 50** (100% catch rate) |
| Validator caught **every** trap in the bid | **50 / 50** (100% zero-leak) |
| False-positive rejections | **0** |

Per-trap detection rate: `sku_colocation_2` 50/50 · `sku_mgafail_2` 50/50 · `sku_afedge_7` 50/50.

The safety layer isn't a one-shot stunt against a single planted trap. It catches every priority-load violation across an LLM under varied instructions and randomized inputs. Reproduce with `python3 backend/eval_redteam.py --trials 50`. Full per-trial artifact: `backend/eval_results.json`.

---

## Datasets and APIs

| Source | Use | License |
|---|---|---|
| [EIA Form-930 Hourly Electric Grid Monitor](https://www.eia.gov/electricity/gridmonitor/) | Real ISO-NE hourly demand for the Jun 14–20 2024 heat-dome week (peak day Jun 20 at **23,266 MW**, 19:00 ET). Filtered to `backend/data/isone_jun2024.csv`. | Public domain (US Government) |
| [EIA v2 API](https://www.eia.gov/opendata/) (`electricity/rto/region-data`, `respondent=ISNE`) | Optional **Live data mode**: pulls today's actual ISO-NE demand. Toggled in the dashboard header. Requires free API key. | Public domain |
| [OpenRouter](https://openrouter.ai/) → `anthropic/claude-sonnet-4.5` (default; configurable via `OPENROUTER_MODEL`) | Both LLM agents. OpenAI-compatible chat completions with function calling, `temperature=0`. Falls back to a deterministic canned arc if no key or any live error. | Commercial (user supplies key) |
| [us-atlas](https://github.com/topojson/us-atlas) `states-10m.json` | TopoJSON for the New England map. | ISC |

All data is unclassified and publicly available. ITAR/EAR-clean.

---

## Architecture

```
┌──────────────────────────────┐         ┌────────────────────────────┐
│ Next.js + Tailwind + Recharts │ ◄───WS───  │          FastAPI           │
│        localhost:3002         │         │        localhost:8000      │
└──────────────────────────────┘         │                            │
                                          │ ┌─────────────────────────┐│
                                          │ │   Replay / Live Engine   ││
                                          │ │  (EIA-930 CSV or v2 API) ││
                                          │ └────────────┬────────────┘│
                                          │              │             │
                                          │ ┌────────────▼────────────┐│
                                          │ │   Frequency Model       ││
                                          │ │  (phenomenological lag) ││
                                          │ └────────────┬────────────┘│
                                          │              │             │
                                          │ ┌────────────▼────────────┐│
                                          │ │   Agent Orchestrator    ││
                                          │ │   ┌───────┐  ┌───────┐  ││
                                          │ │   │ ISO   │  │  DC   │  ││  OpenRouter
                                          │ │   │Claude │  │Claude │  ├┼──► claude-sonnet-4.5
                                          │ │   └───┬───┘  └───┬───┘  ││
                                          │ │       └────┬─────┘      ││
                                          │ │   ┌────────▼─────────┐  ││
                                          │ │   │   Validator       │  ││  ← deterministic
                                          │ │   │   (rules engine)  │  ││    ISO-NE Rel Std 7.4
                                          │ │   └───────────────────┘  ││
                                          │ └─────────────────────────┘│
                                          └────────────────────────────┘
```

### Files of interest

- `backend/policy.py` — priority-load table, AI training job manifest (8 entries; 3 mis-classified traps with opaque billing-SKU IDs), curtailment math.
- `backend/validator.py` — the gate that catches LLM mistakes.
- `backend/grid_model.py` — phenomenological frequency model (60.0 → 59.93 on a 400 MW trip; recovers to ~59.96 on a 220–250 MW shed).
- `backend/agents/orchestrator.py` — dual-path negotiation (LIVE OpenRouter / REPLAY canned arc).
- `backend/agents/{iso,dc}_agent.py` — system prompts.
- `backend/agents/tools.py` — function-calling tool schemas.
- `backend/scenarios/heat_dome.py` — scripted Jun 20 2024 ISO-NE event (Mystic 8 trip at scenario tick 18).
- `backend/eia_client.py` — EIA v2 API client for live mode.
- `backend/eval_redteam.py` — fault-injection eval (50-trial red-team artifact).
- `frontend/app/components/Dashboard.tsx` — main UI.
- `frontend/app/components/NewEnglandMap.tsx` — pannable / zoomable ISO-NE map with pinned protected loads.

---

## How to run it

### 1. Backend (FastAPI)

```bash
cd backend
uv venv                           # or: python3 -m venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
# Edit .env:
#   OPENROUTER_API_KEY=sk-or-v1-...   (required for live LLM agents; canned arc plays without)
#   EIA_API_KEY=...                   (optional, enables Live data toggle)
uvicorn app:app --port 8000
```

### 2. Frontend (Next.js 16 + React 19)

```bash
cd frontend
npm install --legacy-peer-deps    # react-simple-maps@3 peer-pins React <19
npm run dev                       # serves on localhost:3000 (or 3002 if taken)
```

### 3. Drive the demo

Open the dashboard. In the header:

- **Replay / Live toggle** — Replay runs the bundled Jun 2024 EIA-930 CSV. Live pulls today's actual ISO-NE demand from EIA v2 API (requires `EIA_API_KEY`).
- **Run Baseline** — same scenario *without* coordination. Watch frequency dip below the caution line, brownout banner pulses red.
- **Run with GridParley** — same scenario *with* the agents armed. Watch the negotiation transcript appear, the validator catch the bad bid, the DC agent self-correct, frequency recover above 59.95 Hz.
- **Reset** — clear and start over.

### 4. Reproduce the red-team eval

```bash
cd backend && source .venv/bin/activate
python3 eval_redteam.py --trials 50
# Writes eval_results.json with full per-trial artifact.
```

### 5. Force zero-risk presentation mode

If you want every demo to be deterministic and identical (no LLM dependency):

```bash
DEMO_MODE=replay uvicorn app:app --port 8000
```

The transcript is identical in structure but bypasses OpenRouter.

---

## Judging-rubric mapping

| Criterion (25%) | How GridParley scores |
|---|---|
| **Novelty** | Hybrid architecture: deterministic safety rails *under* generative LLM negotiation. The validator-rejection-with-self-correction moment is the visible thesis, not a side feature. |
| **Technical Difficulty** | Two distinct Claude agents with separate tool surfaces and a multi-turn revision loop · WebSocket-streamed live simulation · phenomenological frequency model · deterministic policy validator with full asset-registry semantics · 50-trial red-team eval · live EIA-930 v2 API integration. |
| **Potential National Impact** | The FERC Dec 2025 PJM order is the same problem in every ISO. ISO-NE pilot → NYISO → PJM → MISO → CAISO. The Live-data toggle proves the system runs against current grid data, not a recording. |
| **Problem-Solution Fit** | Three named users — Maya (ISO-NE control-room operator), Raj (hyperscaler fleet ops), Col. Davis (Hanscom AFB installation energy manager) — each with a concrete pain that maps to a concrete feature. |

---

## What's real vs. simulated

**Real:** ISO-NE hourly demand from EIA-930 (replay or live). FERC Dec 2025 PJM order. ISO-NE Reliability Standard 7.4. The two LLM agents (real OpenRouter calls). All transcript text from agents. The validator (deterministic Python; not LLM).

**Synthesized (configured constants):** the 800 MW AI data-center fleet, the 400 MW Mystic 8 trip event, the 26 GW generation capacity, the 8-entry job manifest, the priority-load load values, the frequency dynamics (phenomenological model tuned for visual readability).

**Computed approximations** (with documented coefficients in `backend/app.py`): customers-affected, dollars-at-risk, CO₂ avoided. Rooted in EPRI / EIA literature.

---

## Roadmap

1. **Multi-region federation** — wire NYISO, PJM, MISO so the DC fleet can shed against whichever ISO is most stressed.
2. **Formal verification of curtailment SLAs** — cryptographic settlement, tamper-evident audit logs.
3. **DoD installation energy-plan integration** — pull priority-load classifications from official AFCEC / NAVFAC registries instead of a hand-coded table.
4. **Carbon-aware co-optimization** — Electricity Maps marginal carbon intensity to bias curtailment selection.
5. **Production hardening** — operator UI for ISO control rooms, SCADA integration, observability/alerts.

---

## License & IP

Code retained by author. SCSP receives non-exclusive license per hackathon rules.
All datasets used are publicly available; no ITAR / EAR-controlled content.
