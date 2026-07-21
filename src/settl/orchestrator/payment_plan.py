"""Vendor approve/reject for a PaymentPlan (SCHEMA.md §8).

Generalizes ``Orchestrator.approve_and_send``'s shape (orchestrator/pipeline.py)
rather than duplicating it: re-run the gate, build the confirmation from the
plan's own installments, and never let anything reach the debtor without this
explicit vendor sign-off. Kept in its own module - pipeline.py is already near
CLAUDE.md's 300-400 line cap. Reaches into Orchestrator's package-internal
``_gate``/``_sender``/``_log`` (a same-package reuse, not a public API) rather
than duplicating their wiring.
"""

from __future__ import annotations

from dataclasses import replace as dc_replace

from settl.agents.payment_plan.models import MAX_OFFER_COUNT, PaymentPlan, PaymentPlanStatus
from settl.orchestrator.pipeline import Orchestrator
from settl.orchestrator.result import PipelineResult, PipelineStep, TerminalState
from settl.schema.invoice import Channel, Invoice


def _confirmation_message(invoice: Invoice, plan: PaymentPlan) -> str:
    lines = [
        f"Hi {invoice.debtor_name}, confirming the payment plan for invoice "
        f"{invoice.invoice_id}:",
    ]
    for i in plan.installments:
        lines.append(f"- {i.amount} {invoice.currency} due {i.due_date.isoformat()}")
    lines.append("Thanks for working with us on this - let us know if anything changes.")
    return "\n".join(lines)


def decide_payment_plan(
    orchestrator: Orchestrator, invoice: Invoice, plan: PaymentPlan, approved: bool
) -> tuple[PaymentPlan, PipelineResult]:
    """The vendor's explicit approve/reject on a PROPOSED plan.

    Approve: build the confirmation from the plan's own installments, re-run the
    gate (same "the gate stays the authority" invariant ``approve_and_send``
    follows), send. Success moves the plan straight to ACTIVE - there is no
    unconfirmed-but-approved state a debtor could see.

    Reject: records the rejection and reports whether the offer cap
    (``MAX_OFFER_COUNT``) is exhausted. This function does NOT generate the next
    offer itself (agents/payment_plan/offer.reoffer does that) - it only records
    the vendor's decision, mirroring how ``approve_and_send`` only ever handles
    one decision at a time.
    """
    if not approved:
        rejected = dc_replace(plan, status=PaymentPlanStatus.REJECTED)
        if rejected.can_reoffer:
            reason = (
                f"Vendor rejected the offered plan (offer {plan.offer_count}/"
                f"{MAX_OFFER_COUNT}) - the AI may re-offer a different template."
            )
            state = TerminalState.HELD
        else:
            reason = (
                "Vendor rejected the offered plan - offer cap reached, mandatory "
                "human handoff (no further auto-offers)."
            )
            state = TerminalState.ESCALATED
        orchestrator._record(invoice, "payment_plan", "rejected", reason)
        result = PipelineResult(
            invoice.invoice_id, state,
            steps=[PipelineStep("payment_plan", "rejected", reason)], detail=reason,
        )
        return rejected, result

    message = _confirmation_message(invoice, plan)
    gate_result = orchestrator._gate.evaluate(invoice, message, channel=Channel.EMAIL)
    steps = [PipelineStep("compliance_gate", gate_result.decision.value, gate_result.reasoning)]

    if not gate_result.passed:
        outcome = orchestrator._sender.send(invoice, message, gate_result, Channel.EMAIL)
        steps.append(PipelineStep("sender", "withheld", outcome.detail))
        return plan, PipelineResult(
            invoice.invoice_id, TerminalState.ESCALATED, steps=steps, message=message,
            detail=f"plan confirmation blocked: {','.join(gate_result.codes)}",
        )

    outcome = orchestrator._sender.send(invoice, message, gate_result, Channel.EMAIL)
    if not outcome.sent:
        steps.append(PipelineStep("sender", "withheld", outcome.detail))
        approved_plan = dc_replace(
            plan, status=PaymentPlanStatus.APPROVED, decided_at=invoice.as_of_date
        )
        return approved_plan, PipelineResult(
            invoice.invoice_id, TerminalState.ESCALATED, steps=steps,
            message=message, detail=outcome.detail,
        )

    steps.append(PipelineStep("sender", "sent", outcome.detail))
    active_plan = dc_replace(
        plan, status=PaymentPlanStatus.ACTIVE, decided_at=invoice.as_of_date
    )
    return active_plan, PipelineResult(
        invoice.invoice_id, TerminalState.SENT, steps=steps, message=message,
        channel=Channel.EMAIL.value, detail="payment plan approved -> confirmed to debtor",
    )
