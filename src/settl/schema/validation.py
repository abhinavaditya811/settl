"""Validate + quarantine (CLAUDE.md / DESIGN §4).

After an adapter produces a canonical Invoice, we check completeness. Anything we
cannot act on safely is *quarantined* and flagged to a human ("couldn't read this
invoice") — we never guess a missing field. This is a soft gate that returns issues
rather than raising, so one bad row never crashes a batch.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from settl.schema.invoice import Invoice


@dataclass(frozen=True)
class ValidationIssue:
    field: str
    message: str


def _looks_like_contact(value: str) -> bool:
    value = value.strip()
    if "@" in value and "." in value:
        return True
    digits = sum(c.isdigit() for c in value)
    return digits >= 7


def validate_invoice(invoice: Invoice) -> list[ValidationIssue]:
    """Return completeness issues; empty list means the invoice is actionable."""
    issues: list[ValidationIssue] = []

    if invoice.amount_due is None or invoice.amount_due <= Decimal("0"):
        issues.append(ValidationIssue("amount_due", "amount must be a positive number"))

    if not invoice.debtor_contact or not _looks_like_contact(invoice.debtor_contact):
        issues.append(
            ValidationIssue("debtor_contact", "missing or unreadable email/phone")
        )

    if not invoice.debtor_name.strip():
        issues.append(ValidationIssue("debtor_name", "missing debtor name"))

    if invoice.due_date < invoice.issue_date:
        issues.append(ValidationIssue("due_date", "due date precedes issue date"))

    return issues


def partition_invoices(
    invoices: list[Invoice],
) -> tuple[list[Invoice], list[tuple[Invoice, list[ValidationIssue]]]]:
    """Split a batch into (actionable, quarantined-with-reasons)."""
    actionable: list[Invoice] = []
    quarantined: list[tuple[Invoice, list[ValidationIssue]]] = []
    for inv in invoices:
        issues = validate_invoice(inv)
        if issues:
            quarantined.append((inv, issues))
        else:
            actionable.append(inv)
    return actionable, quarantined
