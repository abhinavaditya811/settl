"""ReconciliationDesk - payment-event correlation and reconcile idempotency, split
out of BoardState (SRP - see CLAUDE.md's line cap; state.py should stay the board
projector/composition root, not also own Stripe poll/webhook correlation bookkeeping).

Holds `_invoices` and `_results` by reference into BoardState's dicts. BoardState
mutates those dicts in place (clear + update) rather than reassigning them on
refresh, so the reference this desk holds never goes stale.
"""

from __future__ import annotations

import os
from dataclasses import replace
from datetime import date
from typing import Callable

from settl.agents.reconcile import (
    PaymentEvent,
    ReconcileAgent,
    ReconcileOutcome,
    ReconcileStatus,
    classify,
    tally_events,
)
from settl.audit import ExecutionLog
from settl.data import supabase as db
from settl.orchestrator import TerminalState
from settl.orchestrator.result import PipelineResult, PipelineStep
from settl.payments.webhook import parse_event, verify_event
from settl.schema.invoice import Invoice

# In-flight states a payment can still arrive for (so reconcile polls only these).
_RECONCILABLE_STATES = (
    TerminalState.SENT,
    TerminalState.AWAITING_APPROVAL,
    TerminalState.HELD,
    TerminalState.ESCALATED,
)


class ReconciliationDesk:
    def __init__(
        self,
        *,
        minter,
        reconciler: ReconcileAgent,
        log: ExecutionLog,
        invoices: dict[str, Invoice],
        results: dict[str, PipelineResult],
        tenant_of: Callable[[str], str | None],
    ) -> None:
        self._minter = minter
        self._reconciler = reconciler
        self._log = log
        self._invoices = invoices
        self._results = results
        self._tenant_of = tenant_of
        # Append-only money-event log per invoice; poll AND webhook write here and
        # reconcile always re-derives over the full log (so refunds/disputes reverse).
        self._events: dict[str, list[PaymentEvent]] = {}
        self._reconcile_sig: dict[str, str] = {}  # last applied outcome, for idempotency
        # Correlation maps so a Stripe event routes back to an invoice.
        self._link_to_invoice: dict[str, str] = {}  # payment_link id → invoice
        self._pi_to_invoice: dict[str, str] = {}  # payment_intent → invoice (learned)

    def reset(self) -> None:
        """Called at the top of BoardState.refresh() - a fresh run starts with no
        correlation history (it's rebuilt as invoices are re-enriched / events replayed)."""
        self._events.clear()
        self._reconcile_sig.clear()
        self._link_to_invoice.clear()
        self._pi_to_invoice.clear()

    def load_events(self, events: dict[str, list[PaymentEvent]]) -> None:
        """Replay persisted payment events so reconcile state (RECOVERED/PARTIAL/
        escalated) survives a restart instead of resetting until the next poll.

        notify=False: these events were already processed - and their operator
        "Recovered/Needs review" email already sent - before the restart. Only a
        genuinely-new payment discovered live (check_payments/webhook) notifies;
        replaying known history must be silent, or every restart re-emails."""
        self._events = events
        for invoice_id in list(self._events):
            self._apply_reconcile(invoice_id, notify=False)

    def enrich_payment_links(self, invoices: list[Invoice]) -> list[Invoice]:
        """For the demo, mint a real (test-mode) Stripe link per invoice so the board,
        drawer, and email all carry a payable link. Minting is cached per invoice and
        fail-safe (an invoice keeps its existing link if minting returns None)."""
        if self._minter is None:
            return invoices
        out: list[Invoice] = []
        for inv in invoices:
            url = self._minter.mint(inv)
            if url:
                link_id = self._minter.link_id(inv.invoice_id)
                if link_id:
                    self._link_to_invoice[link_id] = inv.invoice_id  # webhook correlation
                out.append(inv.model_copy(update={"payment_link": url}))
            else:
                out.append(inv)
        return out

    def check_payments(self) -> list[str]:
        """Poll Stripe for paid links and auto-reconcile: record the fee, notify, flip the
        board to RECOVERED. Returns ids newly recovered this poll; no-op ([]) when Stripe
        isn't armed. Keys each payment by payment_intent (the same ref a webhook uses) so
        a payment seen by both paths is recorded once, never double-counted."""
        if self._minter is None:
            return []
        recovered: list[str] = []
        for invoice_id, result in list(self._results.items()):
            if result.terminal_state not in _RECONCILABLE_STATES:
                continue
            link_id = self._minter.link_id(invoice_id)
            if not link_id:
                continue
            invoice = self._invoices[invoice_id]
            for ref, amount in self._minter.paid_sessions(link_id, invoice.currency.lower()):
                self._pi_to_invoice.setdefault(ref, invoice_id)  # learn for later refunds
                self._record_event(PaymentEvent(
                    invoice_id=invoice_id, amount=amount, occurred_on=date.today(),
                    currency=invoice.currency, source="stripe", reference=ref,
                ))
            prev = result.terminal_state
            outcome = self._apply_reconcile(invoice_id)
            if (
                outcome is not None
                and outcome.status is ReconcileStatus.PAID
                and prev is not TerminalState.RECOVERED
            ):
                recovered.append(invoice_id)
        return recovered

    def ingest_webhook(self, payload: bytes | str, sig_header: str | None) -> list[str]:
        """Verify a Stripe webhook, normalize to a ``PaymentEvent``, and re-reconcile the
        touched invoice over its full event log - so a payment/refund/chargeback updates
        the board server-side with no tab open. Returns changed invoice ids. Fail-safe: a
        bad signature or unmatched event logs and returns [] (never raises)."""
        secret = os.environ.get("STRIPE_WEBHOOK_SECRET")
        parsed = parse_event(verify_event(payload, sig_header, secret))
        if parsed is None:
            return []
        invoice_id = self._correlate(parsed)
        if invoice_id is None:
            self._log.record(
                invoice_id="-", agent="webhook", decision="unresolved",
                reasoning=f"Stripe {parsed.kind.value} event ({parsed.reference}) "
                "could not be matched to an invoice - skipped.",
            )
            return []
        if parsed.payment_intent:
            self._pi_to_invoice[parsed.payment_intent] = invoice_id
        self._record_event(PaymentEvent(
            invoice_id=invoice_id, amount=parsed.amount, occurred_on=date.today(),
            currency=parsed.currency, kind=parsed.kind, source="webhook",
            reference=parsed.reference,
        ))
        prev = self._results[invoice_id].terminal_state
        outcome = self._apply_reconcile(invoice_id)
        changed = outcome is not None and self._results[invoice_id].terminal_state is not prev
        return [invoice_id] if changed else []

    # -- reconcile plumbing (shared by poll + webhook) ------------------------

    def _record_event(self, event: PaymentEvent) -> None:
        """Append a money event, upserting by (kind, reference) so a re-poll or a
        cumulative refund replaces the prior value rather than stacking duplicates."""
        if db.supabase_enabled():
            tenant_id = self._tenant_of(event.invoice_id)
            if tenant_id:
                db.upsert_event(tenant_id, event)
        log = self._events.setdefault(event.invoice_id, [])
        if event.reference:
            for i, existing in enumerate(log):
                if existing.kind is event.kind and existing.reference == event.reference:
                    log[i] = event  # latest wins (cumulative refund / re-poll)
                    return
        log.append(event)

    def _correlate(self, parsed) -> str | None:
        """Route a parsed Stripe event back to an invoice: explicit metadata tag first,
        then the payment_link (payments), then the learned payment_intent map
        (refunds/disputes, which only carry a charge/PI)."""
        if parsed.metadata_invoice_id and parsed.metadata_invoice_id in self._invoices:
            return parsed.metadata_invoice_id
        if parsed.payment_link and parsed.payment_link in self._link_to_invoice:
            return self._link_to_invoice[parsed.payment_link]
        if parsed.payment_intent and parsed.payment_intent in self._pi_to_invoice:
            return self._pi_to_invoice[parsed.payment_intent]
        return None

    def _apply_reconcile(self, invoice_id: str, *, notify: bool = True) -> ReconcileOutcome | None:
        """Re-derive status over the full event log and reflect it on the board.
        Idempotent (unchanged outcome = no-op). A refund that un-pays a RECOVERED
        invoice drops it back to SENT to chase the residual. ``notify=False`` (the
        startup replay path) restores state without re-emailing the operator."""
        invoice = self._invoices.get(invoice_id)
        result = self._results.get(invoice_id)
        events = self._events.get(invoice_id)
        if invoice is None or result is None or not events:
            return None
        # Cheap, side-effect-free signature first: only run the real agent (which logs +
        # notifies) when the netted outcome actually changed, so repeated polls are no-ops.
        tally = tally_events(invoice, events)
        sig = f"{classify(invoice, tally).value}:{tally.net_paid}"
        if self._reconcile_sig.get(invoice_id) == sig:
            return None  # nothing new since last time - no log spam, no re-notify
        self._reconcile_sig[invoice_id] = sig

        outcome = self._reconciler.reconcile(invoice, events, notify=notify)  # logs + (maybe) notifies
        new_state = result.terminal_state
        if outcome.status is ReconcileStatus.PAID:
            new_state = TerminalState.RECOVERED
        elif outcome.escalate:
            new_state = TerminalState.ESCALATED
        elif result.terminal_state is TerminalState.RECOVERED:
            new_state = TerminalState.SENT  # reversal: was paid, now a balance remains
        self._results[invoice_id] = replace(
            result,
            terminal_state=new_state,
            detail=outcome.reasoning,
            steps=[*result.steps, PipelineStep("reconcile", outcome.status.value, outcome.reasoning)],
        )
        return outcome
