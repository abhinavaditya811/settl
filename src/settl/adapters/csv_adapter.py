"""CSV -> canonical Invoice (adapters/csv_adapter, per CLAUDE.md's own naming
convention). Normalizes a raw CSV export into the canonical shape; nothing
downstream (orchestrator, strategy, compliance) ever sees a CSV column name. A
future PDF/photo adapter (Source.PDF) slots in behind the exact same seam: parse
-> canonical Invoice -> validate/quarantine -> data.supabase.ingest.insert_invoices
- only the parsing step changes.

Two tiers of "bad row", because an invoice's storage columns are NOT NULL/typed
while completeness (a usable contact method, a positive amount) is a runtime
concern (SCHEMA.md §6):
  * REJECTED - a required, typed field (amount/date/is_b2b) doesn't parse. This row
    structurally cannot become a canonical Invoice at all, so it's surfaced
    synchronously in the upload response and never written.
  * QUARANTINED - every required field parses, but validate_invoice finds it
    incomplete (no contact method, non-positive amount, dates crossed). This DOES
    become an Invoice and IS written - the orchestrator quarantines it visibly on
    the board with a reason, the same validate+quarantine seam every other Invoice
    goes through (never silently dropped).
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation

from settl.schema.invoice import Invoice, Source
from settl.schema.validation import validate_invoice

REQUIRED_HEADERS = ("invoice_number", "debtor_name", "amount_due", "issue_date", "due_date", "is_b2b")

# A light guard, not a real streaming-import design - fine at demo/pilot scale,
# not engineered for bulk migrations.
MAX_ROWS = 5000

_TRUE = {"true", "1", "yes", "b2b"}
_FALSE = {"false", "0", "no", "consumer", "b2c"}


class CsvFormatError(ValueError):
    """The file itself is unusable (missing a required column) - rejected before
    any row is parsed."""


@dataclass(frozen=True)
class RowReject:
    row: int  # 1-indexed, matching what a spreadsheet user sees
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class CsvImportResult:
    invoices: list[Invoice]  # actionable + quarantined - both get written
    quarantined_ids: list[str]
    rejected: list[RowReject]


def _parse_amount(raw: str) -> Decimal | None:
    cleaned = raw.strip().replace("$", "").replace(",", "")
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_date(raw: str) -> date | None:
    try:
        return date.fromisoformat(raw.strip())
    except ValueError:
        return None


def _parse_bool(raw: str, default: bool | None) -> bool | None:
    """None return means "ambiguous, reject" - a blank value uses `default`
    instead, since a blank is a deliberate, sanctioned default, not garbage."""
    v = raw.strip().lower()
    if not v:
        return default
    if v in _TRUE:
        return True
    if v in _FALSE:
        return False
    return None


def parse_csv(csv_text: str, tenant_id: str) -> CsvImportResult:
    reader = csv.DictReader(io.StringIO(csv_text))
    headers = set(reader.fieldnames or [])
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if missing:
        raise CsvFormatError(f"missing required column(s): {', '.join(missing)}")

    invoices: list[Invoice] = []
    quarantined_ids: list[str] = []
    rejected: list[RowReject] = []

    for i, row in enumerate(reader, start=1):
        if i > MAX_ROWS:
            raise CsvFormatError(f"too many rows (max {MAX_ROWS})")

        reasons: list[str] = []

        source_ref = (row.get("invoice_number") or "").strip()
        if not source_ref:
            reasons.append("invoice_number is required")

        amount = _parse_amount(row.get("amount_due") or "")
        if amount is None:
            reasons.append("amount_due is not a valid number")

        issue_date = _parse_date(row.get("issue_date") or "")
        if issue_date is None:
            reasons.append("issue_date must be YYYY-MM-DD")

        due_date = _parse_date(row.get("due_date") or "")
        if due_date is None:
            reasons.append("due_date must be YYYY-MM-DD")

        is_b2b = _parse_bool(row.get("is_b2b") or "", default=None)
        if is_b2b is None:
            reasons.append("is_b2b must be true/false (or b2b/consumer)")

        currency = (row.get("currency") or "USD").strip().upper() or "USD"
        if len(currency) != 3 or not currency.isalpha():
            reasons.append("currency must be a 3-letter code")

        late_fee = _parse_bool(row.get("late_fee_allowed") or "", default=False)
        if late_fee is None:
            reasons.append("late_fee_allowed must be true/false")

        if reasons:
            rejected.append(RowReject(row=i, reasons=tuple(reasons)))
            continue

        invoice = Invoice(
            invoice_id=f"csv-{tenant_id}-{source_ref}",
            tenant_id=tenant_id,
            source=Source.CSV,
            source_ref=source_ref,
            amount_due=amount,
            currency=currency,
            issue_date=issue_date,
            due_date=due_date,
            status="open",
            debtor_name=(row.get("debtor_name") or "").strip(),
            debtor_email=(row.get("debtor_email") or "").strip() or None,
            debtor_phone=(row.get("debtor_phone") or "").strip() or None,
            is_b2b=is_b2b,
            late_fee_allowed=late_fee,
            payment_link=(row.get("payment_link") or "").strip() or None,
            raw=dict(row),
        )
        invoices.append(invoice)
        if validate_invoice(invoice):
            quarantined_ids.append(invoice.invoice_id)

    return CsvImportResult(invoices=invoices, quarantined_ids=quarantined_ids, rejected=rejected)
