"""The canonical Invoice schema (CLAUDE.md) — the only shape agents ever read.

Every source adapter normalizes its raw blob into this type. Two invariants are
enforced structurally here:

  * ``days_overdue`` is a COMPUTED field derived from ``due_date`` and a reference
    date. It can never be set from source data, so a source that lies about how
    late a payment is cannot mislead the agents.
  * ``status`` is a fixed enum. Adapters map onto it; agents read only the enum.
    (Verifying status against real payment data is the reconcile agent's job,
    later — this layer just guarantees the shape.)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, computed_field


class Source(str, Enum):
    STRIPE = "stripe"
    CSV = "csv"
    QUICKBOOKS = "quickbooks"
    PDF = "pdf"


class InvoiceStatus(str, Enum):
    OPEN = "open"
    PAID = "paid"
    PARTIAL = "partial"
    DISPUTED = "disputed"


class Channel(str, Enum):
    EMAIL = "email"
    SMS = "sms"


class ContactDirection(str, Enum):
    OUTBOUND = "outbound"  # a touch we sent
    INBOUND = "inbound"  # a reply from the debtor


class PriorContact(BaseModel):
    """One historical touch on this invoice (ours or the debtor's reply)."""

    occurred_on: date
    direction: ContactDirection
    channel: Channel
    summary: str = ""


class Invoice(BaseModel):
    """Canonical invoice. All agents read only this; never a raw source blob."""

    model_config = ConfigDict(frozen=True)

    invoice_id: str
    source: Source
    source_ref: str
    amount_due: Decimal
    currency: str = "USD"
    issue_date: date
    due_date: date
    status: InvoiceStatus
    debtor_name: str
    debtor_contact: str  # email or phone; may be blank → caught by validation
    is_b2b: bool
    late_fee_allowed: bool
    prior_contacts: list[PriorContact] = Field(default_factory=list)
    raw: dict = Field(default_factory=dict)

    # Reference date used to compute overdue-ness. The adapter/loader sets this;
    # source data never gets to assert how overdue an invoice is.
    as_of_date: date

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_overdue(self) -> int:
        """Days past due, recomputed by us — never trusted from source."""
        return (self.as_of_date - self.due_date).days

    @property
    def has_phone(self) -> bool:
        digits = sum(c.isdigit() for c in self.debtor_contact)
        return "@" not in self.debtor_contact and digits >= 7

    @property
    def outbound_contacts(self) -> list[PriorContact]:
        return [c for c in self.prior_contacts if c.direction is ContactDirection.OUTBOUND]

    @property
    def is_new_debtor(self) -> bool:
        """No prior outbound touch → first-contact, needs human approval."""
        return len(self.outbound_contacts) == 0
