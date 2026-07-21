"""PaymentPlan offer/negotiate core (SCHEMA.md §8) - pure logic, no I/O."""

from datetime import date
from decimal import Decimal

from settl.agents.payment_plan import (
    MAX_OFFER_COUNT,
    NegotiationOutcome,
    build_installments,
    offer_plan,
    read_response,
    reoffer,
    select_template,
)
from settl.data import load_synthetic_invoices
from settl.tenancy.config import PaymentPlanTemplate

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
