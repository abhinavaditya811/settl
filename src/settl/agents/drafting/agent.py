"""The drafting agent: turn a chase decision into a candidate message.

Mirrors the strategy agent's shape — inject a model and a grounding source, both
defaulting to no-op so the agent runs offline. ``draft`` grounds for customer
voice, builds the prompt, asks the model to generate, logs its reasoning, and
returns a ``DraftedMessage`` for the compliance gate to judge.

The agent is NOT the safety authority: it produces a candidate, nothing more. The
orchestrator always routes that candidate through the compliance gate before any
send — a draft that strays into a legal threat is caught and escalated there, never
here. That separation (the gate decides, not the LLM) is the whole point.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.agents.drafting.grounding import Grounding, NoOpGrounding
from settl.agents.drafting.model import DraftModel, NoOpDraftModel
from settl.agents.drafting.prompt import build_prompt
from settl.agents.strategy.policy import StrategyDecision
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Invoice


@dataclass(frozen=True)
class DraftedMessage:
    """A candidate message produced for the gate. ``text`` is what gets judged."""

    text: str
    channel: str | None = None
    tone: str | None = None
    includes_late_fee: bool = False
    source: str = "template"  # which model produced it (audit trail)
    grounded: bool = False  # whether customer-voice context was used

    def __str__(self) -> str:  # so it interops with the str-based draft seam
        return self.text


class DraftingAgent:
    def __init__(
        self,
        *,
        log: ExecutionLog | None = None,
        model: DraftModel | None = None,
        grounding: Grounding | None = None,
    ) -> None:
        self._log = log
        self._model = model or NoOpDraftModel()
        self._grounding = grounding or NoOpGrounding()

    def draft(self, invoice: Invoice, decision: StrategyDecision) -> DraftedMessage:
        voice = self._grounding.lookup(invoice)
        prompt = build_prompt(invoice, decision, voice.as_prompt_block())
        text = self._model.generate(prompt)

        message = DraftedMessage(
            text=text,
            channel=decision.channel.value if decision.channel else None,
            tone=decision.tone.value if decision.tone else None,
            includes_late_fee=decision.include_late_fee,
            source=getattr(self._model, "name", type(self._model).__name__),
            grounded=not voice.is_empty,
        )

        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="drafting",
                decision="drafted",
                reasoning=(
                    f"Drafted a {message.tone or 'default'} message via "
                    f"{message.source}"
                    + (" (grounded)" if message.grounded else "")
                    + " — candidate sent to the compliance gate."
                ),
                source=message.source,
                tone=message.tone,
                channel=message.channel,
                includes_late_fee=message.includes_late_fee,
                grounded=message.grounded,
            )
        return message
