"""Operator guardrails: human-in-the-loop feedback that steers the engine.

A flagged decision becomes an ``OperatorRule`` in the ``RuleStore``; the engine applies
it at two seams (strategy tighten, compliance gate) via ``apply``. Safety is structural:
tighten freely, waive soft rules only - never a legal/consumer/dispute rule.
"""

from settl.governance.apply import (
    guardrail_violations,
    tighten_strategy,
    waived_codes,
)
from settl.governance.rules import Directive, OperatorRule, Scope, matches
from settl.governance.store import RuleStore

__all__ = [
    "OperatorRule",
    "Directive",
    "Scope",
    "matches",
    "RuleStore",
    "tighten_strategy",
    "guardrail_violations",
    "waived_codes",
]
