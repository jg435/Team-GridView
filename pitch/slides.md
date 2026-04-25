# GridParley — Pitch Deck

> Source for `pitch/slides.pdf`. Build with: any markdown-to-slides tool (Marp, Slidev, Reveal.js).
> 5-minute slot total: ~3 min demo + 2 min pitch. Slides 1, 5, 6 only show during pitch portion.

---

## Slide 1 — Hook

**Title:** Grid-Aware AI Agents for Data-Center Curtailment

**Body:**
- US data center load: +22% in 2025, projected to triple by 2030
- ISO-NE has the tightest reserve margins in the country
- 14M people, Hanscom AFB, Mass General, Boston Children's, all on the same grid

**Footer:** _Boston · SCSP Hackathon 2026 · Electric Grid Optimization_

---

## Slide 2 — The policy gap

**Title:** FERC just ordered the rules. Nobody built the system.

**Body:**
- December 2025: FERC directs PJM to create a *Non-Firm Contract Demand Transmission Service*
- Interruptible service for AI co-located loads during grid emergencies
- PJM briefs due Feb 16 2026
- Same gap exists in ISO-NE, NYISO, MISO, CAISO

**Visual:** Timeline of FERC order → operating gap → GridParley fills the gap

---

## Slide 3 — What we built (live demo here)

**[LIVE DEMO — 3 minutes]**

- 0:00–0:30  Hook + map of New England with priority loads pinned
- 0:30–1:15  Run Baseline → freq plunges, brownout
- 1:15–3:15  Run GridParley → ISO requests, DC bad-bid, **validator catches the trap**, DC self-corrects, freq recovers
- 3:15–3:45  Side-by-side recap

**Hero moment:** judges see the LLM make a mistake (proposes shedding a hospital's UPS load) and watch a deterministic policy gate catch it and force a self-correction.

---

## Slide 4 — Architecture (hybrid)

**Title:** Generative negotiation, deterministic safety

**Three layers:**
- **LLMs (Claude × 2):** ISO operator + DC fleet ops. Tool-use enforced. Talk in English so any operator can audit.
- **Validator (rules engine):** Priority loads (Hanscom, hospitals) inviolable. ISO-NE Reliability Standard 7.4. Every tool call checked.
- **Grid model:** Phenomenological frequency dynamics. Real EIA-930 ISO-NE data, June 2024 heat dome.

**Why hybrid wins:** Pure-LLM is unsafe. Pure-rules can't negotiate. Together = production-grade.

---

## Slide 5 — Who we're building for

**Three users, three pains, three features:**

- **Maya — ISO-NE control-room operator.** Sub-minute decisions, opaque flexible loads. → Structured negotiation channel + decision log.
- **Raj — hyperscaler fleet ops manager.** SLA-driven, hates manual curtailment calls. → Programmatic tool-use API.
- **Col. Davis — Hanscom AFB installation energy manager.** Brownouts threaten mission readiness. → Priority loads as first-class constraints.

---

## Slide 6 — National impact + roadmap

**Title:** Same problem in every ISO. We start in Boston, scale national.

**Map:** ISO-NE pilot today → NYISO → PJM (the FERC order region) → MISO → CAISO.

**Roadmap:**
1. Multi-region federation
2. Formal verification of curtailment SLAs (cryptographic settlements)
3. DoD priority-load API (AFCEC/NAVFAC integration)
4. Carbon-aware co-optimization

**Ask:** Pilot deployment with one ISO + one hyperscaler + one DoD installation. 6 weeks.

---

## Demo run-of-show (cheat sheet)

| Time | Action | What you say |
|---|---|---|
| 0:00 | Show map slide 1 | "June 20 2024. Heat dome. Boston." |
| 0:15 | Open dashboard | "Real ISO-NE data. Real protected loads." |
| 0:30 | Click Run Baseline | "Without coordination — frequency drops, brownout flashes." |
| 1:00 | Reset | "Now imagine the same day with our agents." |
| 1:15 | Click Run with GridParley | "ISO requests 240 MW shed. Watch the chat." |
| 1:45 | Validator REJECTED appears | "**The validator caught the LLM** — it tried to shed a hospital's UPS load." |
| 2:15 | DC revises | "Self-corrected. Training-pool only." |
| 2:45 | Frequency recovers | "Hanscom AFB: green. Mass General: green. Brownout averted." |
| 3:00 | Slide 4 (architecture) | "How: generative negotiation, deterministic safety." |
| 3:30 | Slide 5 (users) | "Maya, Raj, Col. Davis. Three users, three wins." |
| 4:00 | Slide 6 (roadmap) | "FERC order PJM today, every ISO tomorrow." |
| 4:30 | Closing line | "We built the operating layer. Six weeks to pilot." |
| 5:00 | Done | _bow_ |
