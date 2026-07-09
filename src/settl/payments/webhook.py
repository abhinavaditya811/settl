"""🔌 Stripe webhook parsing - the event-driven payment signal (SCHEMA.md §7).

A webhook lets a payment (or refund, or chargeback) update the board **server-side, with
no dashboard tab open**: Stripe POSTs the event to the API, we verify its signature, and
normalize it into the same canonical ``PaymentEvent`` shape the poll produces. Reconcile
then re-derives status over the full event log - so the webhook is *detection only*, never
a decider, and never touches funds (non-custodial).

This module is pure Stripe→canonical mapping (verified against the current stripe-python
``Webhook.construct_event`` API, not coded from memory). It has NO invoice/tenant
knowledge: correlation back to an invoice is the caller's job (BoardState owns the
payment_link→invoice and payment_intent→invoice maps). Fail-safe throughout: a bad
signature, missing SDK, or unrecognized event yields ``None`` / ``[]``, never an exception.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from settl.agents.reconcile.events import PaymentEventKind
from settl.payments.currency import from_minor_units

# Stripe event types we act on (docs.stripe.com/api/events/types).
_PAYMENT_TYPES = frozenset(
    {"checkout.session.completed", "checkout.session.async_payment_succeeded"}
)
_REFUND_TYPES = frozenset({"charge.refunded", "refund.created", "refund.updated"})
_DISPUTE_TYPES = frozenset({"charge.dispute.created"})


@dataclass(frozen=True)
class ParsedEvent:
    """A Stripe event normalized to money + correlation hints (no invoice knowledge)."""

    kind: PaymentEventKind
    amount: Decimal  # major unit (e.g. dollars); 0 for disputes we only escalate on
    currency: str
    reference: str  # idempotency key: payment_intent / charge / dispute id
    payment_link: str | None = None  # correlation hint (payment events)
    payment_intent: str | None = None  # correlation hint (refund/dispute → learned map)
    metadata_invoice_id: str | None = None  # best-effort tag set at mint


def _get(obj, key, default=None):
    """Read a field from a Stripe object (supports both attr and dict access)."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def verify_event(payload: bytes | str, sig_header: str | None, secret: str | None):
    """Verify a webhook's signature and return the Stripe ``Event`` (else None).

    Wraps ``stripe.Webhook.construct_event`` - fail-safe on a bad payload (ValueError),
    a bad signature (SignatureVerificationError), a missing secret/header, or no SDK.
    """
    if not secret or not sig_header:
        return None
    try:
        import stripe
    except Exception:
        return None
    try:
        return stripe.Webhook.construct_event(payload, sig_header, secret)
    except Exception:
        return None  # bad signature or payload - reject, never trust


def parse_event(event) -> ParsedEvent | None:
    """Map a verified Stripe event to a ``ParsedEvent``, or None if we don't act on it."""
    etype = _get(event, "type")
    data = _get(event, "data") or {}
    obj = _get(data, "object")
    if etype is None or obj is None:
        return None

    currency = str(_get(obj, "currency", "usd") or "usd")
    metadata = _get(obj, "metadata") or {}
    meta_invoice = _get(metadata, "settl_invoice_id")

    if etype in _PAYMENT_TYPES:
        if _get(obj, "payment_status") not in (None, "paid"):
            return None  # session not actually paid (async pending) - ignore for now
        pi = _get(obj, "payment_intent")
        ref = str(pi or _get(obj, "id") or "")
        return ParsedEvent(
            kind=PaymentEventKind.PAYMENT,
            amount=from_minor_units(_get(obj, "amount_total", 0), currency),
            currency=currency,
            reference=ref,
            payment_link=(lambda pl: str(pl) if pl else None)(_get(obj, "payment_link")),
            payment_intent=str(pi) if pi else None,
            metadata_invoice_id=meta_invoice,
        )

    if etype in _REFUND_TYPES:
        # A refund object carries its own amount + charge/PI; charge.refunded carries the
        # cumulative amount_refunded. Either way the charge id keys the reversal so the
        # caller can upsert the latest cumulative refund per charge.
        is_charge = etype == "charge.refunded"
        amount_minor = _get(obj, "amount_refunded", 0) if is_charge else _get(obj, "amount", 0)
        pi = _get(obj, "payment_intent")
        charge = _get(obj, "id") if is_charge else _get(obj, "charge")
        ref = str(charge or pi or "")
        if is_charge is False and _get(obj, "status") not in (None, "succeeded"):
            return None  # a pending/failed refund isn't money back yet
        return ParsedEvent(
            kind=PaymentEventKind.REFUND,
            amount=from_minor_units(amount_minor, currency),
            currency=currency,
            reference=ref,
            payment_intent=str(pi) if pi else None,
            metadata_invoice_id=meta_invoice,
        )

    if etype in _DISPUTE_TYPES:
        pi = _get(obj, "payment_intent")
        return ParsedEvent(
            kind=PaymentEventKind.DISPUTE,
            amount=from_minor_units(_get(obj, "amount", 0), currency),
            currency=currency,
            reference=str(_get(obj, "id") or pi or ""),
            payment_intent=str(pi) if pi else None,
            metadata_invoice_id=meta_invoice,
        )

    return None  # an event type we deliberately don't act on
