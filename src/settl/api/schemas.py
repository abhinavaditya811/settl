"""API response models - the JSON contract the dashboard consumes.

These are deliberately presentation-shaped (strings, labels, counts) so the
frontend renders without re-deriving anything. They never expose a raw invoice;
they project the canonical ``Invoice`` + ``PipelineResult`` the engine produced.
"""

from __future__ import annotations

from pydantic import BaseModel


class StepView(BaseModel):
    agent: str
    decision: str
    reasoning: str


class TraceEntry(BaseModel):
    timestamp: str
    agent: str
    decision: str
    reasoning: str
    details: dict = {}


class InvoiceCard(BaseModel):
    """One row/card on the board."""

    invoice_id: str
    debtor_name: str
    amount_due: str
    currency: str
    days_overdue: int
    status: str  # invoice status: open/paid/partial/disputed
    is_b2b: bool
    channel: str | None = None
    payment_link: str | None = None  # the debtor's pay link (customer's own processor)
    terminal_state: str  # sent / awaiting_approval / escalated / ...
    detail: str
    needs_human: bool
    can_approve: bool  # true only for awaiting_approval


class InvoiceDetail(InvoiceCard):
    """A card plus the full draft and the per-hop pipeline steps."""

    message: str | None = None  # the gated draft - keeps the {{payment_link}} placeholder
    message_preview: str | None = None  # read-only: placeholder resolved to the real link
    steps: list[StepView] = []


class BoardSummary(BaseModel):
    total: int
    counts: dict[str, int]  # terminal_state -> count


class BoardResponse(BaseModel):
    summary: BoardSummary
    invoices: list[InvoiceCard]


class ApproveResponse(BaseModel):
    invoice_id: str
    terminal_state: str
    detail: str
    sent: bool
    message: str | None = None


class ApproveBody(BaseModel):
    message: str | None = None  # optional human-edited draft (re-checked by the gate)


class ActivityEntry(BaseModel):
    timestamp: str
    invoice_id: str
    agent: str
    decision: str
    reasoning: str


class AgingBucket(BaseModel):
    bucket: str
    count: int
    amount: float


class Metrics(BaseModel):
    currency: str
    other_currencies: list[str]
    outstanding: float
    in_flight: float
    recovered: float
    awaiting_count: int
    awaiting_amount: float
    aging: list[AgingBucket]
