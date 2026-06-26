"""Strategy agent: wraps the deterministic policy, applies the judgment model
(behind a mandatory safety clamp), and logs every decision with its reasoning."""

from __future__ import annotations

from settl.agents.strategy.bounds import ClampedModel
from settl.agents.strategy.model import JudgmentModel, NoOpModel
from settl.agents.strategy.policy import StrategyDecision, decide_strategy
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Invoice


class StrategyAgent:
    def __init__(
        self,
        log: ExecutionLog | None = None,
        model: JudgmentModel | None = None,
        *,
        min_days_between_touches: int | None = None,
        allowed_tones: tuple[str, ...] | None = None,
    ) -> None:
        self._log = log
        # Every model - real or no-op - is wrapped in the safety clamp, so its
        # output can only refine tone/timing/late-fee on a chase and can never
        # change the action or bypass the gate. The clamp is not optional.
        self._model = ClampedModel(model or NoOpModel())
        # Per-tenant policy inputs (from TenantConfig.policy); None → module defaults.
        self._min_days_between_touches = min_days_between_touches
        self._allowed_tones = allowed_tones

    def decide(self, invoice: Invoice) -> StrategyDecision:
        decision = decide_strategy(
            invoice,
            min_days_between_touches=self._min_days_between_touches,
            allowed_tones=self._allowed_tones,
        )
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
