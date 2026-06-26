"""BoardState - the engine running in-process behind the API.

It runs the orchestrator over the dataset and holds the per-invoice results so the
dashboard can read the board, drill into a trace, and approve a held draft.

Sending is safe by default and opt-in for real:

  * **Default - everything is mocked.** No email leaves; senders log "would send …".
  * **Live mode - ``SETTL_LIVE_SEND=1`` *and* ``SETTL_TEST_RECIPIENT`` set.** Both
    the board batch *and* approvals deliver real email, but every message is
    force-redirected to ``SETTL_TEST_RECIPIENT`` - so a synthetic debtor address is
    never emailed; everything lands in your own inbox for review.

Note: in live mode the board batch sends on startup and on each "Re-run engine"
(``/refresh``); reading the board (GET) never sends.

State is in-memory and per-process - fine for a single-instance demo. Durable,
multi-instance state (a real datastore) is a later concern.
"""

from __future__ import annotations

import os
from dataclasses import replace
from datetime import date
from pathlib import Path

from settl.agents.reconcile import (
    OperatorNotifier,
    PaymentEvent,
    ReconcileAgent,
    ReconcileStatus,
)
from settl.audit import ExecutionLog
from settl.config import load_dotenv
from settl.data import load_synthetic_invoices
from settl.orchestrator import Orchestrator, TerminalState
from settl.orchestrator.result import PipelineResult, PipelineStep
from settl.schema.invoice import Channel, Invoice
from settl.sending import GmailSmtpSender, MockSender

# In-flight states a payment can still arrive for (so reconcile polls only these).
_RECONCILABLE_STATES = (
    TerminalState.SENT,
    TerminalState.AWAITING_APPROVAL,
    TerminalState.HELD,
    TerminalState.ESCALATED,
)


class BoardState:
    def __init__(self, log_path: str | Path | None = None) -> None:
        load_dotenv()
        self._log = ExecutionLog(jsonl_path=log_path)
        # One sender drives both the board batch and approvals: live (redirected to
        # the test inbox) when explicitly armed, mock otherwise.
        sender = self._make_sender()
        drafter = self._make_drafter()
        self._minter = self._make_minter()
        self._reconciler = ReconcileAgent(log=self._log, notifier=OperatorNotifier(log=self._log))
        self._board = Orchestrator(log=self._log, sender=sender, drafter=drafter)
        self._approver = Orchestrator(log=self._log, sender=sender)
        self._invoices: dict[str, Invoice] = {}
        self._results: dict[str, PipelineResult] = {}
        self.refresh()

    # -- setup helpers --------------------------------------------------------

    def _make_sender(self):
        """Real Gmail sender (every email redirected to SETTL_TEST_RECIPIENT) when
        live mode is armed; otherwise the mock sender. Used for the whole engine."""
        recipient = os.environ.get("SETTL_TEST_RECIPIENT")
        live = os.environ.get("SETTL_LIVE_SEND") == "1"
        if live and recipient:
            sender = GmailSmtpSender(log=self._log, force_recipient=recipient)
            if sender.configured:
                return sender
        return MockSender(log=self._log)

    def _make_drafter(self):
        """Real Gemini drafting (the visible AI) when a key is configured; the offline
        template otherwise. Drafting only affects the board batch - approvals re-gate a
        provided message and never re-draft."""
        from settl.agents.drafting import DraftingAgent
        from settl.agents.drafting.model import GeminiDraftModel

        if self.gemini_enabled:
            return DraftingAgent(log=self._log, model=GeminiDraftModel())
        return DraftingAgent(log=self._log)

    @property
    def live_send_enabled(self) -> bool:
        return isinstance(self._board._sender, GmailSmtpSender)

    @property
    def gemini_enabled(self) -> bool:
        """Real Gemini drafting is opt-in (SETTL_USE_GEMINI=1) *and* needs a key, so the
        default board run - and the test suite - stays offline and deterministic."""
        armed = os.environ.get("SETTL_USE_GEMINI") == "1"
        has_key = bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        return armed and has_key

    def _make_minter(self):
        """A Stripe link minter when armed (SETTL_USE_STRIPE=1 + a key), else None. Off
        by default so the board never creates Stripe objects just because a key exists."""
        from settl.payments import StripeLinkMinter, stripe_enabled

        return StripeLinkMinter() if stripe_enabled() else None

    @property
    def stripe_enabled(self) -> bool:
        return self._minter is not None

    def _enrich_payment_links(self, invoices: list[Invoice]) -> list[Invoice]:
        """For the demo, mint a real (test-mode) Stripe link per invoice so the board,
        drawer, and email all carry a payable link. Minting is cached per invoice and
        fail-safe (an invoice keeps its existing link if minting returns None)."""
        if self._minter is None:
            return invoices
        out: list[Invoice] = []
        for inv in invoices:
            url = self._minter.mint(inv)
            out.append(inv.model_copy(update={"payment_link": url}) if url else inv)
        return out

    # -- queries --------------------------------------------------------------

    def refresh(self) -> None:
        self._log.clear()  # fresh run → don't double-count the activity feed
        invoices = self._enrich_payment_links(load_synthetic_invoices())
        self._invoices = {inv.invoice_id: inv for inv in invoices}
        self._results = {r.invoice_id: r for r in self._board.run_batch(invoices)}

    def results(self) -> list[tuple[Invoice, PipelineResult]]:
        return [(self._invoices[i], r) for i, r in self._results.items()]

    def get(self, invoice_id: str) -> tuple[Invoice, PipelineResult] | None:
        if invoice_id not in self._results:
            return None
        return self._invoices[invoice_id], self._results[invoice_id]

    def trace(self, invoice_id: str):
        return self._log.for_invoice(invoice_id)

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for r in self._results.values():
            out[r.terminal_state.value] = out.get(r.terminal_state.value, 0) + 1
        return out

    def activity(self, limit: int = 50) -> list:
        """Most-recent-first slice of the execution log across all invoices."""
        return list(reversed(self._log.entries))[:limit]

    def metrics(self) -> dict:
        """Money + aging aggregates for the dashboard's overview. Computed on the
        primary currency (the one most invoices use) so totals are never summed
        across currencies; any others are listed for context."""
        rows = [(inv, res) for inv, res in self.results()]
        ccy_counts: dict[str, int] = {}
        for inv, _ in rows:
            ccy_counts[inv.currency] = ccy_counts.get(inv.currency, 0) + 1
        primary = max(ccy_counts, key=ccy_counts.get) if ccy_counts else "USD"
        others = sorted(c for c in ccy_counts if c != primary)

        outstanding = in_flight = recovered = awaiting_amount = 0.0
        awaiting_count = 0
        buckets = {"0-30 days": [0, 0.0], "31-60 days": [0, 0.0], "61+ days": [0, 0.0]}
        in_flight_states = {
            TerminalState.SENT, TerminalState.AWAITING_APPROVAL, TerminalState.HELD,
        }
        for inv, res in rows:
            if inv.currency != primary:
                continue
            amt = float(inv.amount_due)
            # Recovered = paid at ingestion OR reconciled to RECOVERED by the engine.
            is_recovered = (
                inv.status.value == "paid"
                or res.terminal_state is TerminalState.RECOVERED
            )
            if is_recovered:
                recovered += amt
            else:
                outstanding += amt
            if not is_recovered and res.terminal_state in in_flight_states:
                in_flight += amt
            if res.terminal_state is TerminalState.AWAITING_APPROVAL:
                awaiting_count += 1
                awaiting_amount += amt
            if not is_recovered and inv.days_overdue > 0:
                key = "0-30 days" if inv.days_overdue <= 30 else (
                    "31-60 days" if inv.days_overdue <= 60 else "61+ days"
                )
                buckets[key][0] += 1
                buckets[key][1] += amt

        return {
            "currency": primary,
            "other_currencies": others,
            "outstanding": round(outstanding, 2),
            "in_flight": round(in_flight, 2),
            "recovered": round(recovered, 2),
            "awaiting_count": awaiting_count,
            "awaiting_amount": round(awaiting_amount, 2),
            "aging": [
                {"bucket": k, "count": v[0], "amount": round(v[1], 2)}
                for k, v in buckets.items()
            ],
        }

    # -- actions --------------------------------------------------------------

    def approve(self, invoice_id: str, message: str | None = None) -> PipelineResult | None:
        """One-tap approval of a held first-contact draft, optionally with an edited
        message (which approve_and_send re-runs through the gate). Returns the new
        result, or None if the invoice isn't in an approvable state."""
        found = self.get(invoice_id)
        if not found:
            return None
        invoice, result = found
        if result.terminal_state is not TerminalState.AWAITING_APPROVAL or not result.message:
            return None
        channel = Channel(result.channel) if result.channel else None
        outgoing = message.strip() if message and message.strip() else result.message
        new_result = self._approver.approve_and_send(invoice, outgoing, channel)
        self._results[invoice_id] = new_result  # reflect the outcome on the board
        return new_result

    def check_payments(self) -> list[str]:
        """Poll Stripe for paid payment links and auto-reconcile any that were paid:
        record the fee, notify the operator, and flip the board to RECOVERED. Returns
        the invoice ids newly recovered this poll. No-op (returns []) when Stripe isn't
        armed, so the default board and the test suite stay offline/deterministic."""
        if self._minter is None:
            return []
        recovered: list[str] = []
        for invoice_id, result in list(self._results.items()):
            if result.terminal_state not in _RECONCILABLE_STATES:
                continue
            link_id = self._minter.link_id(invoice_id)
            if not link_id:
                continue
            paid = self._minter.paid_total(link_id)
            if paid is None:
                continue
            invoice = self._invoices[invoice_id]
            event = PaymentEvent(
                invoice_id=invoice_id, amount=paid, occurred_on=date.today(),
                source="stripe", reference=link_id,
            )
            outcome = self._reconciler.reconcile(invoice, [event])
            if outcome.status is ReconcileStatus.PAID:
                self._results[invoice_id] = replace(
                    result,
                    terminal_state=TerminalState.RECOVERED,
                    detail=outcome.reasoning,
                    steps=[*result.steps, PipelineStep("reconcile", "paid", outcome.reasoning)],
                )
                recovered.append(invoice_id)
        return recovered
