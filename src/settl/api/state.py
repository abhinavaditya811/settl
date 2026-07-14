"""BoardState - the engine running in-process behind the API.

Runs the orchestrator over the dataset and holds the per-invoice results so the dashboard
can read the board, drill into a trace, approve a held draft, and flag a decision.

Sending is safe by default and opt-in for real:
  * **Default** - everything is mocked; no email leaves ("would send …").
  * **Live mode** (``SETTL_LIVE_SEND=1`` + ``SETTL_TEST_RECIPIENT``) - the board batch and
    approvals deliver real email, but every message is force-redirected to the operator's
    own inbox, so a synthetic debtor address is never emailed. The batch sends on startup
    and on each ``/refresh``; reading the board (GET) never sends.

State is in-memory and per-process (fine for a single-instance demo); a durable store is
a later concern.
"""

from __future__ import annotations

import os
from dataclasses import replace
from datetime import date
from pathlib import Path

from settl.adapters.csv_adapter import CsvImportResult, parse_csv
from settl.adapters.manual_entry import ManualInvoiceInput, build_manual_invoice
from settl.agents.reconcile import (
    OperatorNotifier,
    PaymentEvent,
    ReconcileAgent,
    ReconcileOutcome,
    ReconcileStatus,
    classify,
    tally_events,
)
from settl.audit import AgentEngineSink, ExecutionLog, agent_engine_enabled
from settl.compliance.rules import WAIVABLE_CODES
from settl.config import load_dotenv
from settl.data import load_synthetic_invoices
from settl.data import supabase as db
from settl.api.metrics import compute_metrics
from settl.governance import Directive, OperatorRule, RuleStore, Scope
from settl.orchestrator import Orchestrator, TerminalState
from settl.orchestrator.result import PipelineResult, PipelineStep
from settl.payments.webhook import parse_event, verify_event
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
        # Mirror the audit trail to Agent Engine observability when opted in (Week 5);
        # off by default so a plain run / the test suite never calls out. Fail-safe.
        if agent_engine_enabled():
            self._log.add_sink(AgentEngineSink())
        # One sender drives both the board batch and approvals: live (redirected to
        # the test inbox) when explicitly armed, mock otherwise.
        sender = self._make_sender()
        drafter = self._make_drafter()
        self._minter = self._make_minter()
        self._reconciler = ReconcileAgent(log=self._log, notifier=OperatorNotifier(log=self._log))
        # Operator guardrails (human-in-the-loop), shared by reference into both
        # orchestrators so a flag is honored on re-orchestration and every future run.
        self._rules = RuleStore()
        self._invoices: dict[str, Invoice] = {}
        if db.supabase_enabled():
            # Durable mirror of every decision (Postgres survives a restart; the
            # in-memory list ExecutionLog.clear()s on refresh stays the dashboard's
            # live view - see PostgresLogSink's docstring).
            self._log.add_sink(db.PostgresLogSink(tenant_of=self._tenant_of))
            for rule in db.load_rules():
                self._rules.add(rule)
        self._board = Orchestrator(
            log=self._log, sender=sender, drafter=drafter, rules_store=self._rules
        )
        self._approver = Orchestrator(log=self._log, sender=sender, rules_store=self._rules)
        self._results: dict[str, PipelineResult] = {}
        # Append-only money-event log per invoice; poll AND webhook write here and
        # reconcile always re-derives over the full log (so refunds/disputes reverse).
        self._events: dict[str, list[PaymentEvent]] = {}
        self._reconcile_sig: dict[str, str] = {}  # last applied outcome, for idempotency
        # Correlation maps so a Stripe event routes back to an invoice.
        self._link_to_invoice: dict[str, str] = {}  # payment_link id → invoice
        self._pi_to_invoice: dict[str, str] = {}  # payment_intent → invoice (learned)
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

    @property
    def supabase_enabled(self) -> bool:
        return db.supabase_enabled()

    def _enrich_payment_links(self, invoices: list[Invoice]) -> list[Invoice]:
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

    def _tenant_of(self, invoice_id: str) -> str | None:
        """The invoice's tenant, or None if unknown - execution-log entries and
        payment events are attributed to a tenant this way (they carry no tenant
        of their own; see PostgresLogSink's docstring)."""
        inv = self._invoices.get(invoice_id)
        return inv.tenant_id if inv else None

    # -- queries --------------------------------------------------------------

    def refresh(self) -> None:
        self._log.clear()  # fresh run → don't double-count the activity feed
        self._events.clear()
        self._reconcile_sig.clear()
        self._link_to_invoice.clear()
        self._pi_to_invoice.clear()
        loader = db.load_invoices if db.supabase_enabled() else load_synthetic_invoices
        invoices = self._enrich_payment_links(loader())
        self._invoices = {inv.invoice_id: inv for inv in invoices}
        self._results = {r.invoice_id: r for r in self._board.run_batch(invoices)}
        if db.supabase_enabled():
            # Replay persisted payment events so reconcile state (RECOVERED/PARTIAL/
            # escalated) survives a restart instead of resetting until the next poll.
            self._events = db.load_events()
            for invoice_id in list(self._events):
                self._apply_reconcile(invoice_id)

    def results(
        self, tenant_ids: frozenset[str] | None = None
    ) -> list[tuple[Invoice, PipelineResult]]:
        return [
            (self._invoices[i], r)
            for i, r in self._results.items()
            if tenant_ids is None or self._invoices[i].tenant_id in tenant_ids
        ]

    def get(self, invoice_id: str) -> tuple[Invoice, PipelineResult] | None:
        if invoice_id not in self._results:
            return None
        return self._invoices[invoice_id], self._results[invoice_id]

    def trace(self, invoice_id: str):
        return self._log.for_invoice(invoice_id)

    def counts(self, tenant_ids: frozenset[str] | None = None) -> dict[str, int]:
        out: dict[str, int] = {}
        for i, r in self._results.items():
            if tenant_ids is not None and self._invoices[i].tenant_id not in tenant_ids:
                continue
            out[r.terminal_state.value] = out.get(r.terminal_state.value, 0) + 1
        return out

    def activity(self, limit: int = 50, tenant_ids: frozenset[str] | None = None) -> list:
        """Most-recent-first slice of the execution log, optionally scoped to a tenant
        set. Filtered before the limit is applied, so a scoped caller still gets up to
        `limit` of ITS OWN entries rather than a limit-then-filter shortfall."""
        entries = reversed(self._log.entries)
        if tenant_ids is not None:
            entries = (e for e in entries if self._tenant_of(e.invoice_id) in tenant_ids)
        out = []
        for e in entries:
            if len(out) >= limit:
                break
            out.append(e)
        return out

    def metrics(self, tenant_ids: frozenset[str] | None = None) -> dict:
        """Money + aging aggregates for the dashboard overview (see api/metrics.py)."""
        return compute_metrics(self.results(tenant_ids))

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

    def flag_decision(
        self,
        invoice_id: str,
        *,
        scope: str,
        directive: str,
        waive_code: str | None = None,
        reason: str = "",
        criteria: dict | None = None,
    ) -> dict | None:
        """Operator flags a decision → store a durable guardrail and re-orchestrate.

        Matches similar future cases (default: same debtor). A WAIVE for a non-waivable
        (legal/consumer/dispute) code is REFUSED - recorded but never applied, so the
        invoice stays escalated. Returns a projection dict (None if invoice unknown)."""
        found = self.get(invoice_id)
        if not found:
            return None
        invoice, result = found

        try:
            scope_e, directive_e = Scope(scope), Directive(directive)
        except ValueError:
            return self._flag_result(result, "", False, f"unknown scope/directive: {scope}/{directive}")

        # Safety gate: a waiver is only honored for a soft, waivable code.
        if directive_e is Directive.WAIVE and (waive_code not in WAIVABLE_CODES):
            note = f"'{waive_code}' is not waivable - legal/consumer/dispute rules can never be overridden; left escalated."
            self._log.record(
                invoice_id=invoice_id, agent="operator_flag", decision="waiver_refused",
                reasoning=f"{note} ({reason})" if reason else note,
            )
            return self._flag_result(result, "", False, note)

        rule = self._rules.add(OperatorRule(
            scope=scope_e,
            directive=directive_e,
            criteria=criteria or {"debtor_name": invoice.debtor_name},
            tenant_id=invoice.tenant_id,
            waive_code=waive_code,
            reason=reason,
            created_at=date.today().isoformat(),
        ))
        if db.supabase_enabled():
            db.insert_rule(invoice.tenant_id, rule)
        self._log.record(
            invoice_id=invoice_id, agent="operator_flag", decision="guardrail_stored",
            reasoning=f"{rule.rule_id}: {directive_e.value} ({scope_e.value}) - {reason or 'no reason given'}",
            rule_id=rule.rule_id, criteria=rule.criteria,
        )
        # Re-orchestrate this invoice now (the guardrail also steers future matches).
        new_result = self._board.run_one(invoice)
        self._results[invoice_id] = new_result
        return self._flag_result(new_result, rule.rule_id, True, f"guardrail {rule.rule_id} applied")

    @staticmethod
    def _flag_result(result: PipelineResult, rule_id: str, applied: bool, note: str) -> dict:
        return {
            "invoice_id": result.invoice_id,
            "terminal_state": result.terminal_state.value,
            "detail": result.detail,
            "rule_id": rule_id,
            "applied": applied,
            "note": note,
        }

    def guardrails(self, tenant_ids: frozenset[str] | None = None) -> list[dict]:
        """Project the stored operator guardrails for the dashboard."""
        return [
            {
                "rule_id": r.rule_id,
                "scope": r.scope.value,
                "directive": r.directive.value,
                "criteria": r.criteria,
                "waive_code": r.waive_code,
                "reason": r.reason,
                "created_at": r.created_at,
            }
            for r in self._rules.all()
            if tenant_ids is None or r.tenant_id in tenant_ids
        ]

    def import_csv(self, tenant_id: str, csv_text: str) -> CsvImportResult:
        """Parse, persist, and reflect a CSV upload on the board. Raises
        CsvFormatError (400 at the route) if the file itself is unusable; a per-row
        reject is returned in the result instead, never raised."""
        result = parse_csv(csv_text, tenant_id)
        if result.invoices:
            db.insert_invoices(result.invoices)
            self.refresh()
        return result

    def add_manual_invoice(self, tenant_id: str, payload: ManualInvoiceInput) -> Invoice:
        """Build, persist, and reflect one manually-entered invoice on the board."""
        invoice = build_manual_invoice(tenant_id, payload)
        db.insert_invoices([invoice])
        self.refresh()
        return invoice

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

    def _apply_reconcile(self, invoice_id: str) -> ReconcileOutcome | None:
        """Re-derive status over the full event log and reflect it on the board.
        Idempotent (unchanged outcome = no-op). A refund that un-pays a RECOVERED
        invoice drops it back to SENT to chase the residual."""
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

        outcome = self._reconciler.reconcile(invoice, events)  # logs + notifies once
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
