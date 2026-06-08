"""Strategy agent / policy behavior across the edge cases."""

from settl.agents.strategy import Action, StrategyAgent, Tone
from settl.audit import ExecutionLog
from settl.data import load_synthetic_invoices
from settl.schema.invoice import Channel


def _by_id():
    return {inv.invoice_id: inv for inv in load_synthetic_invoices()}


def test_paid_invoice_is_skipped():
    agent = StrategyAgent()
    assert agent.decide(_by_id()["INV-005"]).action is Action.SKIP


def test_not_yet_due_is_skipped():
    assert StrategyAgent().decide(_by_id()["INV-010"]).action is Action.SKIP


def test_first_time_slightly_overdue_is_friendly_no_fee():
    d = StrategyAgent().decide(_by_id()["INV-001"])
    assert d.action is Action.CHASE
    assert d.tone is Tone.FRIENDLY
    assert d.include_late_fee is False  # late_fee_allowed is False
    assert d.escalation_hint == "first_contact"  # new debtor → approval at the gate


def test_repeat_late_payer_is_firm_with_fee():
    d = StrategyAgent().decide(_by_id()["INV-002"])
    assert d.action is Action.CHASE
    assert d.tone is Tone.FIRM
    assert d.include_late_fee is True


def test_heavily_overdue_is_final_notice_via_last_channel():
    d = StrategyAgent().decide(_by_id()["INV-008"])
    assert d.action is Action.CHASE
    assert d.tone is Tone.FINAL
    assert d.include_late_fee is True
    assert d.channel is Channel.SMS  # mirrors the most recent touch


def test_consumer_and_disputed_route_to_review():
    inv = _by_id()
    assert StrategyAgent().decide(inv["INV-003"]).action is Action.REVIEW  # consumer
    assert StrategyAgent().decide(inv["INV-004"]).action is Action.REVIEW  # disputed


def test_recent_burst_triggers_hold():
    d = StrategyAgent().decide(_by_id()["INV-009"])  # 3 touches in last week
    assert d.action is Action.HOLD


def test_decision_is_logged_with_reasoning():
    log = ExecutionLog()
    StrategyAgent(log=log).decide(_by_id()["INV-002"])
    entry = log.for_invoice("INV-002")[0]
    assert entry.agent == "strategy"
    assert entry.reasoning  # non-empty why
