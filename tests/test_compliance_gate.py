"""Compliance gate — the safety boundary. These are the headline proofs:
the consumer-debt case and the disputed-invoice case escalate to a human
instead of being sent."""

from settl.audit import ExecutionLog
from settl.compliance import ComplianceGate, GateDecision
from settl.data import load_synthetic_invoices
from settl.sending import MockSender

BENIGN = "Hi there — a friendly reminder that your invoice is past due. Payment link enclosed. Thanks!"


def _by_id():
    return {inv.invoice_id: inv for inv in load_synthetic_invoices()}


# --- the two required escalations ---------------------------------------------


def test_consumer_debt_escalates_and_is_not_sent():
    inv = _by_id()["INV-003"]  # is_b2b = False
    gate, sender = ComplianceGate(), MockSender()
    result = gate.evaluate(inv, BENIGN)
    assert result.decision is GateDecision.ESCALATE
    assert "B2B_ONLY" in result.codes
    # The sender refuses to send an escalated message.
    outcome = sender.send(inv, BENIGN, result)
    assert outcome.sent is False


def test_disputed_invoice_escalates_and_is_not_sent():
    inv = _by_id()["INV-004"]  # status = disputed
    gate, sender = ComplianceGate(), MockSender()
    result = gate.evaluate(inv, BENIGN)
    assert result.decision is GateDecision.ESCALATE
    assert "DISPUTED" in result.codes
    assert sender.send(inv, BENIGN, result).sent is False


# --- the rest of the enumerated rules -----------------------------------------


def test_payment_plan_request_escalates():
    result = ComplianceGate().evaluate(_by_id()["INV-006"], BENIGN)
    assert "PAYMENT_PLAN_REQUEST" in result.codes


def test_inbound_dispute_reply_escalates_even_if_status_open():
    result = ComplianceGate().evaluate(_by_id()["INV-024"], BENIGN)
    assert result.decision is GateDecision.ESCALATE
    assert "DISPUTE_RAISED" in result.codes


def test_contact_frequency_limit_escalates():
    result = ComplianceGate().evaluate(_by_id()["INV-009"], BENIGN)
    assert "FREQUENCY_LIMIT" in result.codes


def test_first_contact_requires_human_approval():
    result = ComplianceGate().evaluate(_by_id()["INV-001"], BENIGN)  # new debtor
    assert result.decision is GateDecision.ESCALATE
    assert "FIRST_CONTACT_APPROVAL" in result.codes


def test_legal_threat_message_is_blocked():
    inv = _by_id()["INV-018"]  # otherwise clean, repeat B2B payer
    msg = "Pay now or we will sue you and send this to collections."
    result = ComplianceGate().evaluate(inv, msg)
    assert result.decision is GateDecision.ESCALATE
    assert "LEGAL_THREAT" in result.codes


def test_unenforceable_consequence_is_blocked():
    inv = _by_id()["INV-018"]
    msg = "Settle up or this will hurt your credit score."
    assert "UNENFORCEABLE_CONSEQUENCE" in ComplianceGate().evaluate(inv, msg).codes


def test_legal_advice_is_blocked():
    inv = _by_id()["INV-018"]
    msg = "By law you must pay this invoice immediately."
    assert "LEGAL_ADVICE" in ComplianceGate().evaluate(inv, msg).codes


# --- the gate must also let a legitimate message through ----------------------


def test_clean_b2b_repeat_touch_passes_and_sends():
    inv = _by_id()["INV-018"]  # B2B, prior outbound, not disputed, within frequency
    gate, sender = ComplianceGate(), MockSender()
    result = gate.evaluate(inv, BENIGN)
    assert result.decision is GateDecision.PASS, result.reasoning
    outcome = sender.send(inv, BENIGN, result)
    assert outcome.sent is True
    assert "would send" in outcome.detail


def test_gate_logs_every_evaluation():
    log = ExecutionLog()
    ComplianceGate(log=log).evaluate(_by_id()["INV-003"], BENIGN)
    entry = log.for_invoice("INV-003")[0]
    assert entry.agent == "compliance_gate"
    assert entry.decision == "escalate"
