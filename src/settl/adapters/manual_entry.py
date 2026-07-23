"""One invoice, typed directly into the dashboard form (Source.MANUAL). Thinner than
csv_adapter.py - the form already collects typed values, so there's no REJECTED tier
to invent; the only outstanding check is validate_invoice's existing completeness
gate (no contact method, non-positive amount, ...), which the orchestrator
quarantines visibly on the board, same as every other Invoice.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from settl.schema.invoice import Invoice, Source


def _compact_invoice_id(source_ref: str) -> str:
    """A short, readable, globally-unique invoice id. Keeps the human invoice
    number visible but drops the 36-char tenant UUID that used to bloat every
    email subject line and dashboard row (``manual-<uuid>-INV-0513`` →
    ``manual-INV-0513-7f3a9c``). A short random suffix keeps it unique across
    tenants - invoice_id is a global primary key, and two tenants can legitimately
    use the same invoice number. Sanitised so it never contains whitespace, since
    the reply-subject correlation (inbound_mail_board) extracts the trailing token."""
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", source_ref).strip("-")[:24] or uuid.uuid4().hex[:8]
    return f"manual-{slug}-{uuid.uuid4().hex[:6]}"


@dataclass(frozen=True)
class ManualInvoiceInput:
    debtor_name: str
    amount_due: Decimal
    issue_date: date
    due_date: date
    is_b2b: bool
    debtor_email: str | None = None
    debtor_phone: str | None = None
    currency: str = "USD"
    late_fee_allowed: bool = False
    payment_link: str | None = None
    invoice_number: str | None = None  # blank -> a generated source_ref


def build_manual_invoice(tenant_id: str, payload: ManualInvoiceInput) -> Invoice:
    source_ref = (payload.invoice_number or "").strip() or uuid.uuid4().hex[:10]
    return Invoice(
        invoice_id=_compact_invoice_id(source_ref),
        tenant_id=tenant_id,
        source=Source.MANUAL,
        source_ref=source_ref,
        amount_due=payload.amount_due,
        currency=payload.currency,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        status="open",
        debtor_name=payload.debtor_name.strip(),
        debtor_email=(payload.debtor_email or "").strip() or None,
        debtor_phone=(payload.debtor_phone or "").strip() or None,
        is_b2b=payload.is_b2b,
        late_fee_allowed=payload.late_fee_allowed,
        payment_link=(payload.payment_link or "").strip() or None,
        raw={"entry_method": "manual"},
    )
