"""Canonical reconcile events + outcome (Week 4).

Reconcile is event-sourced so it never trusts ``invoice.status``: it re-derives the
real state from payment (and later, reply) events. The events are a canonical shape;
a synthetic loader produces them for tests/offline and a Stripe adapter produces them
live - the agent reasons only over this shape, same boundary as the Invoice adapters.

Phase 1 covers full payment (PAID); PARTIAL/UNPAID are represented now so the loop can
extend without reshaping. REPLY (inbound) lands in a later phase.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import Enum

from settl.agents.reconcile.fee import FeeRecord


class ReconcileStatus(str, Enum):
    PAID = "paid"  # settled in full → stop the loop, record the fee
    PARTIAL = "partial"  # some paid, balance remains (phase 2)
    UNPAID = "unpaid"  # nothing detected → re-queue for the next touch
    REPLY = "reply"  # an inbound reply/dispute → escalate (later phase)


@dataclass(frozen=True)
class PaymentEvent:
    """One payment observed against an invoice, normalized from any processor."""

    invoice_id: str
    amount: Decimal
    occurred_on: date
    source: str = "manual"  # "manual" | "stripe" | "synthetic"
    reference: str = ""  # processor id (e.g. Stripe payment intent), for the trail


@dataclass(frozen=True)
class ReconcileOutcome:
    """What reconcile decided for one invoice this run."""

    status: ReconcileStatus
    stop_loop: bool  # True → the unpaid loop ends here
    amount_recovered: Decimal
    fee: FeeRecord | None = None
    reasoning: str = ""
