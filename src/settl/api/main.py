"""FastAPI engine API - the HTTP face of the Settl engine for the dashboard.

Thin and stateless-looking on the surface: every route projects the in-process
``BoardState`` into the JSON contract in ``schemas.py``. No business logic lives
here - the orchestrator, gate, and sender remain the authorities. Routes:

    GET  /health                    liveness + whether live email is armed
    GET  /invoices                  the board (summary counts + cards)
    GET  /metrics                   money aggregates + aging (overview cockpit)
    GET  /activity                  recent execution-log feed across all invoices
    GET  /invoices/{id}             one invoice: card + draft + pipeline steps
    GET  /invoices/{id}/trace       the audit-log timeline for one invoice
    POST /invoices/{id}/approve     approve a held draft (optional edited message)
    POST /invoices/{id}/flag        flag a decision → guardrail + re-orchestrate
    GET  /guardrails                the stored operator guardrails
    POST /check-payments            poll Stripe + auto-reconcile paid links
    POST /stripe/webhook            Stripe payment/refund/dispute events (server-side)
    POST /retell/webhook            Retell end-of-call events → call artifact + opt-out
    POST /refresh                   re-run the board over the dataset

CORS is open to the Next.js dev origin(s); override with SETTL_CORS_ORIGINS.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from settl.api.schemas import (
    ActivityEntry,
    ApproveBody,
    ApproveResponse,
    BoardResponse,
    BoardSummary,
    CheckPaymentsResponse,
    FlagRequest,
    FlagResponse,
    GuardrailView,
    InvoiceCard,
    InvoiceDetail,
    Metrics,
    StepView,
    TraceEntry,
    WebhookAck,
)
from settl.api.state import BoardState
from settl.orchestrator import TerminalState
from settl.orchestrator.result import PipelineResult
from settl.schema.invoice import PAYMENT_LINK_PLACEHOLDER, Invoice
from settl.voice.registry import DoNotCallRegistry
from settl.voice.webhook import ingest_retell_webhook

# Where the execution-log JSONL is written. Defaults to the repo's runs/ dir for
# local dev; override with SETTL_RUNS_DIR on hosts with a read-only or
# package-relative filesystem (e.g. SETTL_RUNS_DIR=/tmp/runs on Cloud Run).
_RUNS = Path(
    os.environ.get("SETTL_RUNS_DIR", Path(__file__).resolve().parents[3] / "runs")
)
_RUNS.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Settl Engine API", version="0.1.0")

_origins = os.environ.get(
    "SETTL_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

state = BoardState(log_path=_RUNS / "dashboard.jsonl")
# Voice-safety state the Retell webhook writes to. Per-process like BoardState;
# moves to the durable store with everything else (VOICE_AGENT_SPEC §10).
voice_do_not_call = DoNotCallRegistry()


# -- projectors ---------------------------------------------------------------


def _card(inv: Invoice, res: PipelineResult) -> InvoiceCard:
    return InvoiceCard(
        invoice_id=inv.invoice_id,
        debtor_name=inv.debtor_name,
        amount_due=str(inv.amount_due),
        currency=inv.currency,
        days_overdue=inv.days_overdue,
        status=inv.status.value,
        is_b2b=inv.is_b2b,
        channel=res.channel,
        payment_link=inv.payment_link,
        terminal_state=res.terminal_state.value,
        detail=res.detail,
        needs_human=res.needs_human,
        can_approve=res.terminal_state is TerminalState.AWAITING_APPROVAL,
    )


def _detail(inv: Invoice, res: PipelineResult) -> InvoiceDetail:
    # Read-only preview with the placeholder resolved to the real link, so the UI can
    # show (and click) the link inline. The editable `message` keeps the placeholder -
    # the gate re-checks it on approve and would escalate a raw URL (FABRICATED_LINK).
    preview = res.message
    if res.message and inv.payment_link:
        preview = res.message.replace(PAYMENT_LINK_PLACEHOLDER, inv.payment_link)
    return InvoiceDetail(
        **_card(inv, res).model_dump(),
        message=res.message,
        message_preview=preview,
        steps=[StepView(agent=s.agent, decision=s.decision, reasoning=s.reasoning) for s in res.steps],
    )


# -- routes -------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "live_send": state.live_send_enabled,
        "drafting": "gemini" if state.gemini_enabled else "template",
        "payments": "stripe" if state.stripe_enabled else "none",
    }


@app.get("/invoices", response_model=BoardResponse)
def invoices() -> BoardResponse:
    cards = [_card(inv, res) for inv, res in state.results()]
    return BoardResponse(
        summary=BoardSummary(total=len(cards), counts=state.counts()),
        invoices=cards,
    )


@app.get("/metrics", response_model=Metrics)
def metrics() -> Metrics:
    return Metrics(**state.metrics())


@app.get("/activity", response_model=list[ActivityEntry])
def activity(limit: int = 50) -> list[ActivityEntry]:
    return [
        ActivityEntry(
            timestamp=e.timestamp, invoice_id=e.invoice_id, agent=e.agent,
            decision=e.decision, reasoning=e.reasoning,
        )
        for e in state.activity(limit)
    ]


@app.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def invoice(invoice_id: str) -> InvoiceDetail:
    found = state.get(invoice_id)
    if not found:
        raise HTTPException(404, f"unknown invoice {invoice_id}")
    return _detail(*found)


@app.get("/invoices/{invoice_id}/trace", response_model=list[TraceEntry])
def trace(invoice_id: str) -> list[TraceEntry]:
    if not state.get(invoice_id):
        raise HTTPException(404, f"unknown invoice {invoice_id}")
    return [
        TraceEntry(
            timestamp=e.timestamp, agent=e.agent, decision=e.decision,
            reasoning=e.reasoning, details=e.details,
        )
        for e in state.trace(invoice_id)
    ]


@app.post("/invoices/{invoice_id}/approve", response_model=ApproveResponse)
def approve(invoice_id: str, body: ApproveBody | None = None) -> ApproveResponse:
    if not state.get(invoice_id):
        raise HTTPException(404, f"unknown invoice {invoice_id}")
    result = state.approve(invoice_id, body.message if body else None)
    if result is None:
        raise HTTPException(409, f"{invoice_id} is not awaiting approval")
    return ApproveResponse(
        invoice_id=invoice_id,
        terminal_state=result.terminal_state.value,
        detail=result.detail,
        sent=result.terminal_state is TerminalState.SENT,
        message=result.message,
    )


@app.post("/invoices/{invoice_id}/flag", response_model=FlagResponse)
def flag(invoice_id: str, body: FlagRequest) -> FlagResponse:
    """Operator flags a decision: store a guardrail + re-orchestrate this invoice. The
    engine decides the outcome (and refuses waiving a non-waivable rule); this route only
    projects the result - no compliance/strategy logic lives here."""
    out = state.flag_decision(
        invoice_id,
        scope=body.scope,
        directive=body.directive,
        waive_code=body.waive_code,
        reason=body.reason,
        criteria=body.criteria,
    )
    if out is None:
        raise HTTPException(404, f"unknown invoice {invoice_id}")
    return FlagResponse(**out)


@app.get("/guardrails", response_model=list[GuardrailView])
def guardrails() -> list[GuardrailView]:
    return [GuardrailView(**g) for g in state.guardrails()]


@app.post("/check-payments", response_model=CheckPaymentsResponse)
def check_payments() -> CheckPaymentsResponse:
    """Poll Stripe for paid links and auto-reconcile (record fee, notify, RECOVERED).
    No-op when Stripe isn't armed. The dashboard polls this so payment reflects on
    its own - no manual marking."""
    return CheckPaymentsResponse(recovered=state.check_payments())


@app.post("/stripe/webhook", response_model=WebhookAck)
async def stripe_webhook(request: Request) -> WebhookAck:
    """Stripe → server payment/refund/dispute events. Verified against the signing
    secret, then handed to the engine to re-reconcile - so the board updates with no
    dashboard tab open. Thin projector: correlation + reconcile live in BoardState; this
    only passes the raw body + signature through and always 2xx's once verified (Stripe
    retries on non-2xx). The signature is what makes the untrusted body safe to act on."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    changed = state.ingest_webhook(payload, sig)
    return WebhookAck(received=True, changed=changed)


@app.post("/retell/webhook", response_model=WebhookAck)
async def retell_webhook(request: Request) -> WebhookAck:
    """Retell → end-of-call events (transcript, outcome). Signature-verified, then
    mapped to a CallArtifact on the execution log; a "stop calling" outcome lands on
    the do-not-call registry immediately. Thin projector: verification + mapping live
    in voice/webhook.py; an unverified or irrelevant event is acknowledged and
    dropped (never guessed). Writes to the board's own log (``state._log`` - the
    module-private handle, used here to keep artifacts in the activity feed)."""
    payload = await request.body()
    sig = request.headers.get("x-retell-signature")
    artifact = ingest_retell_webhook(
        payload, sig, log=state._log, do_not_call=voice_do_not_call
    )
    return WebhookAck(
        received=True, changed=[artifact.invoice_id] if artifact else []
    )


@app.post("/refresh", response_model=BoardResponse)
def refresh() -> BoardResponse:
    state.refresh()
    return invoices()
