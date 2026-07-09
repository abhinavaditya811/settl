"""Stripe webhook parsing - pure Stripe→canonical mapping, fail-safe throughout.

``parse_event`` takes a (already-verified) event shaped like the SDK's Event and maps it
to a ``ParsedEvent`` with money + correlation hints; ``verify_event`` is the signature
gate. We assert the mapping for payment/refund/dispute, the zero-decimal currency math,
and that a bad/unknown event never raises - it returns None/[]."""

from decimal import Decimal

from settl.agents.reconcile import PaymentEventKind
from settl.payments.webhook import parse_event, verify_event


def _event(etype, obj):
    return {"type": etype, "data": {"object": obj}}


def test_verify_event_is_failsafe_without_secret_or_signature():
    assert verify_event(b"{}", None, "whsec_x") is None
    assert verify_event(b"{}", "sig", None) is None


def test_checkout_completed_maps_to_a_payment():
    ev = _event("checkout.session.completed", {
        "payment_status": "paid", "amount_total": 12000, "currency": "usd",
        "payment_intent": "pi_1", "payment_link": "plink_1",
        "metadata": {"settl_invoice_id": "INV-9"},
    })
    parsed = parse_event(ev)
    assert parsed.kind is PaymentEventKind.PAYMENT
    assert parsed.amount == Decimal("120.00")
    assert parsed.reference == "pi_1"
    assert parsed.payment_link == "plink_1"
    assert parsed.metadata_invoice_id == "INV-9"


def test_unpaid_checkout_session_is_ignored():
    ev = _event("checkout.session.completed", {"payment_status": "unpaid", "amount_total": 100})
    assert parse_event(ev) is None


def test_zero_decimal_currency_is_not_divided_by_100():
    ev = _event("checkout.session.completed", {
        "payment_status": "paid", "amount_total": 5000, "currency": "jpy", "payment_intent": "pi_j",
    })
    assert parse_event(ev).amount == Decimal("5000")  # whole yen


def test_charge_refunded_maps_to_a_refund_keyed_by_charge():
    ev = _event("charge.refunded", {
        "amount_refunded": 4000, "currency": "usd", "payment_intent": "pi_1", "id": "ch_1",
    })
    parsed = parse_event(ev)
    assert parsed.kind is PaymentEventKind.REFUND
    assert parsed.amount == Decimal("40.00")
    assert parsed.reference == "ch_1"  # charge id → cumulative refund upserts per charge
    assert parsed.payment_intent == "pi_1"


def test_dispute_created_maps_to_a_dispute():
    ev = _event("charge.dispute.created", {
        "amount": 12000, "currency": "usd", "payment_intent": "pi_1", "id": "dp_1",
    })
    parsed = parse_event(ev)
    assert parsed.kind is PaymentEventKind.DISPUTE
    assert parsed.reference == "dp_1"
    assert parsed.payment_intent == "pi_1"


def test_unknown_event_type_is_skipped():
    assert parse_event(_event("invoice.paid", {"amount": 1})) is None
    assert parse_event(None) is None
