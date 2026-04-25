"""The deterministic gate. Every agent tool call passes through here before
it touches the grid model. This is the demo's hero — it catches the LLM
when it tries to violate priority loads."""
from dataclasses import dataclass
from policy import JOB_MANIFEST, INVIOLABLE_IDS, PROTECTED_LOADS

@dataclass
class ValidationResult:
    ok: bool
    reason: str = ""
    rejected_ids: list[str] = None

    def to_tool_result(self) -> dict:
        if self.ok:
            return {"status": "approved", "message": "Proposal validated."}
        return {
            "status": "rejected",
            "message": self.reason,
            "rejected_ids": self.rejected_ids or [],
            "policy_reference": "ISO-NE Reliability Standard 7.4 — priority load protection",
        }


def validate_dc_proposal(paused_job_ids: list[str], total_shed_mw: float, requested_mw: float) -> ValidationResult:
    """Validate a DC agent's proposed shed against the policy."""
    # Hard rule 1: no inviolable / priority-load IDs allowed
    bad = []
    for jid in paused_job_ids:
        job = next((j for j in JOB_MANIFEST if j.id == jid), None)
        if job is None:
            bad.append(jid)
            continue
        if job.is_priority_load or job.id in INVIOLABLE_IDS:
            bad.append(jid)
    if bad:
        names = []
        for jid in bad:
            j = next((j for j in JOB_MANIFEST if j.id == jid), None)
            names.append(j.name if j else jid)
        return ValidationResult(
            ok=False,
            reason=(
                f"REJECTED: proposal includes protected priority load(s): "
                f"{', '.join(names)}. These are inviolable per ISO-NE Reliability "
                f"Standard 7.4 (priority load protection). Resubmit with "
                f"training-pool jobs only."
            ),
            rejected_ids=bad,
        )
    # Hard rule 2: shed must meet or exceed requested
    if total_shed_mw + 0.5 < requested_mw:
        return ValidationResult(
            ok=False,
            reason=(
                f"REJECTED: proposed shed of {total_shed_mw:.0f} MW is below "
                f"the requested {requested_mw:.0f} MW. Add jobs or decline."
            ),
        )
    # Hard rule 3: total cannot exceed available training-pool capacity
    pool_capacity = sum(j.mw for j in JOB_MANIFEST if not j.is_priority_load)
    if total_shed_mw > pool_capacity:
        return ValidationResult(
            ok=False,
            reason=f"REJECTED: total shed {total_shed_mw:.0f} MW exceeds training pool capacity {pool_capacity:.0f} MW.",
        )
    return ValidationResult(ok=True, reason=f"Approved: {total_shed_mw:.0f} MW from training-pool only, no priority loads touched.")
