"""Deterministic strategy policy.

This is the v1 decision core: given a canonical Invoice, decide whether and how to
chase it (timing, channel, tone, the ask, late fee). It is pure and unit-testable
with no model call. The Gemini 3 Pro judgment layer (DESIGN §3) plugs in later
behind ``model.py`` to refine - never to override - these rules.

The strategy agent recommends; it is NOT the safety authority. The compliance gate
is the only thing that can clear a message to send. Strategy still pre-flags the
obvious escalations (consumer debt, dispute) so the reasoning trail is complete.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from settl.schema.invoice import Channel, ContactDirection, Invoice, InvoiceStatus

# --- tunable thresholds (kept here so the policy reads as one story) -----------
FRIENDLY_MAX_DAYS = 14
FIRM_MAX_DAYS = 44
LATE_FEE_MIN_DAYS = 15  # don't tack on a fee on a barely-late invoice
TOO_SOON_DAYS = 2  # don't re-touch within this many days of the last outbound
RECENT_WINDOW_DAYS = 7
RECENT_TOUCH_LIMIT = 3  # >= this many outbound touches in the window → back off


class Action(str, Enum):
    CHASE = "chase"  # proceed to draft + compliance gate
    SKIP = "skip"  # nothing to do (paid, not yet due)
    HOLD = "hold"  # actionable later, but not right now (too soon / frequency)
    REVIEW = "review"  # send to a human now (dispute / consumer - gate will confirm)


class Tone(str, Enum):
    FRIENDLY = "friendly_reminder"
    FIRM = "firm_reminder"
    FINAL = "final_notice"


@dataclass(frozen=True)
class StrategyDecision:
    action: Action
    reasoning: str
    channel: Channel | None = None
    tone: Tone | None = None
    include_late_fee: bool = False
    the_ask: str = ""
    escalation_hint: str | None = None  # why a human will likely be needed
    next_touch_in_days: int | None = None  # for HOLD: when to revisit
    factors: dict = field(default_factory=dict)


def _choose_channel(invoice: Invoice) -> Channel:
    # Prefer the channel of the most recent touch; otherwise infer from contact.
    if invoice.prior_contacts:
        return invoice.prior_contacts[-1].channel
    return Channel.SMS if invoice.has_phone else Channel.EMAIL


def _recent_outbound(invoice: Invoice) -> list:
    cutoff = invoice.as_of_date.toordinal() - RECENT_WINDOW_DAYS
    return [c for c in invoice.outbound_contacts if c.occurred_on.toordinal() >= cutoff]


def _days_since_last_outbound(invoice: Invoice) -> int | None:
    out = invoice.outbound_contacts
    if not out:
        return None
    last = max(c.occurred_on for c in out)
    return invoice.as_of_date.toordinal() - last.toordinal()


_TONE_ORDER = (Tone.FRIENDLY, Tone.FIRM, Tone.FINAL)
_ASK = {
    Tone.FRIENDLY: "gentle nudge with the payment link",
    Tone.FIRM: "clear request for payment with the link",
    Tone.FINAL: "firm final-notice request before next steps",
}


def _clamp_tone(tone: Tone, allowed_tones: tuple[str, ...] | None) -> Tone:
    """Clamp the computed tone to a tenant's allowed set (policy input). A tenant can
    only *soften* - forbid FINAL → downgrade to the strongest allowed tone at or below
    it; it can never escalate beyond what the policy computed."""
    if not allowed_tones:
        return tone
    allowed = set(allowed_tones)
    if tone.value in allowed:
        return tone
    idx = _TONE_ORDER.index(tone)
    for t in reversed(_TONE_ORDER[: idx + 1]):  # strongest allowed at or below
        if t.value in allowed:
            return t
    for t in _TONE_ORDER:  # else the least severe allowed
        if t.value in allowed:
            return t
    return tone  # allowed set empty → no clamp


def decide_strategy(
    invoice: Invoice,
    *,
    min_days_between_touches: int | None = None,
    allowed_tones: tuple[str, ...] | None = None,
) -> StrategyDecision:
    """Pure policy: Invoice → StrategyDecision (no side effects, no model call).

    ``min_days_between_touches`` and ``allowed_tones`` are per-tenant policy inputs;
    both default to the module thresholds / no clamp so an un-configured call is
    unchanged."""
    factors = {
        "days_overdue": invoice.days_overdue,
        "status": invoice.status.value,
        "is_b2b": invoice.is_b2b,
        "outbound_touches": len(invoice.outbound_contacts),
    }

    # 1. Never chase money that already landed.
    if invoice.status is InvoiceStatus.PAID:
        return StrategyDecision(Action.SKIP, "Invoice is paid - no outreach.", factors=factors)

    # 2. Not actually overdue yet → nothing to do.
    if invoice.days_overdue <= 0:
        return StrategyDecision(
            Action.SKIP,
            f"Not yet due ({-invoice.days_overdue}d remaining) - no outreach.",
            factors=factors,
        )

    # 3. Dispute (status or an inbound reply) → strategy defers to a human.
    if invoice.status is InvoiceStatus.DISPUTED:
        return StrategyDecision(
            Action.REVIEW,
            "Invoice is disputed - defer to human; do not auto-chase.",
            escalation_hint="disputed",
            factors=factors,
        )

    # 4. Consumer debt → out of scope; strategy flags, gate will block.
    if not invoice.is_b2b:
        return StrategyDecision(
            Action.REVIEW,
            "Non-B2B (consumer) debt - out of first-party/B2B scope; route to human.",
            escalation_hint="consumer_debt",
            factors=factors,
        )

    # 5. Contact-frequency / cooldown: actionable, but not right now.
    cooldown = TOO_SOON_DAYS if min_days_between_touches is None else min_days_between_touches
    days_since = _days_since_last_outbound(invoice)
    if days_since is not None and days_since < cooldown:
        return StrategyDecision(
            Action.HOLD,
            f"Last touch was {days_since}d ago - too soon to re-contact.",
            next_touch_in_days=cooldown - days_since,
            factors=factors,
        )
    if len(_recent_outbound(invoice)) >= RECENT_TOUCH_LIMIT:
        return StrategyDecision(
            Action.HOLD,
            f"{len(_recent_outbound(invoice))} touches in the last "
            f"{RECENT_WINDOW_DAYS}d - back off to respect frequency limits.",
            next_touch_in_days=RECENT_WINDOW_DAYS,
            factors=factors,
        )

    # 6. Healthy chase - pick tone/late-fee by how overdue it is, then clamp the tone
    # to the tenant's allowed set (a tenant can only soften, never escalate).
    days = invoice.days_overdue
    if days <= FRIENDLY_MAX_DAYS:
        tone = Tone.FRIENDLY
    elif days <= FIRM_MAX_DAYS:
        tone = Tone.FIRM
    else:
        tone = Tone.FINAL
    tone = _clamp_tone(tone, allowed_tones)
    ask = _ASK[tone]

    include_fee = invoice.late_fee_allowed and days >= LATE_FEE_MIN_DAYS
    reasoning = (
        f"{days}d overdue, B2B, status={invoice.status.value} → {tone.value}; "
        f"late fee {'applied' if include_fee else 'not applied'} "
        f"(allowed={invoice.late_fee_allowed})."
    )
    return StrategyDecision(
        action=Action.CHASE,
        reasoning=reasoning,
        channel=_choose_channel(invoice),
        tone=tone,
        include_late_fee=include_fee,
        the_ask=ask,
        escalation_hint=(
            "first_contact" if invoice.is_new_debtor else None
        ),  # first touch still needs one-tap human approval at the gate
        factors=factors,
    )
