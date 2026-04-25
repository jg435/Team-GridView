---
marp: true
theme: default
class: invert
paginate: true
size: 16:9
style: |
  section { font-family: -apple-system, system-ui, sans-serif; padding: 50px 70px; }
  h1 { color: #fbbf24; font-size: 1.7em; }
  h2 { color: #a1a1aa; font-size: 1.05em; font-weight: 500; margin-top: 0; }
  strong { color: #34d399; }
  em { color: #c4b5fd; font-style: normal; }
  ul { line-height: 1.55; }
  table { font-size: 0.85em; }
  footer { color: #52525b; font-size: 0.7em; }
  section.lead h1 { font-size: 2.1em; }
---

<!-- _class: lead -->
<!-- _footer: SCSP Hackathon 2026 · Boston · Electric Grid Optimization -->

# GridParley
## Grid-Aware AI Agents for Data-Center Curtailment

team gridview · Jayesh Gupta

---

## Slide 1 — Hook

# The grid is breaking under AI

- US data-center load: **+22% in 2025**, projected to triple by 2030
- ISO-NE has the **tightest reserve margins** in the country
- 14M people, **Hanscom AFB**, **Mass General**, **Boston Children's** — same grid
- **800 MW** AI training fleet incoming

---

## Slide 2 — The policy gap

# FERC ordered the rules. Nobody built the system.

- **Dec 2025:** FERC directs PJM to create a *Non-Firm Contract Demand Transmission Service*
- Interruptible service for AI co-located loads during grid emergencies
- **PJM briefs due Feb 16 2026** — happening right now
- Same gap exists in ISO-NE, NYISO, MISO, CAISO

> *The mechanism is a policy primitive. There is no operating layer.*

---

<!-- _class: lead -->

# Slide 3 — Live Demo

[ switch to localhost:3002 ]

> Run Baseline → frequency plunges, brownout flashes.
> Run with GridParley → AIs negotiate, validator catches the trap, frequency recovers.

---

## Slide 4 — Architecture

# Generative negotiation, *deterministic* safety

| Layer | Role |
|---|---|
| **2 × Claude agents** | ISO operator + DC fleet ops. Plain English negotiation so any operator can audit. |
| **Policy validator** *(rules engine)* | Hanscom, Mass General, Children's UPS = inviolable. ISO-NE Rel Std 7.4. **Every tool call checked.** |
| **Grid model** | Real EIA-930 ISO-NE data, Jun 2024 heat dome. Phenomenological frequency dynamics. |

**Why hybrid:** Pure-LLM is unsafe. Pure-rules can't negotiate. Together = production-grade.

---

## Slide 5 — Users

# Three users, three pains, three features

- **Maya — ISO-NE control-room operator.** Sub-minute decisions; flexible loads are opaque. → Structured negotiation channel + decision log.
- **Raj — hyperscaler fleet ops.** SLA-driven; manual curtailment calls don't scale. → Programmatic tool-use API.
- **Col. Davis — Hanscom AFB energy manager.** Brownouts threaten mission readiness. → Priority loads as *first-class* constraints.

---

## Slide 6 — National impact + ask

# Boston today. Every grid tomorrow.

**Roadmap:**
1. Federate ISO-NE → NYISO → PJM → MISO → CAISO
2. Formal verification of curtailment SLAs (cryptographic settlements)
3. DoD priority-load API (AFCEC / NAVFAC)
4. Carbon-aware co-optimization

**Ask:** *Pilot — one ISO + one hyperscaler + one DoD installation. Six weeks.*

---

<!-- _class: lead -->
<!-- _paginate: false -->

# We built the operating layer.

github.com/jg435/Team-GridView

team gridview · Jayesh Gupta · SCSP Hackathon 2026
