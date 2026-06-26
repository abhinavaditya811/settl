"""Build the customer-voice prompt for the drafting agent.

Pure string building — no SDK, no model call, fully unit-testable. Turns a
canonical ``Invoice`` + the strategy agent's ``StrategyDecision`` into a
``DraftPrompt``: the structured facts of the chase plus the instruction text a
generation model (Gemini 3 Pro, later) consumes.

Two things live here so they are testable in isolation:

  * ``as_model_input()`` — the full instruction prompt for the LLM. It bakes the
    compliance posture in as *defense in depth* (no legal threats, no consequences
    we can't carry out, no legal advice, stay within the chosen tone). This is a
    courtesy to the model, NOT the safety authority — the compliance gate, never
    this prompt, decides what may send.
  * ``safe_fallback()`` — a deterministic, benign message rendered straight from the
    facts. The ``NoOpDraftModel`` returns this so the whole pipeline runs offline
    with no key, no cost, and a draft the gate will clear on a clean B2B chase.

We never fabricate a payment URL here (we are never custodial — the real secure
link is the customer's own processor link, filled in by the sending layer); the
draft refers to it as a placeholder.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from settl.agents.strategy.policy import StrategyDecision, Tone
from settl.schema.invoice import PAYMENT_LINK_PLACEHOLDER, Invoice

# PAYMENT_LINK_PLACEHOLDER (the token the sending layer swaps for the customer's own
# processor link) now lives in schema.invoice so drafting, sending, and compliance
# share one definition. Re-exported here for callers that import it from prompt.
__all__ = ["DraftPrompt", "build_prompt", "PAYMENT_LINK_PLACEHOLDER"]

# Human-readable framing per tone, kept here so the prompt reads as one story.
_TONE_BRIEF = {
    Tone.FRIENDLY: "warm and lightly apologetic; assume an oversight, not avoidance",
    Tone.FIRM: "polite but direct; clearly request payment without any pressure tactics",
    Tone.FINAL: "serious and final but still courteous; no threats, no ultimatums",
}

# Compliance posture handed to the model as defense in depth. The gate is the real
# authority; these instructions just make a clean draft the likely outcome.
_GUARDRAILS = (
    "Hard rules you must never break:",
    "- Never threaten legal action, lawsuits, court, collections, or a debt collector.",
    "- Never claim a consequence we cannot or will not carry out "
    "(credit reporting, seizing assets, etc.).",
    "- Never give legal advice or assert what the recipient is legally obligated to do.",
    "- Do not insult, shame, or harass. Stay strictly within the requested tone.",
    "- Do not invent a payment URL; refer to the secure payment link placeholder only.",
)


@dataclass(frozen=True)
class DraftPrompt:
    """The built prompt: structured facts + the model-facing instruction text."""

    debtor_name: str
    invoice_ref: str
    amount_due: str
    currency: str
    days_overdue: int
    tone: Tone
    the_ask: str
    include_late_fee: bool
    channel: str | None
    voice_block: str = ""  # grounding context, empty when ungrounded
    factors: dict = field(default_factory=dict)

    @property
    def tone_brief(self) -> str:
        return _TONE_BRIEF.get(self.tone, "professional and courteous")

    def as_model_input(self) -> str:
        """The full instruction prompt a generation model consumes."""
        lines = [
            "You are drafting a first-party B2B payment reminder on behalf of the "
            "creditor, in their own voice. Write only the message body — no subject "
            "line, no preamble, no sign-off placeholder beyond a brief thank-you.",
            "",
            "Context:",
            f"- Recipient: {self.debtor_name}",
            f"- Invoice: {self.invoice_ref} for {self.amount_due} {self.currency}",
            f"- {self.days_overdue} days overdue",
            f"- Channel: {self.channel or 'email'}",
            f"- Tone: {self.tone.value} — {self.tone_brief}",
            f"- The ask: {self.the_ask}",
            "- Mention a late fee may apply per the agreed terms."
            if self.include_late_fee
            else "- Do not mention any late fee.",
            f"- Direct them to their secure payment link: {PAYMENT_LINK_PLACEHOLDER}",
        ]
        if self.voice_block:
            lines += ["", "Customer voice / context to match:", self.voice_block]
        lines += ["", *_GUARDRAILS]
        return "\n".join(lines)

    def safe_fallback(self) -> str:
        """A deterministic, compliant message rendered from the facts.

        Used by ``NoOpDraftModel`` so the pipeline produces a real, gate-clearing
        draft with no model call. Phrasing is deliberately kept clear of every
        pattern the compliance gate scans for.
        """
        opener = {
            Tone.FRIENDLY: f"Hi {self.debtor_name}, just a friendly reminder",
            Tone.FIRM: f"Hi {self.debtor_name}, a quick note that",
            Tone.FINAL: f"Hi {self.debtor_name}, this is a final reminder that",
        }.get(self.tone, f"Hi {self.debtor_name}, a reminder that")

        body = (
            f"{opener} invoice {self.invoice_ref} for {self.amount_due} "
            f"{self.currency} is now {self.days_overdue} days past due. "
            f"You can settle it here whenever convenient: {PAYMENT_LINK_PLACEHOLDER}."
        )
        if self.include_late_fee:
            body += " A late fee may apply per the agreed terms."
        body += " If anything is holding it up, just let us know — happy to help. Thank you!"
        return body


def build_prompt(
    invoice: Invoice,
    decision: StrategyDecision,
    voice_block: str = "",
) -> DraftPrompt:
    """Invoice + StrategyDecision (+ optional grounding) → DraftPrompt. Pure."""
    return DraftPrompt(
        debtor_name=invoice.debtor_name,
        invoice_ref=invoice.invoice_id,
        amount_due=f"{invoice.amount_due}",
        currency=invoice.currency,
        days_overdue=invoice.days_overdue,
        tone=decision.tone or Tone.FRIENDLY,
        the_ask=decision.the_ask or "request payment with the secure link",
        include_late_fee=decision.include_late_fee,
        channel=decision.channel.value if decision.channel else None,
        voice_block=voice_block,
        factors=dict(decision.factors),
    )
