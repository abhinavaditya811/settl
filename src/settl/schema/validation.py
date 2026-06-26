"""Validate + quarantine (CLAUDE.md / DESIGN §4).

After an adapter produces a canonical Invoice, we check completeness. Anything we
cannot act on safely is *quarantined* and flagged to a human ("couldn't read this
invoice") - we never guess a missing field. This is a soft gate that returns issues
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


def _looks_like_email(value: str | None) -> bool:
    if not value:
        return False
    value = value.strip()
    return "@" in value and "." in value


def _looks_like_phone(value: str | None) -> bool:
    if not value:
        return False
    return sum(c.isdigit() for c in value) >= 7


def _has_valid_contact(invoice: Invoice) -> bool:
    """At least one usable contact method (email or phone)."""
    return _looks_like_email(invoice.debtor_email) or _looks_like_phone(invoice.debtor_phone)


def validate_invoice(invoice: Invoice) -> list[ValidationIssue]:
    """Return completeness issues; empty list means the invoice is actionable."""
    issues: list[ValidationIssue] = []

    if invoice.amount_due is None or invoice.amount_due <= Decimal("0"):
        issues.append(ValidationIssue("amount_due", "amount must be a positive number"))

    if not _has_valid_contact(invoice):
        issues.append(
            ValidationIssue("contact", "missing or unreadable email/phone")
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
