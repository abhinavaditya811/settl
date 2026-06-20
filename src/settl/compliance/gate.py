"""The compliance gate.

Sits between every draft and every send. It runs the enumerated rules in rules.py
and produces a single binary decision: PASS (safe to send) or ESCALATE (block and
route to a human). It is deterministic and conservative - any rule firing escalates.

It evaluates two layers:
  * invoice/state + human-in-the-loop rules - always run
  * message-content rules - run when a drafted message is supplied

In task 1 there is no drafting agent yet, so callers either omit the message (to
check state-level safety) or pass a candidate string directly (how the tests prove
the message-content rules). Every evaluation is written to the execution log.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from settl.audit.execution_log import ExecutionLog
from settl.compliance import rules
from settl.compliance.rules import RuleViolation
from settl.schema.invoice import Invoice

# Run order is just for readable reasoning; all violations are collected.
_INVOICE_RULES = (
    rules.rule_consumer_debt,
    rules.rule_disputed,
    rules.rule_inbound_dispute,
    rules.rule_payment_plan_request,
    rules.rule_contact_frequency,
    rules.rule_first_contact,
)
_MESSAGE_RULES = (
    rules.rule_legal_threat,
    rules.rule_unenforceable_consequence,
    rules.rule_legal_advice,
    rules.rule_tone_bounds,
)


class GateDecision(str, Enum):
    PASS = "pass"
    ESCALATE = "escalate"


@dataclass(frozen=True)
class ComplianceResult:
    decision: GateDecision
    violations: list[RuleViolation] = field(default_factory=list)
    reasoning: str = ""

    @property
    def passed(self) -> bool:
        return self.decision is GateDecision.PASS

    @property
    def codes(self) -> list[str]:
        return [v.code for v in self.violations]


class ComplianceGate:
    def __init__(self, log: ExecutionLog | None = None) -> None:
        self._log = log

    def evaluate(
        self, invoice: Invoice, message: str | None = None
    ) -> ComplianceResult:
        violations: list[RuleViolation] = []
        for rule in _INVOICE_RULES:
            violations.extend(rule(invoice))
        if message is not None:
            for mrule in _MESSAGE_RULES:
                violations.extend(mrule(message))

        if violations:
            decision = GateDecision.ESCALATE
            reasoning = "Escalated to human: " + "; ".join(
                f"[{v.code}] {v.message}" for v in violations
            )
        else:
            decision = GateDecision.PASS
            reasoning = "All compliance rules cleared - safe to send."

        result = ComplianceResult(decision, violations, reasoning)
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="compliance_gate",
                decision=decision.value,
                reasoning=reasoning,
                violation_codes=result.codes,
                message_checked=message is not None,
            )
        return result
