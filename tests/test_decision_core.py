"""End-to-end decision core over the whole synthetic set:
strategy → (stand-in draft) → compliance gate → mock sender, all logged.

There is no drafting agent yet (task 1), so CHASE invoices use a fixed benign
draft as a stand-in for what the drafting agent will produce. The invariant under
test: no consumer or disputed invoice is ever 'sent', and no paid invoice is chased.
"""

from settl.agents.strategy import Action, StrategyAgent
from settl.audit import ExecutionLog
from settl.compliance import ComplianceGate
from settl.data import load_synthetic_invoices
from settl.schema import partition_invoices

BENIGN_DRAFT = (
    "Hi {name} - a friendly reminder that invoice {ref} is past due. "
    "Here is your secure payment link to settle it. Thank you!"
)


def _run_pipeline():
    """Returns (results_by_id, log). results: invoice_id -> (action, sent)."""
    log = ExecutionLog()
    strategy = StrategyAgent(log=log)
    gate = ComplianceGate(log=log)
    from settl.sending import MockSender

    sender = MockSender(log=log)

    actionable, _quarantined = partition_invoices(load_synthetic_invoices())
    results: dict[str, tuple[Action, bool]] = {}

    for inv in actionable:
        decision = strategy.decide(inv)
        sent = False
        if decision.action is Action.CHASE:
            draft = BENIGN_DRAFT.format(name=inv.debtor_name, ref=inv.invoice_id)
            result = gate.evaluate(inv, draft)
            sent = sender.send(inv, draft, result, decision.channel).sent
        elif decision.action is Action.REVIEW:
            # Strategy already deferred to a human; record the formal block too.
            gate.evaluate(inv)
        results[inv.invoice_id] = (decision.action, sent)
    return results, log


def test_no_consumer_or_disputed_invoice_is_ever_sent():
    results, _ = _run_pipeline()
    invoices = {inv.invoice_id: inv for inv in load_synthetic_invoices()}
    for inv_id, (_action, sent) in results.items():
        inv = invoices[inv_id]
        if (not inv.is_b2b) or inv.status.value == "disputed":
            assert sent is False, f"{inv_id} must never be auto-sent"


def test_paid_invoices_are_never_chased():
    results, _ = _run_pipeline()
    assert results["INV-005"][0] is Action.SKIP
    assert results["INV-014"][0] is Action.SKIP  # consumer AND paid → skip wins


def test_a_legitimate_b2b_invoice_does_get_sent():
    results, _ = _run_pipeline()
    # INV-018: repeat B2B payer, clean → should pass the gate and "send".
    assert results["INV-018"] == (Action.CHASE, True)


def test_every_processed_invoice_produced_log_entries():
    results, log = _run_pipeline()
    # Every actionable invoice has at least the strategy decision logged.
    for inv_id in results:
        assert log.for_invoice(inv_id), f"no audit trail for {inv_id}"
    # The log is serializable evidence.
    assert log.to_json().startswith("[")
