"""The orchestrator spine over the whole synthetic set.

Proves the routing is correct end-to-end: every invoice reaches a terminal state,
the safety invariants hold (no consumer/disputed invoice ever sends or even queues
for approval), pilot-mode first-contact approval fires, the gate can still block a
bad draft on the chase path, the unpaid loop re-queues the right ones, and every
invoice leaves an audit trail.
"""

from datetime import date, timedelta
from decimal import Decimal

from settl.audit import ExecutionLog
from settl.data import load_synthetic_invoices
from settl.governance import Directive, OperatorRule, RuleStore, Scope
from settl.orchestrator import Orchestrator, TerminalState, next_touch
from settl.orchestrator.result import REQUEUE_STATES
from settl.schema.invoice import Channel, ContactDirection, Invoice, InvoiceStatus, PriorContact, Source
from settl.schema.validation import validate_invoice

SENDABLE = (TerminalState.SENT, TerminalState.AWAITING_APPROVAL)


def _run(draft_fn=None):
    log = ExecutionLog()
    kwargs = {"log": log}
    if draft_fn is not None:
        kwargs["draft_fn"] = draft_fn
    orch = Orchestrator(**kwargs)
    invoices = load_synthetic_invoices()
    results = {r.invoice_id: r for r in orch.run_batch(invoices)}
    return results, log, {inv.invoice_id: inv for inv in invoices}


def test_every_invoice_reaches_a_terminal_state():
    results, _, invoices = _run()
    assert set(results) == set(invoices)
    for res in results.values():
        assert isinstance(res.terminal_state, TerminalState)


def test_no_consumer_or_disputed_invoice_ever_sends_or_queues():
    results, _, invoices = _run()
    for inv_id, res in results.items():
        inv = invoices[inv_id]
        if (not inv.is_b2b) or inv.status.value == "disputed":
            assert res.terminal_state not in SENDABLE, (
                f"{inv_id} must never reach a send/approval state"
            )


def test_paid_invoice_is_skipped():
    results, _, _ = _run()
    assert results["INV-005"].terminal_state is TerminalState.SKIPPED
    assert results["INV-014"].terminal_state is TerminalState.SKIPPED  # consumer + paid


def _held_invoice() -> Invoice:
    # Touched today - the cooldown check (policy.py's TOO_SOON_DAYS) holds this
    # regardless of anything else, same shape as a just-approved-and-sent invoice.
    today = date.today()
    return Invoice(
        invoice_id="INV-HOLD", tenant_id="t_demo", source=Source.CSV, source_ref="x",
        amount_due=Decimal("500.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=20),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
        prior_contacts=[
            PriorContact(occurred_on=today, direction=ContactDirection.OUTBOUND, channel=Channel.EMAIL)
        ],
    )


def test_always_escalate_guardrail_overrides_a_natural_hold():
    # Regression: an ALWAYS_ESCALATE compliance guardrail used to be silently
    # defeated whenever strategy decided HOLD (the cooldown check returns before
    # ever reaching the gate, where guardrail_violations is normally checked) -
    # exactly the scenario right after an invoice is sent and an operator flags it.
    inv = _held_invoice()
    plain = Orchestrator(log=ExecutionLog())
    assert plain.run_one(inv).terminal_state is TerminalState.HELD

    store = RuleStore()
    store.add(OperatorRule(
        scope=Scope.COMPLIANCE, directive=Directive.ALWAYS_ESCALATE,
        criteria={"debtor_name": "Acme"}, tenant_id="t_demo",
    ))
    guarded = Orchestrator(log=ExecutionLog(), rules_store=store)
    assert guarded.run_one(inv).terminal_state is TerminalState.ESCALATED


def test_first_contact_is_held_for_approval_not_sent():
    results, _, _ = _run()
    # INV-001: first-time client, clean B2B chase → gate raises FIRST_CONTACT_APPROVAL,
    # so the orchestrator holds it for one-tap sign-off rather than auto-sending.
    res = results["INV-001"]
    assert res.terminal_state is TerminalState.AWAITING_APPROVAL
    assert res.message is not None  # a draft was produced; only approval is pending
    assert res.needs_human


def test_repeat_clean_b2b_invoice_sends():
    results, _, _ = _run()
    # INV-018: repeat payer (not a new debtor), clean → clears gate and sends.
    assert results["INV-018"].terminal_state is TerminalState.SENT


def test_gate_blocks_a_bad_draft_on_the_chase_path():
    # A drafter that strays into a legal threat must be caught by the gate and
    # escalated - even for an invoice that would otherwise send.
    threat = lambda inv, dec: "Pay now or we will sue you and report you to collections."
    results, _, _ = _run(draft_fn=threat)
    # INV-018 is a repeat payer (not first contact), so the only block is the threat.
    res = results["INV-018"]
    assert res.terminal_state is TerminalState.ESCALATED


def test_quarantined_invoice_is_flagged_to_human():
    results, _, invoices = _run()
    quarantined = [i for i, inv in invoices.items() if validate_invoice(inv)]
    assert quarantined, "expected at least one unreadable invoice in the dataset"
    for inv_id in quarantined:
        assert results[inv_id].terminal_state is TerminalState.QUARANTINED


def test_unpaid_loop_requeues_held_and_sent_only():
    results, _, _ = _run()
    for res in results.values():
        loop = next_touch(res)
        if res.terminal_state in REQUEUE_STATES:
            assert loop.requeue and loop.in_days and loop.in_days > 0
        else:
            assert not loop.requeue


def test_every_invoice_has_an_audit_trail():
    results, log, _ = _run()
    for inv_id in results:
        assert log.for_invoice(inv_id), f"no audit trail for {inv_id}"
    assert log.to_json().startswith("[")


# --- inbound (SCHEMA.md §7) -----------------------------------------------------


def _invoice(inv_id: str):
    return {i.invoice_id: i for i in load_synthetic_invoices()}[inv_id]


def test_handle_inbound_dispute_escalates_without_drafting():
    orch = Orchestrator(log=ExecutionLog())
    result = orch.handle_inbound(_invoice("INV-018"), "I dispute this, never ordered it")
    assert result.terminal_state is TerminalState.ESCALATED
    assert result.message is None  # alert-only lane never drafts


def test_handle_inbound_payment_plan_request_escalates_without_drafting():
    orch = Orchestrator(log=ExecutionLog())
    result = orch.handle_inbound(_invoice("INV-018"), "Can we set up a payment plan?")
    assert result.terminal_state is TerminalState.ESCALATED
    assert result.message is None


def test_handle_inbound_benign_reply_on_repeat_debtor_autosends():
    # INV-018 is a repeat payer (is_new_debtor is False) - first-contact approval
    # already cleared on an earlier touch, so a benign reply auto-sends, mirroring
    # the chase path's first-touch-then-autonomous rule.
    orch = Orchestrator(log=ExecutionLog())
    result = orch.handle_inbound(_invoice("INV-018"), "Thanks, will take care of it")
    assert result.terminal_state is TerminalState.SENT
    assert result.message is not None


def test_handle_inbound_benign_reply_on_new_debtor_awaits_approval():
    # INV-001 has no prior outbound touch (is_new_debtor True) - even though the
    # reply itself is benign, FIRST_CONTACT_APPROVAL still applies exactly as it
    # would for an AI-initiated first touch.
    orch = Orchestrator(log=ExecutionLog())
    result = orch.handle_inbound(_invoice("INV-001"), "Thanks, will take care of it")
    assert result.terminal_state is TerminalState.AWAITING_APPROVAL
    assert result.message is not None


def test_handle_inbound_logs_the_classification():
    log = ExecutionLog()
    orch = Orchestrator(log=log)
    inv = _invoice("INV-018")
    orch.handle_inbound(inv, "I dispute this charge")
    entries = log.for_invoice(inv.invoice_id)
    assert any(e.agent == "inbound_classifier" and e.decision == "dispute" for e in entries)
