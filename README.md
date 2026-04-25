# GridParley

> Grid-aware AI agents that negotiate workload curtailment between ISO-NE and a hyperscaler data center fleet — under FERC's new Non-Firm Contract Demand framework, with deterministic safety rails for DoD priority loads.

**SCSP National Security Hackathon 2026 · Boston · Electric Grid Optimization track**

| | |
|---|---|
| Team | **team gridview** |
| Track | Electric Grid Optimization |
| Members | Jayesh Gupta (solo) |
| Live demo | `localhost:3002` after `npm run dev` (see "Run") |
| Backup video | `pitch/backup_demo.mp4` |
| Pitch deck | `pitch/slides.pdf` |

---

## What we built

**The problem.** US data center load grew 22% in 2025 and is on track to triple by 2030. ISO-NE has the tightest reserve margins in the country and serves Hanscom AFB, multiple naval installations, and major Boston hospitals. In December 2025, FERC ordered PJM to create a *Non-Firm Contract Demand Transmission Service* — a tariff that lets AI co-located loads contract for interruptible service during grid stress. **It's a policy primitive with no operating layer.** When ISO-NE's control room needs 240 MW shed in 90 seconds, who do they call? How do they verify the data center didn't accidentally sell them a hospital's UPS load?

**The solution.** GridParley is a multi-agent system where:

1. An **ISO control-room agent** (Claude, with tool use) monitors grid telemetry and issues structured curtailment requests to the colocated hyperscaler data-center fleet.
2. A **data-center fleet agent** (Claude, with a separate tool surface) chooses which AI training jobs to pause — minimizing cost and restart latency — and proposes a structured commitment.
3. A **deterministic policy validator** (no LLM) sits between the agents and the grid model. It enforces ISO-NE Reliability Standard 7.4 — Hanscom AFB, Mass General, and Boston Children's Hospital colocated UPS load are *inviolable*. Every agent tool call is checked before it touches the grid.

**The hero moment.** In our demo's scripted scenario, the DC agent's first proposal accidentally includes the Boston Children's UPS load (it's mis-classified as a normal SKU in the workload-scheduling team's manifest, but the validator's asset registry knows the truth). The validator interjects in red, citing the policy reference. The DC agent self-corrects on the next turn. Judges see this on screen.

**Why hybrid.** Pure-LLM grid agents are unsafe — hallucinated MW values can knock out a hospital. Pure-rules optimizers can't negotiate over ambiguous priorities or explain themselves to a control-room operator. We do both: deterministic safety, generative communication.

---

## Datasets and APIs

| Source | Use | License |
|---|---|---|
| [EIA Form-930 Hourly Electric Grid Monitor](https://www.eia.gov/electricity/gridmonitor/) | Real ISO-NE hourly demand for Jun 14–20 2024 (heat-dome week). Filtered to `backend/data/isone_jun2024.csv`. | Public domain (US Government) |
| [OpenRouter](https://openrouter.ai/) → `anthropic/claude-sonnet-4.5` (default; configurable) | Both agents are OpenAI-compatible chat-completion calls with function calling, `temperature=0`, routed to OpenRouter. Falls back to a deterministic canned arc if `OPENROUTER_API_KEY` is unset or any live error occurs. | Commercial; user supplies own key |
| [Electricity Maps free tier](https://www.electricitymaps.com/free-tier-api) (planned) | Carbon intensity overlay for the demo (cached at boot). | Free for non-commercial |

All data is unclassified and publicly available. ITAR/EAR-clean.

---

## Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Next.js + Tailwind + Recharts │ ◄───WS───  │       FastAPI            │
│   localhost:3002             │         │     localhost:8000        │
└─────────────────────────────┘         │                          │
                                         │  ┌────────────────────┐  │
                                         │  │  Replay Engine     │  │
                                         │  │  (EIA-930 → ticks) │  │
                                         │  └─────────┬──────────┘  │
                                         │            │             │
                                         │  ┌─────────▼──────────┐  │
                                         │  │  Frequency Model   │  │
                                         │  │  (phenomenological)│  │
                                         │  └─────────┬──────────┘  │
                                         │            │             │
                                         │  ┌─────────▼──────────┐  │
                                         │  │ Agent Orchestrator │  │
                                         │  │  ┌──────┐ ┌──────┐ │  │
                                         │  │  │ ISO  │ │  DC  │ │  │  Anthropic
                                         │  │  │Claude│ │Claude│ │──┼──► claude-sonnet-4-6
                                         │  │  └──┬───┘ └──┬───┘ │  │
                                         │  │     └───┬────┘     │  │
                                         │  │  ┌──────▼───────┐  │  │
                                         │  │  │  Validator   │  │  │  ← deterministic policy
                                         │  │  │   (rules)    │  │  │     (priority loads,
                                         │  │  └──────────────┘  │  │      ISO-NE Rel Std 7.4)
                                         │  └────────────────────┘  │
                                         └──────────────────────────┘
```

### Files of interest

- `backend/policy.py` — priority-load table, AI training job manifest (with the colocation trap entry), curtailment math.
- `backend/validator.py` — the gate that catches LLM mistakes.
- `backend/grid_model.py` — phenomenological frequency model (60.0 → 59.93 on a 400 MW trip; recovers to 59.96 on a 220 MW shed).
- `backend/agents/orchestrator.py` — dual-path negotiation (LIVE Claude / REPLAY canned).
- `backend/agents/{iso,dc}_agent.py` — system prompts.
- `backend/agents/tools.py` — Anthropic tool schemas.
- `backend/scenarios/heat_dome.py` — scripted Jun 20 2024 ISO-NE event.
- `frontend/app/components/Dashboard.tsx` — the live UI.

---

## How to run

### 1. Backend (FastAPI)

```bash
cd backend
uv venv             # or: python3 -m venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env
# edit .env: paste your OPENROUTER_API_KEY (without one, the canned demo arc plays)
uvicorn app:app --port 8000
```

### 2. Frontend (Next.js 16 + React 19)

```bash
cd frontend
npm install
npm run dev   # serves on localhost:3000 (or 3002 if 3000 is taken)
```

### 3. Drive the demo

Open the dashboard, then either:

- **Click "Run Baseline"** to replay Jun 20 2024 ISO-NE without GridParley. Watch frequency dip below the caution line and stay there.
- **Click "Run with GridParley"** to replay the same scenario *with* the agents armed. Watch the negotiation transcript appear, the validator catch the bad bid, the DC agent self-correct, and frequency recover above 59.95 Hz.

### 4. Force the canned demo arc (zero-risk presentation mode)

```bash
DEMO_MODE=replay uvicorn app:app --port 8000
```

The transcript is identical in structure but bypasses Claude. Used as a fallback during live presentation.

---

## Judging rubric mapping

| Criterion (25%) | How GridParley scores |
|---|---|
| **Novelty** | Hybrid architecture: deterministic safety rails *under* generative LLM negotiation. No team will have built the validator-rejection-with-self-correction moment that we demo. |
| **Technical Difficulty** | Real grid physics (frequency model, swing-equation-style behavior tuned for demo readability), real EIA-930 data, two distinct Claude agents with separate tool surfaces and a multi-turn revision loop, WebSocket-streamed live simulation, deterministic policy validator. |
| **Potential National Impact** | The FERC Dec 2025 PJM order is the same problem in every ISO. ISO-NE pilot → NYISO → PJM → MISO → CAISO. Federation roadmap below. |
| **Problem-Solution Fit** | Three named users — Maya (ISO-NE control-room operator), Raj (hyperscaler fleet ops), Col. Davis (Hanscom AFB installation energy manager) — each with a concrete pain that maps to a concrete feature. |

---

## Roadmap (post-hackathon)

1. **Multi-region federation.** Wire NYISO, PJM, MISO so the DC fleet can shed against whichever ISO is most stressed.
2. **Formal verification of curtailment SLAs.** Cryptographic settlement; tamper-evident logs.
3. **DoD installation energy plan integration.** Pull priority-load classifications from official AFCEC / NAVFAC registries instead of a hand-coded table.
4. **Carbon-aware co-optimization.** Integrate Electricity Maps marginal carbon intensity so curtailment also reduces emissions.
5. **Fault-injection / red-team mode.** Deliberately try to make the LLM violate priority loads; certify the validator's rejection rate.

---

## Team

**team gridview** — Jayesh Gupta (solo). Boston site, Electric Grid Optimization track. Registered with SCSP per the 2 PM Sat deadline.

---

## License & IP

Code retained by author. SCSP receives non-exclusive license per hackathon rules.
All datasets used are publicly available; no ITAR/EAR-controlled content.
