"""The inbound agent: classify one reply, log the decision.

Thin wrapper around the model seam (model.py), mirroring DraftingAgent/StrategyAgent's
shape - every agent decision is written to the execution log with its reasoning
(CLAUDE.md: required, not optional). The orchestrator/lane-routing layer (Phase 2)
is what turns a lane into "draft a reply" / "alert-only" / "hand to the PaymentPlan
flow"; this agent only decides which lane.
"""

from __future__ import annotations

from settl.agents.inbound.classifier import InboundClassification
from settl.agents.inbound.model import InboundClassifierModel, NoOpClassifierModel
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Invoice


class InboundAgent:
    def __init__(
        self,
        *,
        log: ExecutionLog | None = None,
        model: InboundClassifierModel | None = None,
    ) -> None:
        self._log = log
        self._model = model or NoOpClassifierModel()

    def classify(self, invoice: Invoice, message_text: str) -> InboundClassification:
        result = self._model.classify(invoice, message_text)
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="inbound_classifier",
                decision=result.lane.value,
                reasoning=result.reasoning,
                model=self._model.name,
                confidence=result.confidence,
            )
        return result
