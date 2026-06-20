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


def decide_strategy(invoice: Invoice) -> StrategyDecision:
    """Pure policy: Invoice → StrategyDecision (no side effects, no model call)."""
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
    days_since = _days_since_last_outbound(invoice)
    if days_since is not None and days_since < TOO_SOON_DAYS:
        return StrategyDecision(
            Action.HOLD,
            f"Last touch was {days_since}d ago - too soon to re-contact.",
            next_touch_in_days=TOO_SOON_DAYS - days_since,
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

    # 6. Healthy chase - pick tone/late-fee by how overdue it is.
    days = invoice.days_overdue
    if days <= FRIENDLY_MAX_DAYS:
        tone, ask = Tone.FRIENDLY, "gentle nudge with the payment link"
    elif days <= FIRM_MAX_DAYS:
        tone, ask = Tone.FIRM, "clear request for payment with the link"
    else:
        tone, ask = Tone.FINAL, "firm final-notice request before next steps"

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
