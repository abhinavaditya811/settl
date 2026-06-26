"""Success-fee recording - **records, never collects** (CLAUDE.md: never custodial).

When an invoice is recovered we record a ``FeeRecord`` (our success fee on the
recovered amount) for billing/evidence. We never touch the money: the debtor paid the
vendor directly through the vendor's own processor. This module produces the record only.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from settl.schema.invoice import Invoice


@dataclass(frozen=True)
class FeeRecord:
    invoice_id: str
    recovered_amount: Decimal
    fee_pct: float
    fee_amount: Decimal
    currency: str
    recorded_on: date
    note: str = "recorded, not collected (non-custodial)"


def record_fee(
    invoice: Invoice,
    recovered: Decimal,
    fee_pct: float,
    *,
    on_date: date | None = None,
) -> FeeRecord:
    """Compute and return the success-fee record. No side effects, no collection."""
    recovered = Decimal(recovered)
    fee_amount = (recovered * Decimal(str(fee_pct)) / Decimal(100)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return FeeRecord(
        invoice_id=invoice.invoice_id,
        recovered_amount=recovered,
        fee_pct=fee_pct,
        fee_amount=fee_amount,
        currency=invoice.currency,
        recorded_on=on_date or date.today(),
    )
