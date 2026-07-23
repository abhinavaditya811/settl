"""Data model for PaymentPlan (SCHEMA.md §8).

Mirrors the `payment_plans` table (supabase/migrations/..._payment_plans.sql)
1:1. Frozen dataclasses, same shape as PaymentEvent (agents/reconcile/events.py) -
an immutable snapshot; the store module owns turning it into rows and back.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum


class PaymentPlanStatus(str, Enum):
    PROPOSED = "proposed"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    BROKEN = "broken"
    COMPLETED = "completed"


class PaymentPlanSource(str, Enum):
    TEMPLATE = "template"
    NEGOTIATED = "negotiated"


# SCHEMA.md §8: the AI may re-offer up to this many total template offers before
# mandatory human handoff.
MAX_OFFER_COUNT = 3


@dataclass(frozen=True)
class Installment:
    index: int
    amount: Decimal
    due_date: date
    payment_link: str | None = None
    paid_at: date | None = None

    @property
    def is_paid(self) -> bool:
        return self.paid_at is not None


@dataclass(frozen=True)
class PaymentPlan:
    id: str
    tenant_id: str
    invoice_id: str
    status: PaymentPlanStatus = PaymentPlanStatus.PROPOSED
    installments: tuple[Installment, ...] = field(default_factory=tuple)
    source: PaymentPlanSource = PaymentPlanSource.TEMPLATE
    template_ref: str | None = None
    offer_count: int = 1
    proposed_at: date | None = None
    decided_at: date | None = None
    decided_by: str | None = None
    contact_ref: str | None = None
    # The debtor's response to THIS offer (agents/payment_plan/negotiate.py) - a
    # plain string ("accepted" | "wants_different_terms"), not that module's enum,
    # so this model stays free of a classifier-module dependency. Surfaced to the
    # vendor before they decide (SCHEMA.md §8: the AI never acts on it itself).
    # Cleared back to None on a fresh offer/reoffer - see offer.py.
    negotiation_outcome: str | None = None
    requested_terms: str | None = None

    @property
    def total_amount(self) -> Decimal:
        return sum((i.amount for i in self.installments), Decimal("0"))

    @property
    def can_reoffer(self) -> bool:
        """Whether the AI may still re-offer a template after a rejection, vs. the
        mandatory human handoff once all 3 offers are used up (SCHEMA.md §8)."""
        return self.offer_count < MAX_OFFER_COUNT
