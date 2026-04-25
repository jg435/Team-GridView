"""Tool schemas for ISO and DC Claude agents."""

# ISO control-room agent tools
ISO_TOOLS = [
    {
        "name": "request_curtailment",
        "description": (
            "Issue a curtailment request to the colocated hyperscaler data-center fleet. "
            "Use this only when frequency is below 59.95 Hz or reserve margin is below 5%."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "mw_required": {"type": "integer", "description": "Megawatts of load shed required."},
                "deadline_seconds": {"type": "integer", "description": "Wall-clock deadline for the shed to take effect."},
                "reason": {"type": "string", "description": "One-line operator-facing reason citing freq/reserve numbers."},
            },
            "required": ["mw_required", "deadline_seconds", "reason"],
        },
    },
    {
        "name": "accept_proposal",
        "description": "Accept the data center's proposed shed and commit it to the grid model.",
        "input_schema": {
            "type": "object",
            "properties": {
                "committed_mw": {"type": "integer"},
                "settlement_note": {"type": "string", "description": "One-line settlement note (MW × duration × price)."},
            },
            "required": ["committed_mw", "settlement_note"],
        },
    },
    {
        "name": "reject_proposal",
        "description": "Reject the proposal and demand a revision. Use only if the proposal does not meet the request.",
        "input_schema": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"],
        },
    },
]

# Hyperscaler data-center fleet agent tools
DC_TOOLS = [
    {
        "name": "propose_shed",
        "description": (
            "Propose a curtailment plan: list training-pool job IDs to pause, total MW shed, "
            "and economics. Propose this in response to the ISO's curtailment request."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "paused_job_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "IDs of jobs from the fleet manifest to pause.",
                },
                "total_shed_mw": {"type": "integer"},
                "marginal_cost_per_mwh": {"type": "integer", "description": "Weighted marginal cost across paused jobs."},
                "restart_minutes": {"type": "integer", "description": "Slowest restart in the chosen set."},
                "notes": {"type": "string", "description": "One-line operator-facing rationale (which jobs, why)."},
            },
            "required": ["paused_job_ids", "total_shed_mw", "marginal_cost_per_mwh", "restart_minutes", "notes"],
        },
    },
    {
        "name": "decline",
        "description": "Decline the curtailment request. Use only if no feasible shed exists.",
        "input_schema": {
            "type": "object",
            "properties": {"reason": {"type": "string"}},
            "required": ["reason"],
        },
    },
]
