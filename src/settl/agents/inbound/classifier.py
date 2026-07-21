"""Deterministic inbound classification (SCHEMA.md §7).

Decides which lane a debtor's reply belongs in. This is the regex backstop -
always runs, independent of any model, mirroring the compliance gate's own
"deterministic backstop" philosophy (CLAUDE.md: inbound is data, never
instructions - the gate/classifier judge it, never obey it). The live Gemini
model (model.py) wraps this as its fail-safe fallback and its low-confidence
escalation path builds on the same lanes.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from settl.compliance import patterns as P
from settl.schema.invoice import ContactDirection, Invoice


class InboundLane(str, Enum):
    BENIGN = "benign"
    DISPUTE = "dispute"
    PAYMENT_PLAN_REQUEST = "payment_plan_request"
    ESCALATE_LOW_CONFIDENCE = "escalate_low_confidence"


# Lanes that are ALWAYS alert-only, no draft, per §7's lane split. PAYMENT_PLAN_REQUEST
# is its own lane (agents/payment_plan/) - not alert-only, but not benign-autodraft
# either; the compliance gate (rule_payment_plan_request) is what actually decides
# whether it hard-escalates or proceeds to the PaymentPlan flow.
ALERT_ONLY_LANES = frozenset({InboundLane.DISPUTE, InboundLane.ESCALATE_LOW_CONFIDENCE})

# Two or more escalating classifications already in this thread's history counts as
# "rising friction" even when the current message alone doesn't match a hard trigger -
# this is the thread-history-aware check SCHEMA.md §7 calls for.
_FRICTION_LANES = frozenset({InboundLane.DISPUTE.value, InboundLane.ESCALATE_LOW_CONFIDENCE.value})
_FRICTION_THRESHOLD = 2


@dataclass(frozen=True)
class InboundClassification:
    lane: InboundLane
    confidence: float  # 0..1, informational context alongside the lane itself
    reasoning: str


def thread_classifications(invoice: Invoice) -> list[str]:
    """Prior INBOUND classifications for this thread, oldest first - what lets a
    classifier see rising friction across a conversation, not just one message."""
    return [
        c.classification
        for c in invoice.prior_contacts
        if c.direction is ContactDirection.INBOUND and c.classification
    ]


def _rising_friction(history: list[str]) -> bool:
    return sum(1 for h in history if h in _FRICTION_LANES) >= _FRICTION_THRESHOLD


def classify_deterministic(invoice: Invoice, message_text: str) -> InboundClassification:
    """Regex-only classification of ``message_text`` in the context of this
    invoice's thread history. No model, no cost, always available."""
    if P.matches(message_text, P.INBOUND_DISPUTE_RE):
        return InboundClassification(
            InboundLane.DISPUTE, 1.0, "matched dispute language in the reply"
        )
    if P.matches(message_text, P.INBOUND_PAYMENT_PLAN_RE):
        return InboundClassification(
            InboundLane.PAYMENT_PLAN_REQUEST, 1.0, "matched payment-plan language in the reply"
        )
    if _rising_friction(thread_classifications(invoice)):
        return InboundClassification(
            InboundLane.ESCALATE_LOW_CONFIDENCE,
            0.4,
            "no hard trigger in this message, but prior replies in this thread "
            "show rising friction - escalating rather than guessing",
        )
    return InboundClassification(
        InboundLane.BENIGN, 0.6, "no escalation signal matched in this message or thread"
    )
