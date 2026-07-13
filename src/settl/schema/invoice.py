"""The canonical Invoice schema (CLAUDE.md) - the only shape agents ever read.

Every source adapter normalizes its raw blob into this type. Two invariants are
enforced structurally here:

  * ``days_overdue`` is a COMPUTED field derived from ``due_date`` and a reference
    date. It can never be set from source data, so a source that lies about how
    late a payment is cannot mislead the agents.
  * ``status`` is a fixed enum. Adapters map onto it; agents read only the enum.
    (Verifying status against real payment data is the reconcile agent's job,
    later - this layer just guarantees the shape.)
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
    VOICE = "voice"  # a phone call; recipient address is the debtor's phone


class ContactDirection(str, Enum):
    OUTBOUND = "outbound"  # a touch we sent
    INBOUND = "inbound"  # a reply from the debtor


# The token a draft carries in place of a real pay link. The sender swaps it for the
# tenant-bound ``payment_link`` AFTER the compliance gate (so the gate only ever scans
# the placeholder, never a real URL). Drafting never mints a URL - that would risk
# routing money through us. Lives here, the lowest-level module, so drafting, sending,
# and compliance can all import it without a cycle. See SCHEMA.md §5.
PAYMENT_LINK_PLACEHOLDER = "{{payment_link}}"


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
    tenant_id: str  # owning vendor; isolation enforced at the query layer + RLS
    source: Source
    source_ref: str
    amount_due: Decimal
    currency: str = "USD"
    issue_date: date
    due_date: date
    status: InvoiceStatus
    debtor_name: str
    # At least one contact method; the matching channel's address is required.
    # May both be blank → caught by validation/quarantine.
    debtor_email: str | None = None
    debtor_phone: str | None = None
    is_b2b: bool
    late_fee_allowed: bool
    # Tenant-bound pay link from the adapter (or minted on the vendor's Stripe). The
    # sender resolves the placeholder to this, after the gate; None → resolution
    # falls through to the tenant default or a hard-fail. See SCHEMA.md §5.
    payment_link: str | None = None
    prior_contacts: list[PriorContact] = Field(default_factory=list)
    raw: dict = Field(default_factory=dict)

    # Reference date used to compute overdue-ness. Defaults to today, so production
    # never stores or injects it; tests/synthetic pass an explicit date for
    # reproducibility. Source data never gets to assert how overdue an invoice is.
    as_of_date: date = Field(default_factory=date.today)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def days_overdue(self) -> int:
        """Days past due, recomputed by us - never trusted from source."""
        return (self.as_of_date - self.due_date).days

    @property
    def has_phone(self) -> bool:
        return bool(self.debtor_phone and self.debtor_phone.strip())

    def contact_for(self, channel: Channel | None) -> str | None:
        """Recipient address for a channel: phone for SMS/VOICE, else email."""
        if channel in (Channel.SMS, Channel.VOICE):
            return self.debtor_phone
        return self.debtor_email

    @property
    def outbound_contacts(self) -> list[PriorContact]:
        return [c for c in self.prior_contacts if c.direction is ContactDirection.OUTBOUND]

    @property
    def is_new_debtor(self) -> bool:
        """No prior outbound touch → first-contact, needs human approval."""
        return len(self.outbound_contacts) == 0
