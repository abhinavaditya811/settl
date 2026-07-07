"""Operator guardrails: store + matching, strategy tighten, gate tighten/waive.

The safety-critical assertions live here: a guardrail can only make the engine STRICTER,
a WAIVE clears a soft rule only, and a legal/consumer/dispute rule can NEVER be waived -
so a "dicey" case the base engine might send stays escalated once flagged. These are the
forced-failure scenarios: we prove the human-in-the-loop can tighten, and prove they
*cannot* loosen a hard rule no matter how they flag it.
"""

from datetime import date, timedelta
from decimal import Decimal

from settl.agents.strategy.policy import Action, StrategyDecision, Tone
from settl.compliance import ComplianceGate, GateDecision
from settl.compliance.rules import OPERATOR_GUARDRAIL
from settl.governance import (
    Directive,
    OperatorRule,
    RuleStore,
    Scope,
    guardrail_violations,
    matches,
    tighten_strategy,
    waived_codes,
)
from settl.schema.invoice import (
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)


def _inv(*, iid="INV-G", is_b2b=True, status=InvoiceStatus.OPEN, debtor="Acme", contacts=None) -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=iid, tenant_id="t_demo", source=Source.CSV, source_ref="x",
        amount_due=Decimal("1000.00"), currency="USD", issue_date=today - timedelta(days=40),
        due_date=today - timedelta(days=30), status=status, debtor_name=debtor,
        debtor_email="a@b.co", is_b2b=is_b2b, late_fee_allowed=True,
        prior_contacts=contacts or [], as_of_date=today,
    )


def _rule(**over) -> OperatorRule:
    base = dict(scope=Scope.COMPLIANCE, directive=Directive.ALWAYS_ESCALATE, criteria={"debtor_name": "Acme"})
    base.update(over)
    return OperatorRule(**base)


def _store(*rules) -> RuleStore:
    s = RuleStore()
    for r in rules:
        s.add(r)
    return s


def _outbound(days_ago: int) -> PriorContact:
    return PriorContact(
        occurred_on=date.today() - timedelta(days=days_ago),
        direction=ContactDirection.OUTBOUND, channel=Channel.EMAIL, summary="reminder",
    )


# --- matching -----------------------------------------------------------------


def test_matches_on_attributes():
    inv = _inv(is_b2b=False, status=InvoiceStatus.DISPUTED)
    assert matches(_rule(criteria={"is_b2b": False}), inv)
    assert matches(_rule(criteria={"status": "disputed", "debtor_name": "Acme"}), inv)
    assert not matches(_rule(criteria={"is_b2b": True}), inv)


def test_days_overdue_gte_and_empty_criteria():
    inv = _inv()  # 30 days overdue
    assert matches(_rule(criteria={"days_overdue_gte": 10}), inv)
    assert not matches(_rule(criteria={"days_overdue_gte": 999}), inv)
    assert not matches(_rule(criteria={}), inv)  # empty never matches - must be scoped


def test_store_assigns_ids_and_matches():
    store = _store(_rule(criteria={"debtor_name": "Acme"}))
    assert store.all()[0].rule_id == "gr-1"
    assert len(store.matching(_inv())) == 1
    assert store.matching(_inv(debtor="Other")) == []


# --- strategy tighten (downgrade only) ----------------------------------------


def _chase() -> StrategyDecision:
    return StrategyDecision(action=Action.CHASE, reasoning="chase", tone=Tone.FINAL)


def test_force_skip_downgrades_chase():
    store = _store(_rule(scope=Scope.STRATEGY, directive=Directive.FORCE_SKIP))
    assert tighten_strategy(_inv(), _chase(), store).action is Action.SKIP


def test_force_hold_downgrades_chase():
    store = _store(_rule(scope=Scope.STRATEGY, directive=Directive.FORCE_HOLD))
    assert tighten_strategy(_inv(), _chase(), store).action is Action.HOLD


def test_soften_tone_steps_down():
    store = _store(_rule(scope=Scope.STRATEGY, directive=Directive.SOFTEN_TONE))
    assert tighten_strategy(_inv(), _chase(), store).tone is Tone.FIRM


def test_tighten_cannot_raise_toward_send():
    # FORCE_HOLD must NOT turn a REVIEW (human) into a HOLD that could later chase.
    review = StrategyDecision(action=Action.REVIEW, reasoning="dispute")
    store = _store(_rule(scope=Scope.STRATEGY, directive=Directive.FORCE_HOLD))
    assert tighten_strategy(_inv(), review, store).action is Action.REVIEW


def test_non_matching_rule_leaves_decision_untouched():
    store = _store(_rule(scope=Scope.STRATEGY, directive=Directive.FORCE_SKIP, criteria={"debtor_name": "Other"}))
    assert tighten_strategy(_inv(), _chase(), store).action is Action.CHASE


# --- gate tighten + soft waive ------------------------------------------------


def test_always_escalate_guardrail_adds_a_violation():
    store = _store(_rule(scope=Scope.COMPLIANCE, directive=Directive.ALWAYS_ESCALATE))
    vios = guardrail_violations(_inv(), store)
    assert [v.code for v in vios] == [OPERATOR_GUARDRAIL]


def test_gate_escalates_a_clean_invoice_under_an_always_escalate_guardrail():
    store = _store(_rule(scope=Scope.COMPLIANCE, directive=Directive.ALWAYS_ESCALATE))
    gate = ComplianceGate(rules_store=store)
    # A benign B2B invoice with a clean message would otherwise pass.
    result = gate.evaluate(_inv(contacts=[_outbound(5)]), "Friendly reminder: {{payment_link}}")
    assert result.decision is GateDecision.ESCALATE
    assert OPERATOR_GUARDRAIL in result.codes


def test_soft_waive_clears_frequency_limit():
    # 3 outbound touches in the last week trips FREQUENCY_LIMIT at the gate.
    inv = _inv(contacts=[_outbound(1), _outbound(2), _outbound(3)])
    base = ComplianceGate().evaluate(inv, "Reminder {{payment_link}}")
    assert "FREQUENCY_LIMIT" in base.codes  # forced failure baseline

    store = _store(_rule(scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="FREQUENCY_LIMIT"))
    waived = ComplianceGate(rules_store=store).evaluate(inv, "Reminder {{payment_link}}")
    assert "FREQUENCY_LIMIT" not in waived.codes


def test_waived_codes_drops_hard_codes():
    # An operator can *ask* to waive a legal code, but it is never honored.
    store = _store(
        _rule(scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="FREQUENCY_LIMIT"),
        _rule(scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="B2B_ONLY"),
        _rule(scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="LEGAL_THREAT"),
    )
    assert waived_codes(_inv(), store) == {"FREQUENCY_LIMIT"}


def test_consumer_debt_cannot_be_waived_end_to_end():
    # THE safety test: a consumer (non-B2B) invoice, plus a waiver for B2B_ONLY, must
    # STILL escalate - a legal/FDCPA rule can never be overridden by a human flag.
    inv = _inv(is_b2b=False, contacts=[_outbound(5)])
    store = _store(_rule(scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="B2B_ONLY"))
    result = ComplianceGate(rules_store=store).evaluate(inv, "Reminder {{payment_link}}")
    assert result.decision is GateDecision.ESCALATE
    assert "B2B_ONLY" in result.codes
