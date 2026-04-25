"""Stub negotiation orchestrator.

Block D will replace this with a real Claude-driven loop. For now, this
stub performs the deterministic 'guardrail moment' demo arc using canned
narration so the rest of the system (replay, broadcast, validator wiring)
can be tested without an Anthropic key.
"""
from __future__ import annotations
import asyncio
import os
from dataclasses import asdict
from typing import Awaitable, Callable

from policy import JOB_MANIFEST, required_curtailment_mw
from validator import validate_dc_proposal


async def run_negotiation(rs, broadcast: Callable[[dict], Awaitable[None]]) -> None:
    """Execute the canned negotiation arc against the validator.

    rs: RunState (forward-declared via duck typing)
    broadcast: async fn that pushes the latest state to subscribers.
    """
    from app import TranscriptMessage  # avoid circular import

    g = rs.grid
    requested = max(200.0, required_curtailment_mw(g.frequency_hz, g.reserve_margin_pct))
    if requested < 50:
        requested = 240.0  # demo minimum

    async def emit(sender, kind, text, payload=None):
        rs.transcript.append(TranscriptMessage(
            sender=sender, kind=kind, text=text,
            payload=payload or {}, ts_local=g.ts_local,
        ))
        await broadcast(rs.to_dict())
        await asyncio.sleep(0.9)

    # Turn 1 — ISO requests curtailment
    await emit("iso", "speech",
        f"Frequency excursion detected: {g.frequency_hz:.3f} Hz. Reserve margin {g.reserve_margin_pct:.1f}%. "
        f"Requesting {requested:.0f} MW shed within 90 seconds. Priority loads (Hanscom AFB, Mass General, "
        f"Boston Children's UPS) must remain at full power.",
        {"requested_mw": requested, "deadline_s": 90})

    # Turn 2 — DC proposes (BAD: includes the trap)
    bad_ids = ["batch_inference_pool", "llama_70b_finetune", "boston_childrens_ups", "llama_405b_run_a"]
    bad_total = sum(j.mw for j in JOB_MANIFEST if j.id in bad_ids)
    await emit("dc", "tool_call",
        f"Proposing shed of {bad_total:.0f} MW by pausing 4 workloads (lowest restart cost first): "
        f"batch inference, 70B fine-tune, colocation-2 SKU, and 405B run A. "
        f"Marginal weighted cost ~$155/MWh. Restart in 45 min.",
        {"paused_job_ids": bad_ids, "total_shed_mw": bad_total, "marginal_cost": 155, "restart_min": 45})

    # Validator rejects
    result = validate_dc_proposal(bad_ids, bad_total, requested)
    assert not result.ok
    await emit("validator", "tool_result",
        result.reason,
        result.to_tool_result())

    # Turn 3 — DC corrects
    good_ids = ["batch_inference_pool", "llama_70b_finetune", "llama_405b_run_a", "llama_405b_run_b"]
    # take only enough to meet requested
    chosen, total = [], 0.0
    for jid in good_ids:
        j = next(j for j in JOB_MANIFEST if j.id == jid)
        chosen.append(jid); total += j.mw
        if total >= requested: break
    await emit("dc", "tool_call",
        f"Acknowledged. Revised proposal: {total:.0f} MW from training-pool only. "
        f"Pausing {len(chosen)} workloads. All checkpoints flushed; 45 min restart window. "
        f"Hanscom AFB, Mass General, Children's UPS untouched.",
        {"paused_job_ids": chosen, "total_shed_mw": total})

    result2 = validate_dc_proposal(chosen, total, requested)
    await emit("validator", "tool_result", result2.reason, result2.to_tool_result())

    # Turn 4 — ISO accepts; commit shed into grid
    await emit("iso", "speech",
        f"Accepted. Settlement: {total:.0f} MW × 30 min @ $180/MWh ≈ ${total*0.5*180:.0f}. "
        f"Commit signed, dispatching to SCADA.",
        {"committed_mw": total})

    rs.grid.committed_shed_mw = total
    await broadcast(rs.to_dict())
