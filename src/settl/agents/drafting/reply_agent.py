"""The reply-drafting agent: turn a BENIGN inbound message into a candidate reply.

Sibling to DraftingAgent rather than a method on it - ``DraftingAgent.draft``'s
signature (``invoice, StrategyDecision``) doesn't fit a reply, which responds to
the debtor's own words instead. Shares grounding.py's ``Grounding``/``NoOpGrounding``
so per-tenant voice flows through the same way. Not the safety authority - the
orchestrator always routes the result through the compliance gate before any send.
"""

from __future__ import annotations

from settl.agents.drafting.agent import DraftedMessage
from settl.agents.drafting.grounding import Grounding, NoOpGrounding
from settl.agents.drafting.reply_model import NoOpReplyModel, ReplyModel
from settl.agents.drafting.reply_prompt import build_reply_prompt
from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Channel, Invoice


class ReplyDraftingAgent:
    def __init__(
        self,
        *,
        log: ExecutionLog | None = None,
        model: ReplyModel | None = None,
        grounding: Grounding | None = None,
    ) -> None:
        self._log = log
        self._model = model or NoOpReplyModel()
        self._grounding = grounding or NoOpGrounding()

    def draft(self, invoice: Invoice, inbound_message: str) -> DraftedMessage:
        voice = self._grounding.lookup(invoice)
        prompt = build_reply_prompt(invoice, inbound_message, voice.as_prompt_block())
        text = self._model.generate(prompt)

        message = DraftedMessage(
            text=text,
            channel=Channel.EMAIL.value,  # inbound mail is email-only (SCHEMA.md §7)
            source=getattr(self._model, "name", type(self._model).__name__),
            grounded=not voice.is_empty,
        )

        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="reply_drafting",
                decision="drafted",
                reasoning=(
                    f"Drafted a reply via {message.source}"
                    + (" (grounded)" if message.grounded else "")
                    + " - candidate sent to the compliance gate."
                ),
                source=message.source,
                grounded=message.grounded,
            )
        return message
