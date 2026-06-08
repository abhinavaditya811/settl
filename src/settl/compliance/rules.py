"""The enumerated compliance rules — one function per rule.

These implement the NON-NEGOTIABLE list in CLAUDE.md. Every rule is deterministic
and returns zero or more ``RuleViolation``s; any violation means the message is
blocked and escalated to a human. Rules split into:

  * invoice/state rules — evaluated on every invoice, message or not
  * message-content rules — evaluated only when a drafted message is supplied
  * the human-in-the-loop rule — first contact to a new debtor needs approval

Adding a rule = adding a function here and registering it in gate.py. Never inline
a compliance check anywhere else in the codebase.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.compliance import patterns as P
from settl.schema.invoice import ContactDirection, Invoice, InvoiceStatus

# Contact-frequency bound (hard rule). >= MAX touches in WINDOW days → block.
FREQUENCY_WINDOW_DAYS = 7
FREQUENCY_MAX_TOUCHES = 3


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
                "Consumer (non-B2B) debt — outside first-party/B2B scope (FDCPA). "
                "Escalate; do not send.",
            )
        ]
    return []


def rule_disputed(invoice: Invoice) -> list[RuleViolation]:
    if invoice.status is InvoiceStatus.DISPUTED:
        return [
            RuleViolation(
                "DISPUTED",
                "Invoice status is disputed — do not auto-respond; route to human.",
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
                f"Debtor disputed in a reply ({', '.join(hits)}) — escalate.",
            )
        ]
    return []


def rule_payment_plan_request(invoice: Invoice) -> list[RuleViolation]:
    hits = P.matches(_inbound_text(invoice), P.INBOUND_PAYMENT_PLAN_RE)
    if hits:
        return [
            RuleViolation(
                "PAYMENT_PLAN_REQUEST",
                f"Debtor requested a payment plan ({', '.join(hits)}) — escalate; "
                "do not auto-negotiate.",
            )
        ]
    return []


def rule_contact_frequency(invoice: Invoice) -> list[RuleViolation]:
    cutoff = invoice.as_of_date.toordinal() - FREQUENCY_WINDOW_DAYS
    recent = [
        c for c in invoice.outbound_contacts if c.occurred_on.toordinal() >= cutoff
    ]
    if len(recent) >= FREQUENCY_MAX_TOUCHES:
        return [
            RuleViolation(
                "FREQUENCY_LIMIT",
                f"{len(recent)} outbound touches in the last {FREQUENCY_WINDOW_DAYS} "
                "days — exceeds contact-frequency limit; escalate.",
            )
        ]
    return []


def rule_first_contact(invoice: Invoice) -> list[RuleViolation]:
    """Pilot-mode human-in-the-loop: first message to a new debtor needs approval."""
    if invoice.is_new_debtor:
        return [
            RuleViolation(
                "FIRST_CONTACT_APPROVAL",
                "First contact to a new debtor — requires one-tap human approval "
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
