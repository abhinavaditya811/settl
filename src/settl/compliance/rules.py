"""The enumerated compliance rules - one function per rule.

These implement the NON-NEGOTIABLE list in CLAUDE.md. Every rule is deterministic
and returns zero or more ``RuleViolation``s; any violation means the message is
blocked and escalated to a human. Rules split into:

  * invoice/state rules - evaluated on every invoice, message or not
  * message-content rules - evaluated only when a drafted message is supplied
  * the human-in-the-loop rule - first contact to a new debtor needs approval

Adding a rule = adding a function here and registering it in gate.py. Never inline
a compliance check anywhere else in the codebase.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.compliance import patterns as P
from settl.schema.invoice import (
    PAYMENT_LINK_PLACEHOLDER,
    ContactDirection,
    Invoice,
    InvoiceStatus,
)

# Contact-frequency bound (hard rule). >= MAX touches in WINDOW days → block.
FREQUENCY_WINDOW_DAYS = 7
FREQUENCY_MAX_TOUCHES = 3

# Code emitted when an operator guardrail forces escalation (a *tightening* override).
OPERATOR_GUARDRAIL = "OPERATOR_GUARDRAIL"

# The ONLY codes an operator may waive. These are operational/pilot rules, not legal
# ones: a human can accept a firmer contact cadence or clear a first-contact hold. Every
# other code (consumer-debt/FDCPA, dispute, legal threat/advice, unenforceable claim,
# fabricated link) is a hard safety rule and can NEVER be waived - a flag against one is
# recorded and stays escalated. This is what keeps "a tenant can only make the gate
# stricter, never bypass it" (SCHEMA.md §3) true even with human overrides.
WAIVABLE_CODES = frozenset({"FIRST_CONTACT_APPROVAL", "FREQUENCY_LIMIT"})


@dataclass(frozen=True)
class RuleViolation:
    code: str
    message: str  # human-readable reason for the escalation queue


# --- invoice / state rules ----------------------------------------------------


def rule_consumer_debt(invoice: Invoice) -> list[RuleViolation]:
    if not invoice.is_b2b:
        return [
            RuleViolation(
                "B2B_ONLY",
                "Consumer (non-B2B) debt - outside first-party/B2B scope (FDCPA). "
                "Escalate; do not send.",
            )
        ]
    return []


def rule_disputed(invoice: Invoice) -> list[RuleViolation]:
    if invoice.status is InvoiceStatus.DISPUTED:
        return [
            RuleViolation(
                "DISPUTED",
                "Invoice status is disputed - do not auto-respond; route to human.",
            )
        ]
    return []


def _inbound_text(invoice: Invoice) -> str:
    return " ".join(
        c.summary
        for c in invoice.prior_contacts
        if c.direction is ContactDirection.INBOUND
    )


def rule_inbound_dispute(invoice: Invoice) -> list[RuleViolation]:
    hits = P.matches(_inbound_text(invoice), P.INBOUND_DISPUTE_RE)
    if hits:
        return [
            RuleViolation(
                "DISPUTE_RAISED",
                f"Debtor disputed in a reply ({', '.join(hits)}) - escalate.",
            )
        ]
    return []


def rule_payment_plan_request(invoice: Invoice) -> list[RuleViolation]:
    hits = P.matches(_inbound_text(invoice), P.INBOUND_PAYMENT_PLAN_RE)
    if hits:
        return [
            RuleViolation(
                "PAYMENT_PLAN_REQUEST",
                f"Debtor requested a payment plan ({', '.join(hits)}) - escalate; "
                "do not auto-negotiate.",
            )
        ]
    return []


def rule_contact_frequency(
    invoice: Invoice,
    window_days: int | None = None,
    max_touches: int | None = None,
) -> list[RuleViolation]:
    """Contact-frequency bound. Bounds default to the module constants but a tenant's
    ``policy`` (max_touches / frequency_window_days) can tighten them via the gate."""
    window_days = FREQUENCY_WINDOW_DAYS if window_days is None else window_days
    max_touches = FREQUENCY_MAX_TOUCHES if max_touches is None else max_touches
    cutoff = invoice.as_of_date.toordinal() - window_days
    recent = [
        c for c in invoice.outbound_contacts if c.occurred_on.toordinal() >= cutoff
    ]
    if len(recent) >= max_touches:
        return [
            RuleViolation(
                "FREQUENCY_LIMIT",
                f"{len(recent)} outbound touches in the last {window_days} "
                "days - exceeds contact-frequency limit; escalate.",
            )
        ]
    return []


def rule_first_contact(invoice: Invoice) -> list[RuleViolation]:
    """Pilot-mode human-in-the-loop: first message to a new debtor needs approval."""
    if invoice.is_new_debtor:
        return [
            RuleViolation(
                "FIRST_CONTACT_APPROVAL",
                "First contact to a new debtor - requires one-tap human approval "
                "before sending (pilot mode).",
            )
        ]
    return []


# --- message-content rules ----------------------------------------------------


def rule_legal_threat(message: str) -> list[RuleViolation]:
    hits = P.matches(message, P.LEGAL_THREAT_RE)
    if hits:
        return [
            RuleViolation(
                "LEGAL_THREAT",
                f"Message contains legal-threat language ({', '.join(hits)}).",
            )
        ]
    return []


def rule_unenforceable_consequence(message: str) -> list[RuleViolation]:
    hits = P.matches(message, P.UNENFORCEABLE_RE)
    if hits:
        return [
            RuleViolation(
                "UNENFORCEABLE_CONSEQUENCE",
                f"Message claims a consequence we can't/won't carry out "
                f"({', '.join(hits)}).",
            )
        ]
    return []


def rule_legal_advice(message: str) -> list[RuleViolation]:
    hits = P.matches(message, P.LEGAL_ADVICE_RE)
    if hits:
        return [
            RuleViolation(
                "LEGAL_ADVICE",
                f"Message strays into legal advice/obligation ({', '.join(hits)}).",
            )
        ]
    return []


def rule_tone_bounds(message: str) -> list[RuleViolation]:
    hits = P.matches(message, P.TONE_BREACH_RE)
    if hits:
        return [
            RuleViolation(
                "TONE_BREACH",
                f"Message breaches tone bounds ({', '.join(hits)}).",
            )
        ]
    return []


def rule_no_fabricated_link(message: str) -> list[RuleViolation]:
    """Non-custodial guard: a draft may carry only the {{payment_link}} placeholder,
    never a real URL. The sender resolves the tenant-bound link after the gate; any
    other URL means the model fabricated one - escalate. See SCHEMA.md §5."""
    cleaned = message.replace(PAYMENT_LINK_PLACEHOLDER, "")
    hits = P.matches(cleaned, P.URL_RE)
    if hits:
        return [
            RuleViolation(
                "FABRICATED_LINK",
                f"Message contains a non-placeholder URL ({', '.join(hits)}) - only "
                "{{payment_link}} is allowed; the sender resolves the real link.",
            )
        ]
    return []
