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
    ) -> tuple[PipelineResult, Invoice]:
        """Returns the pipeline result AND the invoice with this message's
        contact appended - the caller (poll()) must write it back into its
        ``invoices`` dict, or rule_contact_frequency evaluates every future
        message on a stale, ever-shrinking-relative touch count (a real
        feedback loop: an auto-reply that never counts against itself)."""
        if plan is not None and plan.status in _NEGOTIABLE_PLAN_STATUSES:
            return self._handle_plan_negotiation(invoice, msg, plan)
        result = self._orchestrator.handle_inbound(invoice, msg.body_text)
        classification = next(
            (s.decision for s in result.steps if s.agent == "inbound_classifier"), None
        )
        invoice = self._write_inbound_contact(invoice, msg, classification=classification)
        return result, invoice

    def _handle_plan_negotiation(
        self, invoice: Invoice, msg: GmailMessage, plan: PaymentPlan
    ) -> tuple[PipelineResult, Invoice]:
        negotiation = read_response(msg.body_text)
        invoice = self._write_inbound_contact(
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
        result = PipelineResult(
            invoice.invoice_id, TerminalState.HELD,
            steps=[PipelineStep("payment_plan_negotiate", negotiation.outcome.value, negotiation.reasoning)],
            detail="Debtor responded to the payment-plan offer - awaiting vendor decision.",
        )
        return result, invoice

    def _write_inbound_contact(
        self, invoice: Invoice, msg: GmailMessage, *, classification: str | None
    ) -> Invoice:
        # In-memory history updates unconditionally - it's what keeps
        # rule_contact_frequency correct across poll cycles in THIS process,
        # independent of whether Supabase is armed to persist it durably too.
        contact = PriorContact(
            occurred_on=msg.occurred_at.date(), direction=ContactDirection.INBOUND,
            channel=Channel.EMAIL, summary=msg.body_text[:500],
            provider_message_id=msg.message_id, in_reply_to=msg.in_reply_to,
            thread_ref=msg.thread_id, classification=classification,
        )
        if db.supabase_enabled():
            db.write_contact(invoice.tenant_id, invoice.invoice_id, contact)
        return invoice.model_copy(update={"prior_contacts": [*invoice.prior_contacts, contact]})

    # -- poll ---------------------------------------------------------------

    def poll(
        self,
        tenant_id: str,
        invoices: dict[str, Invoice],
        plans: dict[str, PaymentPlan],
        results: dict[str, PipelineResult] | None = None,
        *,
        fetch: Fetch | None = None,
        send: Send | None = None,
    ) -> list[tuple[str, PipelineResult]]:
        fetch = fetch or _default_fetch
        send = send or _default_send
        results = results or {}
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
            result, invoice = self.handle_message(invoice, msg, plans.get(invoice_id))
            invoices[invoice_id] = invoice  # keep in-memory history current for the
                                             # next message's rule_contact_frequency check,
                                             # regardless of whether the board result below
                                             # ends up suppressed
            current = results.get(invoice_id)
            if (
                result.terminal_state is TerminalState.AWAITING_APPROVAL
                and current is not None
                and current.terminal_state is TerminalState.AWAITING_APPROVAL
            ):
                # A draft is already sitting there un-actioned - don't silently swap
                # it for an unrelated one just because a benign reply came in. Any
                # more urgent lane (dispute/opt-out/payment-plan) still produces
                # ESCALATED here, never AWAITING_APPROVAL, so it's never suppressed.
                self._log_skip(
                    f"{invoice_id}: reply noted, but a draft is already awaiting "
                    "approval - not replacing it with a new one"
                )
                continue
            if result.terminal_state is TerminalState.SENT and result.message:
                invoice = self._send_and_record(tenant_id, invoice, msg, result.message, send)
                invoices[invoice_id] = invoice
            changed.append((invoice_id, result))
        return changed

    def _send_and_record(
        self, tenant_id, invoice: Invoice, msg: GmailMessage, body: str, send: Send
    ) -> Invoice:
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
        if not sent_message_id:
            return invoice
        # In-memory history updates unconditionally, same reasoning as
        # _write_inbound_contact - see its comment.
        contact = PriorContact(
            occurred_on=msg.occurred_at.date(), direction=ContactDirection.OUTBOUND,
            channel=Channel.EMAIL, summary=body[:500],
            provider_message_id=sent_message_id, in_reply_to=msg.message_id,
            thread_ref=msg.thread_id,
        )
        if db.supabase_enabled():
            db.write_contact(invoice.tenant_id, invoice.invoice_id, contact)
        return invoice.model_copy(update={"prior_contacts": [*invoice.prior_contacts, contact]})

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
