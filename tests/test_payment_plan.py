"""PaymentPlan offer/negotiate core (SCHEMA.md §8) - pure logic, no I/O."""

from datetime import date, timedelta
from decimal import Decimal

from settl.agents.payment_plan import (
    MAX_OFFER_COUNT,
    InstallmentMonitorAction,
    NegotiationOutcome,
    PaymentPlanStatus,
    build_installments,
    next_action,
    offer_plan,
    read_response,
    reoffer,
    select_template,
)
from settl.agents.reconcile import PaymentEvent, ReconcileStatus, classify_plan, mark_paid_installments
from settl.data import load_synthetic_invoices
from settl.orchestrator import Orchestrator, TerminalState, decide_payment_plan
from settl.tenancy.config import PaymentPlanTemplate, TenantConfig, policy_with

TEMPLATE_3X30 = PaymentPlanTemplate(installments=3, period_days=30, label="3 over 90 days")
TEMPLATE_2X15 = PaymentPlanTemplate(installments=2, period_days=15, label="2 over 30 days")


def _invoice(inv_id="INV-006"):
    return {i.invoice_id: i for i in load_synthetic_invoices()}[inv_id]


def test_select_template_picks_first_configured():
    assert select_template((TEMPLATE_3X30, TEMPLATE_2X15)) is TEMPLATE_3X30


def test_select_template_none_when_unconfigured():
    assert select_template(()) is None


def test_build_installments_sums_exactly_to_amount_due_with_no_lost_cents():
    installments = build_installments(
        Decimal("100.00"), "USD", TEMPLATE_3X30, start=date(2026, 1, 1)
    )
    assert len(installments) == 3
    assert sum(i.amount for i in installments) == Decimal("100.00")
    # Remainder absorbed by the last installment - not silently dropped.
    assert installments[0].amount == Decimal("33.33")
    assert installments[1].amount == Decimal("33.33")
    assert installments[2].amount == Decimal("33.34")


def test_build_installments_due_dates_step_by_period_days():
    installments = build_installments(
        Decimal("90.00"), "USD", TEMPLATE_3X30, start=date(2026, 1, 1)
    )
    assert [i.due_date for i in installments] == [
        date(2026, 1, 31),
        date(2026, 3, 2),
        date(2026, 4, 1),
    ]


def test_build_installments_is_zero_decimal_currency_aware():
    # JPY has no minor unit - splitting must not silently divide by 100.
    installments = build_installments(Decimal("9999"), "JPY", TEMPLATE_3X30, start=date(2026, 1, 1))
    assert sum(i.amount for i in installments) == Decimal("9999")


def test_offer_plan_is_proposed_with_offer_count_one():
    inv = _invoice()
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    assert plan.status.value == "proposed"
    assert plan.offer_count == 1
    assert plan.can_reoffer
    assert plan.invoice_id == inv.invoice_id
    assert plan.total_amount == inv.amount_due


def test_reoffer_amends_the_same_plan_and_bumps_offer_count():
    inv = _invoice()
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    reoffered = reoffer(plan, inv, TEMPLATE_2X15)
    assert reoffered.id == plan.id  # same record, not a new plan
    assert reoffered.offer_count == 2
    assert len(reoffered.installments) == 2  # picked up the new template's shape


def test_reoffer_clears_the_prior_negotiation_state():
    # Regression: a fresh offer supersedes whatever the debtor said about the LAST
    # one - reoffer() used dataclasses.replace(), which carries over every
    # unspecified field, including a stale negotiation_outcome/requested_terms.
    from dataclasses import replace as dc_replace

    inv = _invoice()
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    plan = dc_replace(plan, negotiation_outcome="wants_different_terms", requested_terms="6 months instead")
    reoffered = reoffer(plan, inv, TEMPLATE_2X15)
    assert reoffered.negotiation_outcome is None
    assert reoffered.requested_terms is None


def test_offer_count_caps_reoffering_at_the_configured_max():
    inv = _invoice()
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    for _ in range(MAX_OFFER_COUNT - 1):
        plan = reoffer(plan, inv, TEMPLATE_3X30)
    assert plan.offer_count == MAX_OFFER_COUNT
    assert not plan.can_reoffer  # mandatory human handoff from here


def test_negotiation_accepts_clear_agreement_language():
    result = read_response("That works for me, let's do this")
    assert result.outcome is NegotiationOutcome.ACCEPTED
    assert result.requested_terms is None


def test_negotiation_treats_anything_else_as_a_request_for_different_terms():
    result = read_response("Can we do 6 months instead?")
    assert result.outcome is NegotiationOutcome.WANTS_DIFFERENT_TERMS
    # The raw text is carried through for the vendor to see, never parsed into a
    # new commitment here - the AI never negotiates the actual terms itself.
    assert result.requested_terms == "Can we do 6 months instead?"


# --- vendor approve/reject (SCHEMA.md §8) ---------------------------------------


def _autonomous_orch() -> Orchestrator:
    # The gate re-scans invoice.prior_contacts on every evaluate() call, so the
    # confirmation send still needs the tenant's autonomy opt-in - exactly as it
    # would have needed to reach the offer/decide step in the first place.
    config = TenantConfig(
        tenant_id="t_test",
        policy=policy_with(payment_plan_autonomy=True, payment_plan_min_amount=0),
    )
    return Orchestrator(config=config)


def test_decide_payment_plan_approve_sends_confirmation_and_activates():
    # INV-006 already has an outbound touch (not a new debtor), so first-contact
    # approval isn't in play here - only the plan-confirmation decision is tested.
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    orch = _autonomous_orch()
    new_plan, result = decide_payment_plan(orch, inv, plan, approved=True)
    assert result.terminal_state is TerminalState.SENT
    assert new_plan.status is PaymentPlanStatus.ACTIVE
    assert new_plan.decided_at is not None
    assert str(plan.installments[0].amount) in result.message


def test_decide_payment_plan_reject_with_reoffer_room_holds():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")  # offer_count = 1
    orch = Orchestrator()
    new_plan, result = decide_payment_plan(orch, inv, plan, approved=False)
    assert result.terminal_state is TerminalState.HELD
    assert new_plan.status is PaymentPlanStatus.REJECTED
    assert new_plan.can_reoffer


def test_decide_payment_plan_reject_at_offer_cap_escalates():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    for _ in range(MAX_OFFER_COUNT - 1):
        plan = reoffer(plan, inv, TEMPLATE_3X30)
    assert plan.offer_count == MAX_OFFER_COUNT
    orch = Orchestrator()
    new_plan, result = decide_payment_plan(orch, inv, plan, approved=False)
    assert result.terminal_state is TerminalState.ESCALATED
    assert not new_plan.can_reoffer


# --- reconcile schedule-awareness (SCHEMA.md §8) --------------------------------


def test_classify_plan_installment_overdue_is_not_in_escalating_statuses():
    from settl.agents.reconcile import ESCALATING_STATUSES

    assert ReconcileStatus.INSTALLMENT_OVERDUE not in ESCALATING_STATUSES


def test_classify_plan_paid_in_full():
    inv = _invoice("INV-006")  # amount_due = 3100.00
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    events = [PaymentEvent(invoice_id=inv.invoice_id, amount=inv.amount_due, occurred_on=inv.as_of_date)]
    assert classify_plan(inv, plan, events) is ReconcileStatus.PAID


def test_classify_plan_on_schedule_is_partial_not_overdue():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")  # 3 installments, none due yet
    events = [PaymentEvent(invoice_id=inv.invoice_id, amount=Decimal("500"), occurred_on=inv.as_of_date)]
    assert classify_plan(inv, plan, events) is ReconcileStatus.PARTIAL


def test_classify_plan_behind_schedule_is_installment_overdue():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    # Push as_of_date past the first installment's due date with nothing paid.
    behind = inv.model_copy(update={"as_of_date": plan.installments[0].due_date})
    assert classify_plan(behind, plan, []) is ReconcileStatus.INSTALLMENT_OVERDUE


def test_classify_plan_currency_mismatch_is_anomaly():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    events = [PaymentEvent(invoice_id=inv.invoice_id, amount=Decimal("100"), occurred_on=inv.as_of_date, currency="EUR")]
    assert classify_plan(inv, plan, events) is ReconcileStatus.ANOMALY


def test_mark_paid_installments_fifo_allocates_in_order():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    first_amount = plan.installments[0].amount
    updated = mark_paid_installments(plan, first_amount, inv.as_of_date)
    assert updated.installments[0].is_paid
    assert not updated.installments[1].is_paid
    assert not updated.installments[2].is_paid


def test_mark_paid_installments_partial_payment_marks_nothing():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    half = plan.installments[0].amount / 2
    updated = mark_paid_installments(plan, half, inv.as_of_date)
    assert not any(i.is_paid for i in updated.installments)


# --- active-plan monitoring (SCHEMA.md §8) --------------------------------------


def _dated_invoice(as_of):
    return _invoice("INV-006").model_copy(update={"as_of_date": as_of})


def test_next_action_none_when_nothing_overdue():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")  # all installments in the future
    assert next_action(plan, inv, reminder_sent_for_index=None) is InstallmentMonitorAction.NONE


def test_next_action_sends_reminder_on_first_miss():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    at_due = _dated_invoice(plan.installments[0].due_date)
    action = next_action(plan, at_due, reminder_sent_for_index=None)
    assert action is InstallmentMonitorAction.SEND_REMINDER


def test_next_action_stays_none_until_next_installments_due_date_after_reminder():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    day_after_miss = _dated_invoice(plan.installments[0].due_date + timedelta(days=1))
    action = next_action(plan, day_after_miss, reminder_sent_for_index=0)
    assert action is InstallmentMonitorAction.NONE


def test_next_action_escalates_once_next_installments_due_date_arrives():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    at_next_due = _dated_invoice(plan.installments[1].due_date)
    action = next_action(plan, at_next_due, reminder_sent_for_index=0)
    assert action is InstallmentMonitorAction.ESCALATE


def test_next_action_last_installment_uses_a_fixed_grace_window():
    inv = _invoice("INV-006")
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    # Pay off the first two installments so only the last one is overdue - the
    # "is_last" branch only applies once it's genuinely the first overdue one.
    paid_early = mark_paid_installments(
        plan, plan.installments[0].amount + plan.installments[1].amount, inv.as_of_date
    )
    last = paid_early.installments[-1]
    within_grace = _dated_invoice(last.due_date + timedelta(days=3))
    action = next_action(paid_early, within_grace, reminder_sent_for_index=last.index, grace_days=7)
    assert action is InstallmentMonitorAction.NONE

    past_grace = _dated_invoice(last.due_date + timedelta(days=8))
    action = next_action(paid_early, past_grace, reminder_sent_for_index=last.index, grace_days=7)
    assert action is InstallmentMonitorAction.ESCALATE


def test_decide_payment_plan_approve_is_still_blocked_by_other_gate_rules():
    # Consumer (non-B2B) debt must block a plan confirmation exactly like any
    # other message - approving a plan is never a way around a hard compliance
    # rule. Proves this reuses the real gate rather than skipping it.
    inv = _invoice("INV-003")  # is_b2b = False in the fixture
    assert not inv.is_b2b
    plan = offer_plan(inv, TEMPLATE_3X30, plan_id="pp-1")
    orch = _autonomous_orch()  # autonomy ON - still must not bypass is_b2b
    _, result = decide_payment_plan(orch, inv, plan, approved=True)
    assert result.terminal_state is TerminalState.ESCALATED
    gate_step = next(s for s in result.steps if s.agent == "compliance_gate")
    assert gate_step.decision == "escalate"
    assert "b2b" in gate_step.reasoning.lower() or "consumer" in gate_step.reasoning.lower()
