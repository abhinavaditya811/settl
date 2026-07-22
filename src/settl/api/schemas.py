"""API response models - the JSON contract the dashboard consumes.

These are deliberately presentation-shaped (strings, labels, counts) so the
frontend renders without re-deriving anything. They never expose a raw invoice;
they project the canonical ``Invoice`` + ``PipelineResult`` the engine produced.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


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
    # ISO timestamp - when this invoice's tenant mailbox was last polled (scheduled
    # or manual), None if never. Same source as /health's inbound_poll.last_polled_at.
    last_inbound_poll_at: str | None = None


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


class CheckPaymentsResponse(BaseModel):
    recovered: list[str]  # invoice ids auto-reconciled to RECOVERED on this poll


class CheckInboundMailResponse(BaseModel):
    changed: list[str]  # invoice ids whose board state moved on this poll


class WebhookAck(BaseModel):
    received: bool  # always true once the signature verified (Stripe wants a fast 2xx)
    changed: list[str] = []  # invoice ids whose board state moved on this event


class FlagRequest(BaseModel):
    """An operator flags a decision → a durable guardrail + re-orchestration."""

    scope: str  # "strategy" | "compliance"
    directive: str  # always_escalate | force_skip | force_hold | soften_tone | waive
    waive_code: str | None = None  # for directive=waive (soft codes only)
    reason: str = ""
    criteria: dict | None = None  # attribute match; defaults to this invoice's attrs


class FlagResponse(BaseModel):
    invoice_id: str
    terminal_state: str  # the re-orchestrated outcome
    detail: str
    rule_id: str  # the stored guardrail's id
    applied: bool  # False if the flag was rejected (e.g. waiving a non-waivable code)
    note: str = ""


class GuardrailView(BaseModel):
    rule_id: str
    scope: str
    directive: str
    criteria: dict
    waive_code: str | None = None
    reason: str = ""
    created_at: str = ""


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


class CsvImportBody(BaseModel):
    csv: str  # raw file text - the browser reads File.text(), no multipart needed


class RowIssue(BaseModel):
    row: int  # 1-indexed, matching what a spreadsheet user sees
    reasons: list[str]


class CsvImportResponse(BaseModel):
    accepted: int  # written (actionable + quarantined)
    quarantined: int  # subset of accepted the orchestrator will quarantine
    rejected: list[RowIssue]  # never written - a required field didn't parse
    invoice_ids: list[str]


class ManualInvoiceBody(BaseModel):
    debtor_name: str
    amount_due: str  # decimal-as-string, same convention as InvoiceCard.amount_due
    issue_date: str  # YYYY-MM-DD
    due_date: str
    is_b2b: bool
    debtor_email: str | None = None
    debtor_phone: str | None = None
    currency: str = "USD"
    late_fee_allowed: bool = False
    payment_link: str | None = None
    invoice_number: str | None = None


class ManualEntryResponse(BaseModel):
    invoice_id: str
    quarantined: bool
    issues: list[str] = []


class InstallmentView(BaseModel):
    index: int
    amount: str
    due_date: str
    payment_link: str | None = None
    paid_at: str | None = None


class PaymentPlanView(BaseModel):
    invoice_id: str
    status: str  # proposed | approved | rejected | active | broken | completed
    installments: list[InstallmentView]
    source: str  # template | negotiated
    template_ref: str | None = None
    offer_count: int
    can_reoffer: bool


class PaymentPlanDecisionBody(BaseModel):
    approved: bool


class PaymentPlanDecisionResponse(BaseModel):
    invoice_id: str
    plan_status: str
    offer_count: int
    terminal_state: str
    detail: str


class PaymentPlanTemplateView(BaseModel):
    installments: int = Field(ge=1, le=24)  # a sane UI bound; the engine itself has none
    period_days: int = Field(ge=1, le=365)
    label: str = ""


class PaymentPlanTemplatesBody(BaseModel):
    templates: list[PaymentPlanTemplateView]
