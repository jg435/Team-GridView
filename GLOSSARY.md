# GridParley — Domain Glossary

> Short definitions of every term you'll hear or say during the demo. Built for someone with no grid/energy background. Skim before walking in; reference during Q&A.
>
> Terms marked **[demo-specific]** are particular to this project. Terms marked **[real]** are real industry terms or events you should be ready to defend.

---

## 1. Grid operations basics

**Grid** — The physical network of power plants, transmission lines, and customers that delivers electricity. The grid only works if **supply equals demand at every instant**. Mismatches show up as frequency drift.

**Frequency (Hz, hertz)** **[real]** — The rate at which the grid's AC power oscillates. North American target is **60.000 Hz**. Below 59.95 = caution. Below 59.50 = automatic load shedding kicks in. **Frequency is the heartbeat — when it dips, the grid is short on supply.**

**Base load** — The minimum demand on the grid (e.g., always-on residential refrigerators, hospital lighting, etc).

**Peak load** — The maximum demand on a given day, usually late afternoon on hot days when AC + offices + industry all overlap.

**Demand (MW / GW)** — How much power customers are pulling right now. **MW = megawatt = 1,000 kilowatts. GW = gigawatt = 1,000 MW.** ISO-NE total demand is typically 12–25 GW.

**Reserve margin / capacity headroom** **[real]** — The buffer between *available* generation and *current* demand, expressed as %. ~15% is comfortable, <10% is tight, <5% is danger.

**Generator trip** **[real]** — When a power plant suddenly goes offline (mechanical fault, grid disturbance, etc). Causes an instantaneous shortfall in supply → frequency drops.

**Mystic 8** **[real plant, hypothetical trip in this demo]** — A 400 MW combined-cycle gas plant in Everett, MA. We use it as the generator that "trips" in the demo because it's a real, recognizable ISO-NE asset. **In real life, it didn't trip on June 20 2024.**

---

## 2. When things go wrong

**Brownout** **[real]** — A partial power loss — voltage sags or selective shut-offs, but the lights aren't fully out. Usually caused by undersupply.

**Blackout** **[real]** — Full power loss in a region.

**UFLS — Under Frequency Load Shedding** **[real]** — An *automatic* protective action: when frequency drops below a threshold (typically 59.5 Hz), pre-designated chunks of customer load get cut off automatically to rebalance supply and demand. **This is what happens to ~70K Boston customers in our baseline simulation.** UFLS is a last resort — it's blunt, it cuts off whoever's on the wrong feeder, and the grid operator can't choose who.

**Load shedding** **[real]** — Cutting off customer demand to balance the grid. Can be automatic (UFLS) or coordinated (demand response).

**Curtailment** **[real]** — Asking a customer (usually a large industrial or commercial one) to *voluntarily* reduce their consumption. The polite, planned version of load shedding.

---

## 3. The actors (acronym soup)

**ISO — Independent System Operator** **[real]** — A nonprofit entity that runs a regional grid. They're the air traffic control: matching supply to demand, scheduling generators, dispatching reserves. They don't own the wires.

**ISO-NE** **[real]** — The ISO for the six New England states (CT, ME, MA, NH, RI, VT). Based in Holyoke, MA. Our demo is set in their territory.

**Other ISOs you might be asked about** **[real]**:
- **PJM** — Mid-Atlantic + Midwest, 67M customers, 13 states. Largest ISO in the US. Where FERC's Dec 2025 NFCD order applies first.
- **ERCOT** — Texas. The one that emergency-curtailed bitcoin miners in 2022. Notorious for being its own electrical island.
- **CAISO** — California.
- **MISO** — Midwest (different geography from PJM, despite the name overlap).
- **NYISO** — New York.

**EMS — Energy Management System** **[real]** — The actual SCADA-grade software an ISO uses to run the grid. We are *not* one of these; we sit on top of one.

**SCADA — Supervisory Control And Data Acquisition** **[real]** — The real-time data layer ISOs use to see and control grid hardware. Sub-second latency. Built in the 1970s, evolved since.

**FERC — Federal Energy Regulatory Commission** **[real]** — The federal regulator for interstate electricity (and natural gas). When FERC issues an order, ISOs have to comply.

**EIA — Energy Information Administration** **[real]** — The US government agency that publishes grid statistics. Source of our June 20 2024 dataset.

**EIA-930** **[real dataset]** — Specifically, EIA's hourly grid-monitoring dataset. Demand, generation, interchange, by balancing authority. Public, free, comes through an API. **This is the actual data driving our chart.**

---

## 4. The new regulatory frame

**Tariff** **[real]** — In utility-speak, a tariff is a contract structure (rates, obligations, terms) between an ISO and a market participant. *Not* a tax. When FERC "approves a tariff," they're approving the contract template.

**NFCD — Non-Firm Contract Demand** **[real, our pitch's regulatory anchor]** — A new tariff structure FERC ordered in December 2025 (in this universe). The idea: large flexible loads (data centers, etc.) sign contracts that say "we get cheaper power, and in exchange the ISO can curtail us within 90 seconds during emergencies." **This is the gap we built the protocol layer for.**

**Reliability Standard 7.4** **[demo-specific framing of a real concept]** — In the demo, we cite this as the ISO-NE policy that makes hospitals, defense bases, etc. inviolable from curtailment. In reality, NERC (the reliability council) has standards governing how priority loads are protected — we abstract that as "7.4" for narrative cleanliness.

**Interconnection queue** **[real]** — The list of new generators or large loads waiting to connect to the grid. ISOs publish these. **PJM, ISO-NE, and ERCOT all currently have multi-gigawatt data center requests in their queues** — that's where the AI buildout is visible before it goes live.

---

## 5. Data centers and AI compute

**Data center** — A building full of servers. In our context: a single facility consuming hundreds of MW.

**Hyperscaler** **[real]** — The handful of companies running global cloud infrastructure at huge scale: AWS (Amazon), Azure (Microsoft), GCP (Google), Meta, Apple. Plus AI-first ones: Anthropic, OpenAI, xAI.

**Data center fleet** — All the data centers a single hyperscaler operates. Coordinating curtailment means talking to the fleet operator, not individual buildings.

**AI training fleet** — Specifically, the subset of compute running AI model training. Distinct from inference (serving requests to users) — training is *much* more flexible: you can pause and resume jobs from checkpoints, whereas inference must respond in real time.

**Workload** — Anything running on a server. In curtailment-speak, the unit of decision: "which workloads do we pause?"

**Job manifest** **[demo-specific]** — The list of all running workloads at a data center, with their power draw, restart cost, and (in production) priority class. In the demo, this is what the DC agent walks through to pick which to pause.

**Restart cost / checkpoint** — How much work is lost when a training job is paused. A job that just hit a checkpoint = cheap to pause. A job 50% through a $10M run since the last checkpoint = expensive.

**Tenant** — A customer renting compute capacity inside a hyperscaler's data center. Microsoft Azure may operate the building, but OpenAI runs the workload — those are different parties. **Important for curtailment: the operator doesn't always own the workload they're hosting.**

**Co-located load** **[real]** — A large customer (data center, crypto miner) that physically locates on the grid right next to the generation, often to skip transmission costs. They're tightly coupled to the local grid.

**Behind-the-meter** **[real]** — Generation or storage on the *customer side* of the utility's meter. (E.g., a data center with its own backup batteries.)

---

## 6. Demand response and curtailment

**Demand response (DR)** **[real]** — A program where customers reduce their electricity use in response to grid conditions, usually for a payment or rate discount. The legacy version of what GridParley does.

**Demand response aggregator** **[real]** — Companies like **EnergyHub, Voltus, Enel X** that pool together small customers' DR commitments and sell them as a single product to the ISO. Multi-hour notice typical. **GridParley competes with this category but at sub-90-second timescales for single-hyperscaler fleets — a different product.**

**Flexible load** **[real]** — Any electricity demand that can be temporarily reduced or shifted. Crypto mining, AI training, EV charging, industrial cold storage are all flexible. Hospitals, residential AC at peak, are not.

**Inviolable load** **[demo-specific term]** — A load that must never be curtailed under any circumstances. In our demo: hospitals, the AFB, the children's hospital UPS. The validator's job is to enforce this.

**Priority load** **[real concept, our framing]** — A load with a hard priority ranking. Inviolable is the highest tier; further tiers may be curtailed but only after lower-tier loads.

---

## 7. The ERCOT precedent (your credibility anchor)

**Winter Storm Elliott** **[real]** — A massive December 2022 cold snap that pushed ERCOT (and PJM) to the brink. ERCOT emergency-curtailed roughly **1.5 GW of bitcoin mining load** by manual coordination. **This is your "the dynamics are real" proof point.**

**Bitcoin mining load** **[real]** — Computer hardware running the bitcoin proof-of-work algorithm. Consumes huge amounts of power, can be turned off and on instantly with no recovery cost (unlike AI training). ERCOT has ~3+ GW of it interconnected.

**Large Flexible Load (LFL)** **[real ERCOT term]** — ERCOT's classification for any load >75 MW that can be controlled by the ISO. Mostly bitcoin miners today; AI fleets next.

**Controllable Load Resource (CLR)** **[real ERCOT term]** — A flexible load that's contractually allowed to be curtailed by the operator. The legacy framework GridParley succeeds and improves on.

---

## 8. GridParley itself

**GridParley** **[demo-specific]** — Our project. A coordination protocol — two LLM agents (one ISO-side, one DC-side) negotiate emergency curtailment in plain English, with a deterministic Python validator between them.

**Parley** — Old word meaning a negotiation or discussion between adversaries (originally military, between opposing forces under truce). The pitch: "the ISO and the DC fleet are not adversaries, but they have different objectives — they need to *parley.*"

**ISO agent** **[demo-specific]** — A Claude LLM (via OpenRouter) playing the role of an ISO-NE control room operator. Sees grid telemetry, issues structured curtailment requests.

**DC agent** **[demo-specific]** — A Claude LLM playing the role of a hyperscaler fleet ops engineer. Sees the job manifest, proposes curtailment plans.

**Validator** **[demo-specific]** — The 70-line Python function in `backend/validator.py` that sits between the two agents. **Pure deterministic Python — not an LLM.** Receives the DC agent's proposal, checks it against the asset registry, returns approved or rejected. **The trust boundary in the architecture.**

**Policy / asset registry** **[demo-specific]** — `backend/policy.py`. Holds the source-of-truth list of inviolable IDs and protected loads. **The validator reads from here; the LLM agents do not.** That's why the LLM can't reason its way past the check — it doesn't have the data to.

**Tool call** **[real LLM concept]** — When an LLM emits a structured request to invoke a function (e.g., "propose_curtailment" with arguments). Our agents communicate via tool calls, not free-form text.

**Live vs. canned path** **[demo-specific]** — Live = the transcript came from a real OpenRouter call to Claude. Canned = it came from a pre-recorded fallback (in case the API is slow or down). Each agent message in the transcript shows a green badge with the model name + latency on the live path, or a "canned" tag on the fallback path.

**Provenance badge** **[demo-specific]** — The little colored tag on each transcript message that tells you whether the LLM call was real or canned. Your proof to the judge that you're not faking the AI.

---

## 9. The model + technical bits

**LLM — Large Language Model** **[real]** — An AI model trained on text that can read and generate natural language. Claude is one. We use Claude via OpenRouter.

**OpenRouter** **[real]** — A third-party API that proxies requests to many LLM providers. We use it instead of calling Anthropic directly. (Lets us swap models trivially.)

**WebSocket** **[real]** — A two-way persistent connection between browser and server. The dashboard's "live" badge means the WebSocket is open; agent messages and grid state stream over it in real time.

**FastAPI** **[real]** — The Python web framework the backend is built on. Hosts the WebSocket and the `/run/baseline` and `/run/gridparley` endpoints.

**Phenomenological model** **[real, technical-modeling term]** — A model that reproduces the *appearance* of a phenomenon without modeling the underlying physics in full detail. Our frequency simulator is phenomenological — it captures "frequency dips when supply < demand" without solving the swing equation. **You should be ready to admit this; it's not pretending to be a SCADA-grade simulator.**

**Swing equation** **[real]** — The actual physics governing grid frequency dynamics (rotational inertia of generators vs. load imbalance). What a real grid simulator solves. We don't.

---

## 10. The metaphors you'll use

**"Air traffic control for electrons"** **[your one-liner]** — The pitch. ATC coordinates many aircraft from many airlines into a single safe airspace under a regulator. Same shape: many flexible loads from many hyperscalers into a single grid under an ISO.

**"Trust but verify"** — The architectural principle. The agents propose; the validator and asset registry decide.

**"Pure-LLM is unsafe; pure-rules can't negotiate; hybrid is how AI earns its way onto critical infrastructure."** — The philosophical close. Memorize it.

---

## Quick Q&A vocabulary cheat sheet

If a judge asks about… | Words to have ready
---|---
*the validator's hosting* | "FastAPI backend, pure Python, deterministic, between the LLM agents"
*how this scales* | "federation across ISOs, read-only on the ISO side, sits on top of EMS not replacing it"
*the regulatory frame* | "FERC December 2025 NFCD tariff, NERC reliability standards, ISO-NE Reliability 7.4"
*the precedent* | "ERCOT, Winter Storm Elliott Dec 2022, ~1.5 GW bitcoin miners curtailed manually"
*competitors* | "EnergyHub / Voltus / Enel X — multi-hour residential DR, different product, we're sub-90-second hyperscaler"
*the data* | "EIA-930 hourly demand from EIA's API, June 20 2024 ISO-NE peak 23.3 GW"
*frequency model* | "phenomenological first-order lag, deliberately not the swing equation, production would integrate against the ISO's EMS"
*counterparty count* | "AI is more concentrated than crypto — the issue isn't phone-tree size, it's decision complexity at sub-90-second response"
