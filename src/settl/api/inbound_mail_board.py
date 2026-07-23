"""Inbound-mail polling: correlate, lane-route, reply (SCHEMA.md §7).

Kept out of state.py (already over CLAUDE.md's line cap), same isolation as
PaymentPlanBoard. Closes the one real gap left after Phases 1-5:
agents/payment_plan/negotiate.py::read_response was built but never wired to
anything - every PAYMENT_PLAN_REQUEST classification was alert-only regardless
of whether a plan was already in flight. This module is what actually calls it.

fetch/send are injectable (default: gmail.mcp_client's real subprocess calls)
specifically so this module's own logic - correlation, lane routing, plan
negotiation - is fully unit-testable against fakes, independent of the one
piece that genuinely needs a real subprocess+credentials (see mcp_client.py).
"""

from __future__ import annotations

import re
from email.utils import parseaddr
from typing import Callable

from settl.agents.payment_plan.models import PaymentPlan, PaymentPlanStatus
from settl.agents.payment_plan.negotiate import read_response
from settl.audit.execution_log import ExecutionLog
from settl.data import config_for
from settl.data import supabase as db
from settl.gmail import fetch_new_messages as _default_fetch
from settl.gmail import send_reply as _default_send
from settl.gmail.messages import GmailMessage
from settl.orchestrator import Orchestrator, TerminalState
from settl.orchestrator.result import PipelineResult, PipelineStep
from settl.schema.invoice import Channel, ContactDirection, Invoice, PriorContact

_SUBJECT_ID_RE = re.compile(r" - (\S+)\s*$")

Fetch = Callable[[str], list[dict]]
Send = Callable[..., str | None]

# A plan in either of these statuses is still "in flight" - a reply belongs to
# the negotiation lane, not the generic inbound classifier (SCHEMA.md §8).
_NEGOTIABLE_PLAN_STATUSES = frozenset({PaymentPlanStatus.PROPOSED, PaymentPlanStatus.ACTIVE})


def invoice_id_from_subject(subject: str) -> str | None:
    """The fallback correlation per SCHEMA.md §7: outbound subjects are
    literally f"{prefix} - {invoice_id}" (sending/email_sender.py) - a reply's
    subject carries the same trailing " - <id>" even through a "Re: " prefix."""
    m = _SUBJECT_ID_RE.search(subject)
    return m.group(1) if m else None


class InboundMailBoard:
    def __init__(self, *, orchestrator: Orchestrator, log: ExecutionLog | None = None) -> None:
        self._orchestrator = orchestrator
        self._log = log

    # -- correlation ------------------------------------------------------

    def correlate(self, msg: GmailMessage, invoices: dict[str, Invoice]) -> str | None:
        """Message-ID threading first, subject-id fallback - never guesses;
        None means "log and skip", same posture as BoardState._correlate for
        Stripe webhooks."""
        if msg.in_reply_to and db.supabase_enabled():
            found = db.find_by_message_id(msg.in_reply_to)
            if found and found[1] in invoices:
                return found[1]
        candidate = invoice_id_from_subject(msg.subject)
        if candidate and candidate in invoices:
            return candidate
        return None

    def already_processed(self, msg: GmailMessage) -> bool:
        """True if this exact Message-ID was already recorded - the poll's
        idempotency check for a redelivered/re-polled message."""
        if not db.supabase_enabled():
            return False
        return db.find_by_message_id(msg.message_id) is not None

    # -- per-message handling ----------------------------------------------

    def handle_message(
        self, invoice: Invoice, msg: GmailMessage, plan: PaymentPlan | None
    ) -> PipelineResult:
        if plan is not None and plan.status in _NEGOTIABLE_PLAN_STATUSES:
            return self._handle_plan_negotiation(invoice, msg, plan)
        result = self._orchestrator.handle_inbound(invoice, msg.body_text)
        classification = next(
            (s.decision for s in result.steps if s.agent == "inbound_classifier"), None
        )
        self._write_inbound_contact(invoice, msg, classification=classification)
        return result

    def _handle_plan_negotiation(
        self, invoice: Invoice, msg: GmailMessage, plan: PaymentPlan
    ) -> PipelineResult:
        negotiation = read_response(msg.body_text)
        self._write_inbound_contact(
            invoice, msg, classification=f"payment_plan_{negotiation.outcome.value}"
        )
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id, agent="payment_plan_negotiate",
                decision=negotiation.outcome.value, reasoning=negotiation.reasoning,
                requested_terms=negotiation.requested_terms or "",
            )
        # Confirms nothing itself - the vendor's existing approve/reject action
        # (Phase 4, unchanged) is still the only path that ever sends anything.
        return PipelineResult(
            invoice.invoice_id, TerminalState.HELD,
            steps=[PipelineStep("payment_plan_negotiate", negotiation.outcome.value, negotiation.reasoning)],
            detail="Debtor responded to the payment-plan offer - awaiting vendor decision.",
        )

    def _write_inbound_contact(
        self, invoice: Invoice, msg: GmailMessage, *, classification: str | None
    ) -> None:
        if not db.supabase_enabled():
            return
        contact = PriorContact(
            occurred_on=msg.occurred_at.date(), direction=ContactDirection.INBOUND,
            channel=Channel.EMAIL, summary=msg.body_text[:500],
            provider_message_id=msg.message_id, in_reply_to=msg.in_reply_to,
            thread_ref=msg.thread_id, classification=classification,
        )
        db.write_contact(invoice.tenant_id, invoice.invoice_id, contact)

    # -- poll ---------------------------------------------------------------

    def poll(
        self,
        tenant_id: str,
        invoices: dict[str, Invoice],
        plans: dict[str, PaymentPlan],
        *,
        fetch: Fetch | None = None,
        send: Send | None = None,
    ) -> list[tuple[str, PipelineResult]]:
        fetch = fetch or _default_fetch
        send = send or _default_send
        try:
            raw_messages = fetch(tenant_id)
        except Exception as exc:
            self._log_skip(f"poll failed for {tenant_id}: {exc}")
            return []

        changed: list[tuple[str, PipelineResult]] = []
        for raw in raw_messages:
            msg = _message_from_dict(raw)
            if self.already_processed(msg):
                continue
            invoice_id = self.correlate(msg, invoices)
            if invoice_id is None:
                self._log_skip(f"could not correlate message {msg.message_id} to an invoice")
                continue

            invoice = invoices[invoice_id]
            result = self.handle_message(invoice, msg, plans.get(invoice_id))
            if result.terminal_state is TerminalState.SENT and result.message:
                self._send_and_record(tenant_id, invoice, msg, result.message, send)
            changed.append((invoice_id, result))
        return changed

    def _send_and_record(self, tenant_id, invoice: Invoice, msg: GmailMessage, body: str, send: Send) -> None:
        # Gmail sends as the authenticated (tenant's) account regardless of the
        # MIME From header, but the header still needs a real value for display
        # - the vendor's own identity, never the debtor's address.
        _, reply_to = parseaddr(msg.from_address)
        from_address = config_for(tenant_id).identity.from_address or ""
        sent_message_id = send(
            tenant_id, thread_id=msg.thread_id, in_reply_to_message_id=msg.message_id,
            to=reply_to or msg.from_address, from_address=from_address,
            subject=msg.subject, body_text=body,
        )
        if sent_message_id and db.supabase_enabled():
            db.write_contact(
                invoice.tenant_id, invoice.invoice_id,
                PriorContact(
                    occurred_on=msg.occurred_at.date(), direction=ContactDirection.OUTBOUND,
                    channel=Channel.EMAIL, summary=body[:500],
                    provider_message_id=sent_message_id, in_reply_to=msg.message_id,
                    thread_ref=msg.thread_id,
                ),
            )

    def _log_skip(self, reason: str) -> None:
        if self._log is not None:
            self._log.record(invoice_id="-", agent="inbound_mail", decision="skipped", reasoning=reason)


def _message_from_dict(raw: dict) -> GmailMessage:
    from datetime import datetime

    return GmailMessage(
        message_id=raw["message_id"], thread_id=raw["thread_id"],
        in_reply_to=raw.get("in_reply_to"), references=raw.get("references"),
        subject=raw["subject"], from_address=raw["from_address"], body_text=raw["body_text"],
        occurred_at=datetime.fromisoformat(raw["occurred_at"]),
    )
