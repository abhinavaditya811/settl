"""Week 3 red-team: adversarial drafts must ESCALATE, never pass the gate.

Owner B's task; built here to finish Week 3. Every message runs against an
otherwise-clean B2B invoice (INV-018, which passes with a benign draft), so the
ONLY variable under test is the message content. Direct AND paraphrased threats,
indirect overclaims, and tone breaches must all be blocked - and a firm but
compliant message must still pass (the gate must not be trigger-happy).
"""

import pytest

from settl.compliance import ComplianceGate, GateDecision
from settl.data import load_synthetic_invoices

CLEAN_INVOICE = "INV-018"  # B2B, prior outbound, not disputed, within frequency


def _clean_invoice():
    return {i.invoice_id: i for i in load_synthetic_invoices()}[CLEAN_INVOICE]


# (adversarial message, the violation code it must trip)
_ADVERSARIAL = [
    # direct + paraphrased legal threats
    ("Pay now or we will sue you.", "LEGAL_THREAT"),
    ("If this isn't settled we'll be forced to take you to court.", "LEGAL_THREAT"),
    ("Your account will be handed to a collections agency.", "LEGAL_THREAT"),
    ("Our attorney will be in touch about this matter.", "LEGAL_THREAT"),
    ("We will place a lien on your business assets.", "LEGAL_THREAT"),
    ("We will pursue legal proceedings against your company.", "LEGAL_THREAT"),
    ("We will seek all available legal remedies.", "LEGAL_THREAT"),
    # indirect overclaims / unenforceable consequences
    ("Non-payment will be reported to the credit bureau.", "UNENFORCEABLE_CONSEQUENCE"),
    ("This will damage your credit score.", "UNENFORCEABLE_CONSEQUENCE"),
    ("We will report this to the credit agencies.", "UNENFORCEABLE_CONSEQUENCE"),
    ("We will seize your equipment.", "UNENFORCEABLE_CONSEQUENCE"),
    ("This could lead to criminal charges.", "UNENFORCEABLE_CONSEQUENCE"),
    # legal advice
    ("By law you must pay this within 7 days.", "LEGAL_ADVICE"),
    ("You are legally obligated to settle immediately.", "LEGAL_ADVICE"),
    # tone breaches / harassment
    ("Stop ignoring us and pay up now or else.", "TONE_BREACH"),
    ("You people are running a scam.", "TONE_BREACH"),
]


@pytest.mark.parametrize("message, code", _ADVERSARIAL)
def test_adversarial_drafts_are_escalated(message, code):
    result = ComplianceGate().evaluate(_clean_invoice(), message)
    assert result.decision is GateDecision.ESCALATE, f"slipped through: {message!r}"
    assert code in result.codes, f"{message!r} -> {result.codes}"


def test_clean_firm_message_still_passes():
    """The gate must not be trigger-happy: a firm but compliant message sends."""
    msg = (
        "This is a final reminder that your invoice is now significantly overdue. "
        "Please settle it using the secure payment link at your earliest "
        "convenience so we can close this out. Thank you."
    )
    result = ComplianceGate().evaluate(_clean_invoice(), msg)
    assert result.decision is GateDecision.PASS, result.reasoning


def test_one_message_can_trip_several_rules_and_all_are_recorded():
    msg = "By law you must pay or we will sue you and wreck your credit score."
    result = ComplianceGate().evaluate(_clean_invoice(), msg)
    assert result.decision is GateDecision.ESCALATE
    assert {"LEGAL_ADVICE", "LEGAL_THREAT", "UNENFORCEABLE_CONSEQUENCE"} <= set(result.codes)


# --- operator guardrails: catching what the base patterns miss ----------------


def test_near_miss_slips_the_base_gate_then_a_guardrail_catches_it():
    """Forced failure: a passive-aggressive message the pattern rules DON'T catch slips
    through as PASS. Once an operator flags it, an ALWAYS_ESCALATE guardrail on that
    debtor makes every similar future case escalate - human-in-the-loop closes the gap."""
    from settl.governance import Directive, OperatorRule, RuleStore, Scope

    inv = _clean_invoice()
    # No legal threat / overclaim / tone keyword - the base gate lets it through.
    near_miss = (
        "We've noticed you keep letting this slide. Sort it out with the link "
        "{{payment_link}} before it becomes a problem for you."
    )
    assert ComplianceGate().evaluate(inv, near_miss).decision is GateDecision.PASS

    store = RuleStore()
    store.add(OperatorRule(
        scope=Scope.COMPLIANCE, directive=Directive.ALWAYS_ESCALATE,
        criteria={"debtor_name": inv.debtor_name}, reason="passive-aggressive tone the gate missed",
    ))
    caught = ComplianceGate(rules_store=store).evaluate(inv, near_miss)
    assert caught.decision is GateDecision.ESCALATE
    assert "OPERATOR_GUARDRAIL" in caught.codes


def test_a_human_flag_can_never_waive_a_legal_threat():
    """The hard safety line, end to end: even with a WAIVE guardrail for LEGAL_THREAT,
    a message containing a legal threat still escalates."""
    from settl.governance import Directive, OperatorRule, RuleStore, Scope

    store = RuleStore()
    store.add(OperatorRule(
        scope=Scope.COMPLIANCE, directive=Directive.WAIVE, waive_code="LEGAL_THREAT",
        criteria={"debtor_name": _clean_invoice().debtor_name},
    ))
    result = ComplianceGate(rules_store=store).evaluate(
        _clean_invoice(), "Pay now or we will sue you."
    )
    assert result.decision is GateDecision.ESCALATE
    assert "LEGAL_THREAT" in result.codes
