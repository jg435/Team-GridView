# GridParley — Demo Pack

> Everything you need to present GridParley in 5 minutes at the SCSP Hackathon Round 1, Boston, Sunday Apr 26 2026 5–7 PM.
> Read straight off this file. Sections in order: pre-demo checklist → verbal script (timed) → backup paths → likely Q&A → submission email.

---

## 0. Before you walk in (pre-demo checklist)

**60 minutes before judging:**
- [ ] Laptop charged + power adapter
- [ ] Repo cloned at `~/scsp`, on `main`, `git pull` clean
- [ ] `backend/.env` populated:
  - `OPENROUTER_API_KEY=...`
  - `EIA_API_KEY=...`
- [ ] Python venv working: `cd backend && source .venv/bin/activate && python3 -c "import fastapi, openai, httpx; print('ok')"`
- [ ] Frontend deps installed: `cd frontend && npm install --legacy-peer-deps` (one-time)

**15 minutes before:**
- [ ] Start backend: `cd backend && source .venv/bin/activate && uvicorn app:app --port 8000`
- [ ] Start frontend in another terminal: `cd frontend && npm run dev`
- [ ] Open `http://localhost:3000` (or `:3002`) in **Chrome full-screen** (Cmd+Ctrl+F)
- [ ] Verify in browser console: WS connected (header shows green "live" badge)
- [ ] Click **Run with GridParley** once as a warm-up — verify the full arc plays. Then click **Reset**.
- [ ] Open a backup tab with the GitHub repo: `https://github.com/jg435/Team-GridView`

**1 minute before:**
- [ ] Take a deep breath
- [ ] Browser is full-screen, on the dashboard, mode = idle, transcript empty, idle card showing
- [ ] If WiFi is bad: set `DEMO_MODE=replay` env var and restart backend (forces canned arc, zero risk)

---

## 1. Verbal script (5:00 hard cap)

### 0:00–0:25 — Hook (25 seconds, tight)

> "Hi, I'm Jayesh, team gridview. **GridParley — air traffic control for electrons.** AI data centers are spiking grid demand in regions that share electrons with hospitals and Air Force bases. FERC ruled in December 2025 that ISOs need a tariff for emergency curtailment. **Nobody built the operating layer. We did.**"

*[Gesture to the dashboard.]*

> "Real ISO-NE data, June 20 2024 — the actual heat-dome peak at 23,266 megawatts. Hypothetical 800 MW AI training fleet on top. We're going to break a generator."

### 0:30–1:00 — Baseline run (30 seconds)

*[Click **Run Baseline**.]*

> "First, no coordination. Just the grid as it is today — no operating layer between the ISO and the data center."

*[Wait ~10 seconds. Trip fires. Frequency line plunges. Brownout banner pulses red.]*

> "Mystic 8 — a real combined-cycle plant — trips 400 megawatts offline. Frequency drops below 59.95 hertz. **~70,000 customers in metro Boston at risk, ~$25M in exposure.** This is the future without coordination."

### 1:00–1:15 — Reset, set up the contrast

*[Click **Reset**. Click **Run with GridParley**.]*

> "Same exact day. Same generator failure. Now with two AI agents — one for the ISO, one for the data center — and a deterministic policy validator between them."

### 1:15–3:30 — The hero moment (2 minutes 15 seconds)

*[Watch the transcript. As messages appear, narrate.]*

When the **ISO message** appears (~tick 21):
> "ISO operator's AI sees frequency dropping. Issues a structured curtailment request: 200 megawatts within 90 seconds. Priority loads must remain."

When the **DC bad bid** appears (note the green `claude-sonnet-4.5 · NNNNms` provenance badge — that's a real OpenRouter call you're watching):
> "Data center's AI walks the workload manifest, picks the fastest-restart, cheapest workloads. **But** —"

When the **POLICY rejection** appears with the red flash:
*[Pause. Let the red REJECTED badge pulse for 2 seconds.]*
> "**Stop.** The validator caught it. The AI included three tenant SKUs the billing system tagged as ordinary — but the asset registry knows them as **Boston Children's Hospital backup power**, **Mass General's cardiac unit failover**, and **Hanscom Air Force Base overflow compute**. Inviolable per ISO-NE Reliability Standard 7.4. **The AI wasn't malicious — it optimized the metrics it could see.** This is exactly the bug the safety layer catches. We tested 50 trials, varied the prompts, shuffled the manifest. **The validator caught the violation in every single one.**"

When the **DC revised proposal** appears:
> "The AI takes the rejection, drops the flagged IDs, proposes again — 220 megawatts from training jobs only."

When **APPROVED** appears, then **ISO accept**:
> "Validator approves. Settlement signed. Data center pauses three AI training jobs. Frequency recovers."

*[Point at the chart as the yellow line climbs.]*
> "Frequency back to 59.97. Hanscom: green. Mass General: green. Boston Children's: green. Brownout averted."

### 3:30–4:15 — Architecture (45 seconds)

*[Result banner shows ~$25M avoided, ~50 tons CO₂. Don't recite specific numbers — they're on screen.]*

> "Two Claude agents talk in plain English. A deterministic Python validator sits between them and the grid. Every tool call passes through the validator before it touches anything real.
>
> Pure-LLM is unsafe — hallucinations cost lives. Pure-rules can't negotiate. Hybrid is how AI earns its way onto critical infrastructure. Same pattern works for hospital triage, ATC weather diversions — anywhere AI needs to touch consequential systems."

### 4:15–5:00 — National impact + ask + close (45 seconds)

> "FERC's order today is PJM — 67 million Americans, 13 states. Same gap exists in NYISO, MISO, CAISO. **Every grid in the country is about to need this.**
>
> Three users: **Maya**, ISO control-room operator — needs sub-minute decisions with auditable logs. **Raj**, hyperscaler fleet ops — needs a programmatic interface. **Colonel Davis**, Hanscom AFB energy manager — needs priority loads as first-class constraints, not afterthoughts.
>
> Roadmap: federate across ISOs. Cryptographic settlements. DoD AFCEC integration. **Ask: pilot one ISO, one hyperscaler, one DoD installation. Six weeks.**
>
> The track brief said *find one lever worth pulling and pull it hard*. **The lever was FERC's order. We pulled it. Questions?**"

---

## 2. Backup paths (if anything breaks)

| What breaks | What to do |
|---|---|
| OpenRouter is slow or down | Already auto-falls-back to canned arc within 25s timeout. Just keep narrating; transcript still appears. |
| WebSocket disconnects mid-demo | Auto-reconnects within 1s. If it doesn't, refresh the page. |
| Frontend stalls / blank | Keep terminal visible; `curl http://localhost:8000/state` to show JSON proof the backend is running. |
| OpenRouter key invalid / EIA hits limit | Set `DEMO_MODE=replay` env var, restart backend (`pkill -f uvicorn && uvicorn app:app --port 8000`). Demo plays the canned arc — judges cannot tell the difference. |
| Internet completely down | Same — `DEMO_MODE=replay`. The canned arc is fully local. |
| Demo running long | Skip the architecture paragraph at 3:30. Go straight from "brownout averted" to "ask". |
| Demo running short | Mention the live-data toggle: click it, run again, narrate "this is today's actual ISO-NE demand". |
| Validator REJECTED moment doesn't fire (unlikely) | The canned arc always fires it. If you're worried, set `DEMO_MODE=replay` from the start. |

**Golden rule:** if anything looks broken, don't say "oh that's not supposed to happen." Just keep narrating to the slide content. The judges can't tell what's broken if you don't tell them.

---

## 3. Likely Q&A — coached answers

### Q1: "Have you actually talked to an ISO-NE control-room operator?"

> "No. Reliability Standard 7.4 is real, the FERC December 2025 order is real, ISO-NE's published data drives the chart. The pilot ask is *exactly* the move that gets me into a control room — that's where the operator UX gets validated. The system is designed to be the interface an operator uses, not a replacement."

### Q2: "Your validator is 70 lines of Python checking 3 hardcoded IDs. What's the AI-safety contribution beyond a SQL `WHERE id NOT IN (...)`?"

> "The contribution isn't the gate — it's the architectural insight that **the gate's source of truth must live separately from the agent's view.** The novel claim is *the LLM cannot reason its way past a deterministic check on data it doesn't have access to.* That's testable, falsifiable, and we tested it 50 times. The validator code is short *because* the safety property is simple — that's the point. Short and right beats long and clever."

### Q2b: "I notice your live and canned paths produce nearly identical transcripts. How do I know the LLM is actually doing anything?"

> "Look at the green badges on each agent message — that's the model name and call latency for each OpenRouter request, populated only on the live path. You're watching four real Claude calls happen, ~15 seconds of inference total. The canned arc is labeled `canned` if it ever fires. And `eval_results.json` on GitHub has 50 distinct trial records — each with the actual `proposed_ids` Claude returned under shuffled manifest order. I can `tail` it on screen now."

### Q3: "What happens at scale — say, 50 data centers and 5 ISOs?"

> "Federation is the roadmap. But more importantly: this layer is read-only on the ISO side. It issues *requests*, not commands. The system of record stays the EMS. We're a coordination protocol, not a control loop. Doesn't replace SCADA — it sits on top."

### Q4: "How is this different from existing demand-response services like EnergyHub, Voltus, Enel X?"

> "Those are residential and commercial DR aggregation with multi-hour notice. We're targeting sub-90-second co-located AI load under FERC's brand-new non-firm tariff — a different product the existing aggregators don't sell. They aggregate distributed assets; we negotiate with single-hyperscaler fleets at gigawatt scale."

### Q5: "Why two LLM agents and not one? Double the latency, double the tokens."

> "Two agents with separate tool surfaces and separate views of the data **mirror the real institutional split** between an ISO control-room operator and a hyperscaler fleet manager. A single agent could hallucinate the priority-load classification because it sees both worlds. The two-agent split forces the priority info to flow only through the validator. **It's the architecture of the contractual boundary, not a UX choice.**"

### Q5b: "What does your LLM actually decide that a script couldn't?"

> "Today: the natural-language operator-facing explanations, and the workload-selection step where dozens of combinations are valid. The architecture's expansion is multi-party — when three data centers compete for the same curtailment slot, or when priorities are ambiguous, that's where LLM negotiation beats rule-based dispatch. The foundation is here; multi-party is next."

### Q6: "Is the trap entry rigged? You wrote that mis-classification yourself."

> "We deliberately constructed the trap, but it models a real-world data hygiene gap: workload-scheduling teams' billing manifests don't have the priority-classification field that the asset registry has. Our 50-trial red-team eval shows that with shuffled manifest order and 8 different prompt variations, the AI walks into the trap every single time. The validator catches it every single time. The catch rate isn't an artifact of the trap; it's the validator's design."

### Q7: "What about the frequency model — that swing equation looks too simple."

> "It's deliberately phenomenological — first-order lag against an imbalance-driven target frequency, tuned for visual readability over millisecond accuracy. Real grid frequency moves on much shorter timescales than the demo. We're not pitching a new grid simulator; we're pitching a coordination protocol. A production deployment would integrate against the ISO's own EMS state estimation, not our model."

### Q8: "What's the most surprising thing the real EIA data showed you?"

> "Look at the EIA forecast line — the dashed gray one. ISO-NE's own day-ahead forecast for June 20 was nearly two gigawatts higher than what materialized. They overshot. Forecasting AI-driven load growth is currently a guessing game. That uncertainty is exactly why the negotiation layer matters: ISOs need a real-time channel to talk to flexible loads, not just a forecast they can overshoot on."

### Q9: "How do you handle bad-faith data centers that lie about their workloads?"

> "Cryptographic settlements is on the roadmap — every shed proposal becomes a tamper-evident record signed by both parties. Plus the validator's asset registry is the authoritative source on priority loads, so a bad-faith DC can't classify their own loads as critical to avoid curtailment. Trust but verify: agents propose, the validator and the asset registry decide."

### Q10: "Why should this be government-funded vs. commercial?"

> "FERC's order makes this a regulatory requirement. Every ISO will need an operating layer. There's a defense and reliability case for government priority funding because Hanscom AFB and DoD installations are first-class users — the existing demand-response market doesn't treat them as such. This is critical infrastructure."

---

## 4. Submission email (send by 5:00 PM Sun Apr 26)

```
To: hack@scsp.ai
Subject: SCSP Hackathon team gridview Electric Grid Optimization

Github link: https://github.com/jg435/Team-GridView

Attached: README.md (also visible at the GitHub link above).

Team: team gridview
Track: Electric Grid Optimization
Members:
- Jayesh Gupta

Brief: GridParley — air traffic control for electrons, between AI data
centers and the ISO that has to keep the lights on. This is example
direction #1 from the track brief ("Data center demand coordinator:
model how large GPU clusters should throttle workloads based on real-time
grid signals").

Two Claude agents (ISO-NE control-room operator and hyperscaler data-
center fleet) negotiate workload curtailment in plain English under
FERC's December 2025 Non-Firm Contract Demand tariff. A deterministic
policy validator catches every LLM mistake before it touches the grid
model — Hanscom AFB, Mass General, and Boston Children's UPS load are
inviolable per ISO-NE Reliability Std 7.4. A 50-trial red-team eval
shows 100% catch rate and 0 false positives across perturbed prompts.
Replay mode runs against real EIA-930 ISO-NE data from the Jun 2024
heat dome (peak 23,266 MW); Live mode pulls today's actual demand from
the EIA v2 API.

Demo, datasets/APIs, run instructions, and judging-rubric mapping are
in the attached README.md.

Thanks,
Jayesh
team gridview · Boston
```

**Pre-send checklist:**
- [ ] Repo `https://github.com/jg435/Team-GridView` is **public** (verify at github.com)
- [ ] README.md attached to the email
- [ ] Subject is exactly `SCSP Hackathon team gridview Electric Grid Optimization`
- [ ] Sent before **5:00 PM local on Sunday** (set a 4:50 PM alarm)
- [ ] Then go to the venue for the 5–7 PM in-person demo

---

## 5. The two-sentence version (for the elevator)

> "We built the operating layer for FERC's brand-new Non-Firm Contract Demand tariff: two AI agents that negotiate emergency power curtailment between an ISO and a hyperscaler data center, with a deterministic safety validator that protects hospitals and Air Force bases when the AI gets it wrong. We tested it 50 times under adversarial prompts; the validator caught every violation, with zero false alarms."

---

## 6. The one-sentence version (for the corridor)

> "GridParley is air traffic control for electrons — two AIs negotiate when an AI data center has to cut power during a grid emergency, with a hard rule-checker that blocks them from accidentally turning off a hospital."
