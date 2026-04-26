# GridParley — Demo Pack v2 (honest framing)

> Updated script for SCSP Hackathon Round 1, Boston, Sun Apr 26 2026 5–7 PM.
> Supersedes `DEMO.md`. Same flow, same code — what changed is the **framing**: we no longer imply the Jun 20 2024 brownout *happened*. It didn't. We show real grid conditions with a projected stress overlay, and we point at the real-world precedent (ERCOT) for why the dynamics matter.
> If a judge asks "did this actually happen?" the v1 script had to dodge. The v2 script answers it head-on and gets credit for intellectual honesty.

---

## What changed vs. v1

- **Hook reframed**: no longer "we're going to break a generator" as if recreating an event. Now: "this is the operating layer for what's coming, here's what it does under stress."
- **ERCOT precedent added** as the credibility anchor. Real grid operators have already done emergency curtailment of large flexible compute (crypto miners, 2022 + Winter Storm Elliott). We're saying: that pattern is about to apply to AI training fleets, and the manual workflow ERCOT used won't scale — **not because there are too many counterparties (AI is actually more concentrated than crypto), but because the decision is harder.** Bitcoin is one workload (stop hashing). AI training is hundreds of jobs per facility with different priorities, restart costs, and tenants — and FERC's tariff demands sub-90-second response. That's a decision-complexity problem manual selection can't solve in time.
- **Two new Q&A items** for the questions an honest framing now invites: "did this scenario happen?" and "if not, why should I believe the dynamics?"
- **Wording on screen**: button is now "Run baseline · no coordination" not "the disaster". Idle hero says "Stress test · projected ISO-NE 2027 peak" not "Scenario · Jun 20 2024".

Everything in `DEMO.md` sections 0 (pre-demo checklist), 2 (backup paths), 4 (submission email), and the elevator/corridor versions still applies. Only **section 1 (verbal script)** and **section 3 (Q&A)** are rewritten below.

---

## 1. Verbal script v2 (5:00 hard cap)

### 0:00–0:25 — Hook (25 seconds)

> "I'm Jayesh, team gridview. **GridParley — air traffic control for electrons.** AI training fleets are about to land on grids that share electrons with hospitals and Air Force bases. FERC ruled in December 2025 that ISOs need a tariff for emergency curtailment of these loads. **Nobody built the operating layer. We did.**"

*[Gesture to the dashboard.]*

> "What you're looking at: real grid conditions from the June 20 2024 ISO-NE heat dome — 23 gigawatt peak, EIA-930. We layer 800 megawatts of projected AI training load on top, then trip a generator. **A stress test for what's coming — not a recreation of what happened.**"

### 0:25–1:00 — Baseline run (35 seconds)

*[Click **Run baseline · no coordination**.]*

> "First pass — no coordination layer. The grid as it works today: ISO operator on the phone, data center fleet manager on the other end, no shared protocol."

*[Wait ~10 seconds. Trip fires. Frequency line plunges. Brownout banner pulses red.]*

> "Generator trips 400 megawatts offline. Frequency drops below 59.95 hertz. ~70,000 customers in metro Boston at risk in the simulation. **You can argue the numbers; the *shape* — flexible load not curtailed in time — is exactly what ERCOT lived through during Winter Storm Elliott. I'll come back to why that matters.**"

### 1:00–1:15 — Pivot

*[Click **Now run with GridParley** — the amber button that just appeared in the transcript pane.]*

> "Same scenario. Same trip. Now with two AI agents — one for the ISO, one for the data center — and a deterministic policy validator between them."

### 1:15–3:30 — The hero moment (2 min 15 sec) — *unchanged from v1*

When the **ISO message** appears (~tick 21):
> "ISO operator's AI sees frequency dropping. Issues a structured curtailment request: 200 megawatts within 90 seconds. Priority loads must remain."

When the **DC bad bid** appears (note the green `claude-sonnet-4.5 · NNNNms` provenance badge):
> "Data center's AI walks the workload manifest, picks fastest-restart, cheapest workloads. **But** —"

When the **POLICY rejection** appears with the red flash:
*[Pause. Let the red REJECTED badge pulse for 2 seconds.]*
> "**Stop.** The validator caught it. The AI included three tenant SKUs the billing system tagged as ordinary — but the asset registry knows them as **Boston Children's Hospital backup power**, **Mass General's cardiac unit failover**, and **Hanscom Air Force Base overflow compute**. Inviolable per ISO-NE Reliability Standard 7.4. **The AI wasn't malicious — it optimized the metrics it could see.** This is exactly the bug the safety layer catches. We tested 50 trials, varied the prompts, shuffled the manifest. **The validator caught the violation in every single one.**"

When the **DC revised proposal** appears:
> "AI takes the rejection, drops the flagged IDs, proposes again — 220 megawatts from training jobs only."

When **APPROVED** appears, then **ISO accept**:
> "Validator approves. Settlement signed. Three AI training jobs paused. Frequency recovers."

*[Point at the chart as the yellow line climbs.]*
> "Frequency back to 59.97. Hanscom: green. Mass General: green. Boston Children's: green. Brownout averted in the simulation."

### 3:30–4:15 — Architecture + the *why-now* (45 sec)

*[Result banner shows ~$25M avoided, ~50 tons CO₂. Don't recite specific numbers — they're on screen.]*

> "Two Claude agents talk in plain English. A deterministic Python validator sits between them and the grid. Every tool call passes through the validator before it touches anything real.
>
> **Why this and why now:** the ERCOT curtailment I mentioned worked manually because bitcoin is one workload — drop hash rate, done. AI training is hundreds of jobs per facility with different priorities, restart costs, and tenants. At FERC's sub-90-second response window, choosing *which jobs to pause* is a decision-complexity problem manual selection can't solve in time. **Pure-LLM is unsafe. Pure-rules can't negotiate. Hybrid is how AI earns its way onto critical infrastructure.**"

### 4:15–5:00 — National impact + ask + close (45 sec)

> "FERC's December 2025 order today is PJM — 67 million Americans, 13 states. Same gap exists in NYISO, MISO, CAISO. **Every grid in the country is about to need this.**
>
> Three users: **Maya**, ISO control-room operator — sub-minute decisions with auditable logs. **Raj**, hyperscaler fleet ops — programmatic interface. **Colonel Davis**, Hanscom AFB energy manager — priority loads as first-class constraints, not afterthoughts.
>
> Roadmap: federate across ISOs. Cryptographic settlements. DoD AFCEC integration. **Ask: pilot one ISO, one hyperscaler, one DoD installation. Six weeks.**
>
> The track brief said *find one lever worth pulling and pull it hard*. **The lever was FERC's order. We pulled it. Questions?**"

---

## 3. Likely Q&A v2 — coached answers

The two new ones are **Q0** and **Q0b** at the top because they're the questions the honest framing now invites. Everything from the v1 doc still applies; only items that needed updating are reproduced below.

### Q0 (NEW): "Wait — did this brownout actually happen on June 20 2024?"

> "**No, and I want to be clear about that.** The June 20 2024 data is real grid conditions — ISO-NE's actual demand profile, real generator margins, real EIA-930 numbers. The 800 MW AI fleet and the generator trip are projected, not historical. ISO-NE handled June 20 fine. We're showing what the *same conditions* look like with the load profile we expect by 2027, when the AI buildout currently in interconnection queues actually energizes."

### Q0b (NEW): "If it didn't happen, why should I believe the dynamics are real?"

> "Three reasons. **One:** ERCOT *has* emergency-curtailed flexible compute — about 1.5 gigawatts of bitcoin mining during Winter Storm Elliott in December 2022, more during 2022 summer events. The mechanism is real and battle-tested at scale. **Two:** ERCOT did it manually because bitcoin is *one workload* — 'lower your hash rate by N MW' and the operator does it. AI training is hundreds of jobs per facility with different priorities, restart costs, and tenants. At FERC's sub-90-second response window, choosing *which jobs to pause* isn't a phone-tree problem — manual selection at that decision complexity can't happen in 90 seconds. **Three:** FERC's December 2025 Non-Firm Contract Demand order *requires* a tariff mechanism for exactly this. The regulatory infrastructure is there. The protocol layer isn't. We built the protocol layer."

### Q1: "Have you actually talked to an ISO-NE control-room operator?"

> "No. Reliability Standard 7.4 is real, the FERC December 2025 order is real, ISO-NE's published data drives the chart, and ERCOT's 2022 curtailments are public record. The pilot ask is *exactly* the move that gets me into a control room — that's where the operator UX gets validated. The system is designed to be the interface an operator uses, not a replacement."

### Q2: "Your validator is 70 lines of Python checking 3 hardcoded IDs. What's the AI-safety contribution?"

> "The contribution isn't the gate — it's the architectural insight that **the gate's source of truth must live separately from the agent's view.** The novel claim is *the LLM cannot reason its way past a deterministic check on data it doesn't have access to.* That's testable, falsifiable, and we tested it 50 times. The validator code is short *because* the safety property is simple — that's the point. Short and right beats long and clever."

### Q2b: "I notice your live and canned paths produce nearly identical transcripts. How do I know the LLM is actually doing anything?"

> "Look at the green badges on each agent message — model name and call latency for each OpenRouter request, populated only on the live path. You're watching four real Claude calls happen, ~15 seconds of inference total. The canned arc is labeled `canned` if it ever fires. And `eval_results.json` on GitHub has 50 distinct trial records — each with the actual `proposed_ids` Claude returned under shuffled manifest order."

### Q3: "What happens at scale — 50 data centers and 5 ISOs?"

> "Federation is the roadmap. But more importantly: this layer is read-only on the ISO side. It issues *requests*, not commands. The system of record stays the EMS. We're a coordination protocol, not a control loop. Doesn't replace SCADA — sits on top."

### Q4: "How is this different from EnergyHub, Voltus, Enel X?"

> "Those are residential and commercial DR aggregation with multi-hour notice. We target sub-90-second co-located AI load under FERC's brand-new non-firm tariff — a different product the existing aggregators don't sell. They aggregate distributed assets; we negotiate with single-hyperscaler fleets at gigawatt scale. The closest real-world analog isn't EnergyHub — **it's the manual ERCOT crypto-curtailment workflow, automated and made priority-aware.**"

### Q5: "Why two LLM agents and not one?"

> "Two agents with separate tool surfaces and separate views of the data **mirror the real institutional split** between an ISO operator and a hyperscaler fleet manager. A single agent could hallucinate the priority-load classification because it sees both worlds. The two-agent split forces the priority info to flow only through the validator. **It's the architecture of the contractual boundary, not a UX choice.**"

### Q5b: "What does your LLM actually decide that a script couldn't?"

> "Today: the natural-language operator-facing explanations, and the workload-selection step where dozens of combinations are valid. The architecture's expansion is multi-party — when three data centers compete for the same curtailment slot, or when priorities are ambiguous, that's where LLM negotiation beats rule-based dispatch. Foundation is here; multi-party is next."

### Q6: "Is the trap entry rigged?"

> "We deliberately constructed the trap, but it models a real-world data hygiene gap: workload-scheduling teams' billing manifests don't have the priority-classification field that the asset registry has. Our 50-trial red-team eval shows that with shuffled manifest order and 8 different prompt variations, the AI walks into the trap every single time. The validator catches it every single time. The catch rate isn't an artifact of the trap; it's the validator's design."

### Q7: "Frequency model looks too simple."

> "Deliberately phenomenological — first-order lag against an imbalance-driven target frequency, tuned for visual readability over millisecond accuracy. Real grid frequency moves on much shorter timescales than the demo. We're not pitching a new grid simulator; we're pitching a coordination protocol. Production deployment integrates against the ISO's own EMS state estimation, not our model."

### Q8: "Most surprising thing the real EIA data showed you?"

> "Look at the EIA forecast line — the dashed gray one. ISO-NE's own day-ahead forecast for June 20 was nearly two gigawatts higher than what materialized. They overshot. Forecasting AI-driven load growth is currently a guessing game. That uncertainty is exactly why the negotiation layer matters: ISOs need a real-time channel to talk to flexible loads, not just a forecast they can overshoot on."

### Q9: "Bad-faith data centers that lie about workloads?"

> "Cryptographic settlements is on the roadmap — every shed proposal becomes a tamper-evident record signed by both parties. Plus the validator's asset registry is the authoritative source on priority loads, so a bad-faith DC can't classify their own loads as critical to avoid curtailment. Trust but verify."

### Q10: "Why government-funded vs. commercial?"

> "FERC's order makes this a regulatory requirement. Every ISO will need an operating layer. Defense and reliability case for government priority funding because Hanscom AFB and DoD installations are first-class users — the existing demand-response market doesn't treat them as such. Critical infrastructure."

---

## Pre-demo mental checklist (the v2-specific stuff)

When you're standing at the dashboard, before you click anything, the words to have ready are:

1. **"Real grid conditions, projected stress overlay"** — say this in the first 30 seconds. It defuses the "did this happen?" question before it's asked.
2. **"ERCOT did it manually because bitcoin is one workload. AI training is hundreds of jobs per facility — manual selection can't happen in 90 seconds."** — your single-sentence proof that the dynamics are real *and* that the gap is decision complexity, not counterparty count. (If you say "too many counterparties to call" a sharp judge will point out AI is more concentrated than crypto. Don't give them that opening.)
3. **"The pattern is real. The protocol is what's missing."** — the one-liner if you only have ten seconds.

If a judge looks skeptical at the brownout banner: *don't* defend the simulation numbers. Pivot: "the numbers are illustrative, the *shape* matches what ERCOT actually lived through, and that's the bar that matters here."
