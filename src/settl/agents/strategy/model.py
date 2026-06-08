"""Judgment-model seam for the strategy agent.

DESIGN §3 maps the strategy agent to Gemini 3 Pro. We do NOT wire that in the
decision-core phase: instead we define the interface it will implement and ship a
no-op default so the deterministic policy runs alone, with no API key or cost, and
stays fully unit-testable.

When the model lands (plumbing phase), it implements ``JudgmentModel.refine`` to
nudge tone/timing within policy bounds. It must never flip a SKIP/REVIEW into a
send, and it never substitutes for the compliance gate.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from settl.agents.strategy.policy import StrategyDecision
from settl.schema.invoice import Invoice


@runtime_checkable
class JudgmentModel(Protocol):
    def refine(self, invoice: Invoice, decision: StrategyDecision) -> StrategyDecision:
        """Optionally adjust a policy decision; return it unchanged if no opinion."""
        ...


class NoOpModel:
    """Default model: trusts the deterministic policy entirely."""

    def refine(self, invoice: Invoice, decision: StrategyDecision) -> StrategyDecision:
        return decision
