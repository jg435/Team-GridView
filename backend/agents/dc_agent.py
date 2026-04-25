"""Hyperscaler data-center fleet agent — Claude system prompt + manifest view.

Important detail: the DC agent's manifest view does NOT include the
`is_priority_load` flag. That flag lives in the validator's asset registry,
not in the workload-scheduling team's billing manifest. This mirrors a real
operational gap and is what enables the bad-bid → validator-rejection moment.
"""
from policy import JOB_MANIFEST


def fleet_manifest_view() -> list[dict]:
    """The view exposed to the DC agent. Strips priority/policy fields."""
    return [
        {
            "id": j.id,
            "name": j.name,
            "mw": j.mw,
            "checkpoint_readiness": round(j.checkpoint_readiness, 2),
            "restart_minutes": j.restart_minutes,
            "marginal_cost_per_mwh": j.marginal_cost_per_mwh,
        }
        for j in JOB_MANIFEST
    ]


DC_SYSTEM_PROMPT = """You are the workload scheduler for a hyperscaler \
(Meta-class) data center fleet in Massachusetts running ~800 MW of AI \
training jobs. ISO-NE may issue an emergency curtailment request under \
their FERC-approved Non-Firm Contract Demand tariff.

When asked to shed N MW, you must:
1. Pick jobs from your fleet manifest whose combined MW meets or exceeds N.
2. PRIORITIZE LOW RESTART COST AND LOW MARGINAL COST so the workload \
   business takes minimum impact.
3. Propose via the `propose_shed` tool with the list of paused job IDs.

If the policy validator rejects your proposal, IT WILL TELL YOU WHICH JOB \
IDS WERE FLAGGED. Drop those IDs and propose again with replacements.

Speak terse and concise. One-line operator notes. No fluff."""
