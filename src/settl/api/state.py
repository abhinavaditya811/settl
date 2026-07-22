"""BoardState - the engine running in-process behind the API.

Runs the orchestrator over the dataset and holds per-invoice results so the dashboard
can read the board, drill into a trace, approve a held draft, and flag a decision.

Sending is safe by default and opt-in for real. Every UNATTENDED path (batch,
inbound auto-reply) is on its own sender, separate from a deliberate human
approval, and each needs its own opt-in beyond SETTL_LIVE_SEND:
  * **Default** - everything is mocked; no email leaves ("would send …").
  * **Approvals** (``SETTL_LIVE_SEND=1`` + ``SETTL_TEST_RECIPIENT``) - a one-tap approval
    delivers real email. The only sender ``SETTL_LIVE_SEND`` alone controls.
  * **The board batch** (every startup/``/refresh``, over the FULL dataset) needs
    ``SETTL_LIVE_SEND_BATCH=1``, or a plain restart silently re-sends live email to
    every non-first-contact invoice, seed rows included (happened once already).
  * **Inbound auto-replies** (a repeat debtor's benign reply - "later touches may go
    autonomous") needs ``SETTL_LIVE_SEND_INBOUND_REPLY=1``, or arming the scheduled
    poller (api/inbound_poll_scheduler.py) together with live approvals silently
    re-arms a real-send loop every poll cycle (also happened once already). The
    poller stays useful with this off - it still reads/classifies/logs replies and
    reflects escalations on the board, it just won't fire an email on its own.

All three are ALSO wrapped with a second, orthogonal guard keyed on WHOSE data it is:
an invoice on a demo/synthetic tenant (``identity.demo_tenant_ids()``) always uses the
mock path regardless of the flags above, since the public ``/demo`` page needs no login
- else a visitor clicking "Approve & Send" there could fire a real email. The
OperatorNotifier (agents/reconcile/notify.py) has the SAME guard for its own email path.
Opt out of both with ``SETTL_LIVE_SEND_DEMO=1`` (e.g. for a real showcase).

State is in-memory and per-process; a durable store is a later concern.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from settl.adapters.csv_adapter import CsvImportResult, parse_csv
from settl.adapters.manual_entry import ManualInvoiceInput, build_manual_invoice
from settl.agents.reconcile import OperatorNotifier, ReconcileAgent
from settl.audit import AgentEngineSink, ExecutionLog, agent_engine_enabled, deduped_entries
from settl.compliance.rules import WAIVABLE_CODES
from settl.config import load_dotenv
from settl.data import load_synthetic_invoices
from settl.data import supabase as db
from settl.agents.payment_plan.models import PaymentPlan
from settl.api import engine_factories as factories
from settl.api.identity import demo_tenant_ids
from settl.api.inbound_mail_board import InboundMailBoard
from settl.api.metrics import compute_metrics
from settl.api.payment_plan_board import PaymentPlanBoard
from settl.api.reconcile_ops import ReconciliationDesk
from settl.governance import Directive, OperatorRule, RuleStore, Scope
from settl.orchestrator import Orchestrator, TerminalState
from settl.orchestrator.result import PipelineResult
from settl.schema.invoice import Channel, ContactDirection, Invoice, PriorContact
from settl.tenancy.config import PaymentPlanTemplate


class BoardState:
    def __init__(self, log_path: str | Path | None = None) -> None:
        load_dotenv()
        self._log = ExecutionLog(jsonl_path=log_path)
        # Mirror to Agent Engine observability when opted in; off by default (fail-safe).
        if agent_engine_enabled():
            self._log.add_sink(AgentEngineSink())
        # Per-trigger senders, each also demo-tenant-guarded - see the docstring.
        approval_sender = factories.make_guarded_sender(self._log)
        batch_sender = factories.make_guarded_sender(self._log, extra_gate="SETTL_LIVE_SEND_BATCH")
        inbound_reply_sender = factories.make_guarded_sender(self._log, extra_gate="SETTL_LIVE_SEND_INBOUND_REPLY")
        drafter = factories.make_drafter(self._log)
        self._minter = factories.make_minter()
        demo = demo_tenant_ids()
        notifier = OperatorNotifier(log=self._log, demo_tenant_ids=demo)
        self._reconciler = ReconcileAgent(log=self._log, notifier=notifier)
        # Operator guardrails, shared by reference so a flag is honored on re-orchestration.
        self._rules = RuleStore()
        self._invoices: dict[str, Invoice] = {}
        if db.supabase_enabled():
            # Durable mirror of every decision - see PostgresLogSink's docstring.
            self._log.add_sink(db.PostgresLogSink(tenant_of=self._tenant_of))
            for rule in db.load_rules():
                self._rules.add(rule)
        self._board = Orchestrator(log=self._log, sender=batch_sender, drafter=drafter, rules_store=self._rules)
        self._approver = Orchestrator(log=self._log, sender=approval_sender, rules_store=self._rules)
        self._inbound_replier = Orchestrator(
            log=self._log, sender=inbound_reply_sender, rules_store=self._rules,
            inbound_agent=factories.make_inbound_agent(self._log),
        )
        self._payment_plans = PaymentPlanBoard(log=self._log)
        self._payment_plans.hydrate()
        self._inbound_mail = InboundMailBoard(
            orchestrator=self._inbound_replier, log=self._log, demo_tenant_ids=demo,
            live_reply_enabled=factories.is_live(inbound_reply_sender), plan_board=self._payment_plans,
        )
        self._results: dict[str, PipelineResult] = {}
        # Payment-event correlation + reconcile idempotency (see reconcile_ops.py).
        # Holds `_invoices`/`_results` by reference - refresh() mutates in place.
        self._reconcile = ReconciliationDesk(
            minter=self._minter,
            reconciler=self._reconciler,
            log=self._log,
            invoices=self._invoices,
            results=self._results,
            tenant_of=self._tenant_of,
        )
        self.refresh()

    # -- setup helpers --------------------------------------------------------

    @property
    def live_send_enabled(self) -> bool:
        return factories.is_live(self._approver._sender)

    @property
    def inbound_reply_live_enabled(self) -> bool:
        """Whether the inbound auto-reply sender is live - separate from
        live_send_enabled, the two are deliberately independent (see docstring)."""
        return factories.is_live(self._inbound_replier._sender)

    @property
    def gemini_enabled(self) -> bool:
        return factories.gemini_enabled()

    @property
    def stripe_enabled(self) -> bool:
        return self._minter is not None

    @property
    def supabase_enabled(self) -> bool:
        return db.supabase_enabled()

    def _tenant_of(self, invoice_id: str) -> str | None:
        """The invoice's tenant, or None if unknown - execution-log entries and
        payment events are attributed to a tenant this way (they carry no tenant
        of their own; see PostgresLogSink's docstring)."""
        inv = self._invoices.get(invoice_id)
        return inv.tenant_id if inv else None

    # -- queries --------------------------------------------------------------

    def refresh(self) -> None:
        self._log.clear()  # fresh run → don't double-count the activity feed
        self._reconcile.reset()
        loader = db.load_invoices if db.supabase_enabled() else load_synthetic_invoices
        invoices = self._reconcile.enrich_payment_links(loader())
        # Mutate in place (never reassign) - ReconciliationDesk holds these dicts by
        # reference and the reference must survive every refresh().
        self._invoices.clear()
        self._invoices.update({inv.invoice_id: inv for inv in invoices})
        fresh_results = {r.invoice_id: r for r in self._board.run_batch(invoices)}
        for invoice_id, new_result in fresh_results.items():
            old_result = self._results.get(invoice_id)
            if old_result is not None and old_result.is_unresolved_inbound_escalation:
                fresh_results[invoice_id] = old_result  # don't clobber a pending debtor escalation
        self._results.clear()
        self._results.update(fresh_results)
        for invoice_id, result in self._results.items():
            self._invoices[invoice_id] = self._record_outbound_send(
                self._invoices[invoice_id], result
            )
        if db.supabase_enabled():
            self._reconcile.load_events(db.load_events())

    def _record_outbound_send(self, invoice: Invoice, result: PipelineResult) -> Invoice:
        """After ANY successful send, append an outbound PriorContact (durably +
        in-memory) - else is_new_debtor never flips false (observed bug)."""
        if result.terminal_state is not TerminalState.SENT or not result.message:
            return invoice
        contact = PriorContact(
            occurred_on=date.today(), direction=ContactDirection.OUTBOUND,
            channel=Channel(result.channel) if result.channel else Channel.EMAIL,
            summary=result.message[:500],
        )
        if db.supabase_enabled():
            db.write_contact(invoice.tenant_id, invoice.invoice_id, contact)
        return invoice.model_copy(update={"prior_contacts": [*invoice.prior_contacts, contact]})

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
        # Durable full-lifetime timeline (deduped) when Postgres is on; else in-memory (this run).
        if db.supabase_enabled():
            tenant_id = self._tenant_of(invoice_id)
            if tenant_id:
                return deduped_entries(db.load_execution_log(tenant_id, invoice_id))
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
        self._invoices[invoice_id] = self._record_outbound_send(invoice, new_result)
        self._results[invoice_id] = new_result  # reflect the outcome on the board
        return new_result

    def payment_plan(self, invoice_id: str) -> PaymentPlan | None:
        return self._payment_plans.get(invoice_id)

    def offer_payment_plan(self, invoice_id: str) -> PaymentPlan | None:
        found = self.get(invoice_id)
        return self._payment_plans.offer(found[0]) if found else None

    def reoffer_payment_plan(self, invoice_id: str, template: PaymentPlanTemplate) -> PaymentPlan | None:
        """Vendor-constructed different terms after the debtor asked for them.
        None if there's no plan to amend or the 3-offer cap is already reached."""
        found = self.get(invoice_id)
        return self._payment_plans.reoffer(found[0], template) if found else None

    def decide_payment_plan(self, invoice_id: str, approved: bool) -> dict | None:
        """Vendor approve/reject on an offered PaymentPlan (SCHEMA.md §8) - same
        one-tap shape as approve(), re-running the compliance gate on approval via
        PaymentPlanBoard.decide -> orchestrator.decide_payment_plan."""
        found = self.get(invoice_id)
        if not found:
            return None
        invoice, _ = found
        decided = self._payment_plans.decide(self._approver, invoice, approved)
        if decided is None:
            return None
        plan, result = decided
        self._results[invoice_id] = result  # reflect the outcome on the board
        return {
            "invoice_id": invoice_id,
            "plan_status": plan.status.value,
            "offer_count": plan.offer_count,
            "terminal_state": result.terminal_state.value,
            "detail": result.detail,
        }

    def poll_inbound_mail(self, tenant_id: str) -> list[str]:
        """Poll one tenant's Gmail for new replies (SCHEMA.md §7). No-op ([])
        if Google OAuth isn't configured - never pays the MCP-subprocess cost."""
        from settl.api.oauth_google import google_oauth_enabled

        if not google_oauth_enabled():
            return []
        changed = self._inbound_mail.poll(
            tenant_id, self._invoices, self._payment_plans.all(), self._results
        )
        for invoice_id, result in changed:
            self._results[invoice_id] = result
        return [invoice_id for invoice_id, _ in changed]

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
        """Poll Stripe for paid links and auto-reconcile (see ReconciliationDesk).
        Returns ids newly recovered this poll; no-op ([]) when Stripe isn't armed."""
        return self._reconcile.check_payments()

    def ingest_webhook(self, payload: bytes | str, sig_header: str | None) -> list[str]:
        """Verify + apply a Stripe webhook (see ReconciliationDesk). Returns changed
        invoice ids; fail-safe ([]) on a bad signature or unmatched event."""
        return self._reconcile.ingest_webhook(payload, sig_header)
