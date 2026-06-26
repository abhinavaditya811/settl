"""🔌 Live Gemini 3 Pro judgment model for the strategy agent.

DESIGN §3 maps strategy *judgment* to Gemini 3 Pro: it may refine a deterministic
``StrategyDecision``'s tone / late-fee, never its action and never the gate. This
is implemented against the current ``google-genai`` SDK (verified against official
docs, not coded from memory, per CLAUDE.md).

Two safety properties hold regardless of what the model returns:
  * This model only *proposes*. ``bounds.ClampedModel`` - which the agent always
    wraps around it - re-enforces the tone/timing/late-fee-only contract, so even
    a misbehaving model can't change the action or reach the gate.
  * It is fail-safe: a missing key, a missing SDK, an API error, or an unparseable
    response all fall back to the deterministic decision, unchanged.

Setup: drop a free Gemini API key in the gitignored ``.env`` as ``GEMINI_API_KEY``
(get one at https://aistudio.google.com/apikey). Override the model id with
``GEMINI_MODEL`` if the default isn't available to your key/region.
"""

from __future__ import annotations

import dataclasses
import os

from pydantic import BaseModel, Field

from settl.agents.strategy.policy import Action, StrategyDecision, Tone
from settl.audit.execution_log import ExecutionLog
from settl.config import load_dotenv
from settl.schema.invoice import Invoice

# Gemini 3 Pro per DESIGN §3. The plain "gemini-3-pro" id does not exist; the
# real current id is the preview one. Free-tier keys often lack quota for it (429),
# in which case set GEMINI_MODEL to a free-tier model (e.g. gemini-2.5-flash) - the
# model is fail-safe either way.
DEFAULT_GEMINI_MODEL = "gemini-3-pro-preview"

_SYSTEM_INSTRUCTION = (
    "You are a B2B accounts-receivable tone assistant. You receive an overdue "
    "invoice and the deterministic policy's reminder plan. You may ONLY suggest a "
    "tone and whether an already-agreed late fee should be mentioned. You do NOT "
    "decide whether to contact the debtor, never make legal threats, never give "
    "legal advice, and never invent consequences. Keep it professional and "
    "proportionate to how overdue the invoice is."
)

_TONE_BY_VALUE = {t.value: t for t in Tone}


class JudgmentSuggestion(BaseModel):
    """The only things the model may influence (the clamp enforces this too)."""

    tone: str = Field(description="one of: friendly_reminder, firm_reminder, final_notice")
    include_late_fee: bool = Field(description="mention an already-agreed late fee?")
    rationale: str = Field(description="one short sentence explaining the choice")


class GeminiJudgmentModel:
    """🔌 Real Gemini judgment: refines tone/late-fee on a CHASE, fail-safe otherwise."""

    name = "gemini-3-pro"

    def __init__(
        self,
        *,
        model_name: str | None = None,
        client=None,
        log: ExecutionLog | None = None,
    ) -> None:
        load_dotenv()  # surface a .env-provided key to the SDK
        self._model_name = model_name or os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        self._client = client  # injectable for tests; created lazily otherwise
        self._log = log

    def _get_client(self):
        if self._client is None:
            from google import genai  # lazy import: the SDK is an optional extra

            self._client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
        return self._client

    def refine(self, invoice: Invoice, decision: StrategyDecision) -> StrategyDecision:
        # Judgment only refines a real chase; the clamp ignores everything else, so
        # there's no reason to spend a model call on it.
        if decision.action is not Action.CHASE:
            return decision
        if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
            return decision  # no key configured -> stay deterministic, silently

        try:
            # A dict config is coerced to GenerateContentConfig by the SDK, so we
            # don't import `types` here - which keeps this path injectable in tests
            # (a fake client needs no SDK installed at all).
            response = self._get_client().models.generate_content(
                model=self._model_name,
                contents=_build_prompt(invoice, decision),
                config={
                    "system_instruction": _SYSTEM_INSTRUCTION,
                    "response_mime_type": "application/json",
                    "response_schema": JudgmentSuggestion,
                    "temperature": 0.4,
                },
            )
            suggestion = _parse(response)
            tone = _TONE_BY_VALUE.get(suggestion.tone, decision.tone)
            # Never let the model add a fee the terms don't permit; it may always
            # drop one. (The policy already gates this; this is defence in depth.)
            fee = bool(suggestion.include_late_fee) and invoice.late_fee_allowed
            refined = dataclasses.replace(decision, tone=tone, include_late_fee=fee)
            self._log_event(invoice, "refined", suggestion.rationale, refined)
            return refined
        except Exception as exc:  # fail safe: keep the deterministic decision
            self._log_event(invoice, "skipped", f"Gemini unavailable ({type(exc).__name__})", decision)
            return decision

    def _log_event(self, invoice: Invoice, decision_label: str, note: str, result: StrategyDecision) -> None:
        if self._log is None:
            return
        self._log.record(
            invoice_id=invoice.invoice_id,
            agent="strategy_judgment",
            decision=decision_label,
            reasoning=note,
            tone=result.tone.value if result.tone else None,
            include_late_fee=result.include_late_fee,
        )


def _build_prompt(invoice: Invoice, decision: StrategyDecision) -> str:
    tone = decision.tone.value if decision.tone else "n/a"
    return (
        "Overdue invoice:\n"
        f"- days overdue: {invoice.days_overdue}\n"
        f"- amount: {invoice.amount_due} {invoice.currency}\n"
        f"- debtor: {invoice.debtor_name}\n"
        f"- late fee allowed by the agreed terms: {invoice.late_fee_allowed}\n\n"
        "Policy's current plan:\n"
        f"- tone: {tone}\n"
        f"- include late fee: {decision.include_late_fee}\n"
        f"- reasoning: {decision.reasoning}\n\n"
        "Suggest the most appropriate tone and whether to mention the late fee "
        "(only if the terms allow it)."
    )


def _parse(response) -> JudgmentSuggestion:
    """Accept either the SDK's parsed pydantic object or raw JSON text."""
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, JudgmentSuggestion):
        return parsed
    return JudgmentSuggestion.model_validate_json(response.text)
