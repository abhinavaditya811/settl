"""Build the prompt for replying to a BENIGN inbound message (SCHEMA.md §7).

Separate from prompt.py's ``DraftPrompt``: a reply responds to the debtor's own
words rather than initiating a chase from a ``StrategyDecision``, so the shape is
different (no tone/the_ask/late-fee inputs - just what they said and the facts).
Only ever reached for the BENIGN lane - dispute/payment-plan/low-confidence never
get here (agents/inbound/classifier.py, orchestrator.Orchestrator.handle_inbound).
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.agents.drafting.guardrails import _BASE_GUARDRAILS
from settl.schema.invoice import PAYMENT_LINK_PLACEHOLDER, Invoice

# Reply has no lane-specific extras today; import the shared set so it cannot drift.
_GUARDRAILS = _BASE_GUARDRAILS


@dataclass(frozen=True)
class ReplyPrompt:
    debtor_name: str
    invoice_ref: str
    amount_due: str
    currency: str
    inbound_message: str
    voice_block: str = ""

    def as_model_input(self) -> str:
        lines = [
            "You are replying, on behalf of the creditor and in their own voice, to "
            "a benign reply from a debtor about a first-party B2B invoice. Write "
            "only the message body - no subject line, no preamble.",
            "",
            "Context:",
            f"- Recipient: {self.debtor_name}",
            f"- Invoice: {self.invoice_ref} for {self.amount_due} {self.currency}",
            f"- Their message: \"{self.inbound_message}\"",
            f"- Direct them to their secure payment link if relevant: {PAYMENT_LINK_PLACEHOLDER}",
        ]
        if self.voice_block:
            lines += ["", "Customer voice / context to match:", self.voice_block]
        lines += ["", *_GUARDRAILS]
        return "\n".join(lines)

    def safe_fallback(self) -> str:
        """Deterministic, compliant acknowledgement - what ``NoOpReplyModel`` returns."""
        return (
            f"Hi {self.debtor_name}, thanks for the reply on invoice {self.invoice_ref} "
            f"({self.amount_due} {self.currency}). Here's the secure payment link "
            f"whenever it's convenient: {PAYMENT_LINK_PLACEHOLDER}. Let us know if "
            "anything else comes up - happy to help."
        )


def build_reply_prompt(
    invoice: Invoice, inbound_message: str, voice_block: str = ""
) -> ReplyPrompt:
    """Invoice + the debtor's message (+ optional grounding) → ReplyPrompt. Pure."""
    return ReplyPrompt(
        debtor_name=invoice.debtor_name,
        invoice_ref=invoice.invoice_id,
        amount_due=f"{invoice.amount_due}",
        currency=invoice.currency,
        inbound_message=inbound_message,
        voice_block=voice_block,
    )
