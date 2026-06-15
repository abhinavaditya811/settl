"""BoardState — the engine running in-process behind the API.

It runs the orchestrator over the dataset and holds the per-invoice results so the
dashboard can read the board, drill into a trace, and approve a held draft.

Sending is safe by default and opt-in for real:

  * **Default — everything is mocked.** No email leaves; senders log "would send …".
  * **Live mode — ``SETTL_LIVE_SEND=1`` *and* ``SETTL_TEST_RECIPIENT`` set.** Both
    the board batch *and* approvals deliver real email, but every message is
    force-redirected to ``SETTL_TEST_RECIPIENT`` — so a synthetic debtor address is
    never emailed; everything lands in your own inbox for review.

Note: in live mode the board batch sends on startup and on each "Re-run engine"
(``/refresh``); reading the board (GET) never sends.

State is in-memory and per-process — fine for a single-instance demo. Durable,
multi-instance state (a real datastore) is a later concern.
"""

from __future__ import annotations

import os
from pathlib import Path

from settl.audit import ExecutionLog
from settl.config import load_dotenv
from settl.data import load_synthetic_invoices
from settl.orchestrator import Orchestrator, TerminalState
from settl.orchestrator.result import PipelineResult
from settl.schema.invoice import Channel, Invoice
from settl.sending import GmailSmtpSender, MockSender


class BoardState:
    def __init__(self, log_path: str | Path | None = None) -> None:
        load_dotenv()
        self._log = ExecutionLog(jsonl_path=log_path)
        # One sender drives both the board batch and approvals: live (redirected to
        # the test inbox) when explicitly armed, mock otherwise.
        sender = self._make_sender()
        self._board = Orchestrator(log=self._log, sender=sender)
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

    @property
    def live_send_enabled(self) -> bool:
        return isinstance(self._board._sender, GmailSmtpSender)

    # -- queries --------------------------------------------------------------

    def refresh(self) -> None:
        self._log.clear()  # fresh run → don't double-count the activity feed
        invoices = load_synthetic_invoices()
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
        buckets = {"0–30 days": [0, 0.0], "31–60 days": [0, 0.0], "61+ days": [0, 0.0]}
        in_flight_states = {
            TerminalState.SENT, TerminalState.AWAITING_APPROVAL, TerminalState.HELD,
        }
        for inv, res in rows:
            if inv.currency != primary:
                continue
            amt = float(inv.amount_due)
            if inv.status.value == "paid":
                recovered += amt
            else:
                outstanding += amt
            if res.terminal_state in in_flight_states:
                in_flight += amt
            if res.terminal_state is TerminalState.AWAITING_APPROVAL:
                awaiting_count += 1
                awaiting_amount += amt
            if inv.status.value != "paid" and inv.days_overdue > 0:
                key = "0–30 days" if inv.days_overdue <= 30 else (
                    "31–60 days" if inv.days_overdue <= 60 else "61+ days"
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
