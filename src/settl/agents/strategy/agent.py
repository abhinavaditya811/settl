"""Strategy agent: wraps the deterministic policy, applies the (no-op for now)
judgment model, and logs every decision with its reasoning."""

from __future__ import annotations

from settl.agents.strategy.model import JudgmentModel, NoOpModel
from settl.agents.strategy.policy import StrategyDecision, decide_strategy
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Invoice


class StrategyAgent:
    def __init__(
        self,
        log: ExecutionLog | None = None,
        model: JudgmentModel | None = None,
    ) -> None:
        self._log = log
        self._model = model or NoOpModel()

    def decide(self, invoice: Invoice) -> StrategyDecision:
        decision = decide_strategy(invoice)
        decision = self._model.refine(invoice, decision)

        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="strategy",
                decision=decision.action.value,
                reasoning=decision.reasoning,
                channel=decision.channel.value if decision.channel else None,
                tone=decision.tone.value if decision.tone else None,
                include_late_fee=decision.include_late_fee,
                escalation_hint=decision.escalation_hint,
                factors=decision.factors,
            )
        return decision
