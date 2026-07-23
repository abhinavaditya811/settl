"""🔌 Generation-model seam for inbound classification (lane routing).

Classifying which lane a reply belongs in is routing, not judgment, so it gets a
fast/high-volume model. Mirrors the drafting/strategy model seams: a deterministic
``NoOpClassifierModel`` default (decision core first) plus two interchangeable live
models - ``GeminiInboundClassifierModel`` and ``GroqInboundClassifierModel`` (Groq
serving open-source Llama, added because Gemini's free tier kept 429-ing and
silently dropping the classification to the weaker regex backstop). engine_factories
picks one; both honor the same contract.

Unlike drafting's fail-safe (falls back to a safe template), classification's
fail-safe falls back to the regex backstop (classifier.py) rather than to a fixed
"benign" answer - an API error is not evidence a reply is safe to auto-handle.
"""

from __future__ import annotations

import os
from typing import Literal, Protocol, runtime_checkable

from pydantic import BaseModel, Field

from settl.agents.inbound.classifier import (
    InboundClassification,
    InboundLane,
    classify_deterministic,
    thread_classifications,
)
from settl.config import gemini_flash_model_name, groq_model_name, load_dotenv
from settl.schema.invoice import Invoice

# Below this, the model's own answer is not trusted enough to act on - escalate
# instead of guessing (matches the earlier agreed rule: low confidence -> escalate).
_CONFIDENCE_ESCALATE_THRESHOLD = 0.6

# Structured output schema (google-genai response_schema, verified against the
# installed 2.10.0 SDK - GenerateContentConfig.response_schema accepts a plain
# type/BaseModel and GenerateContentResponse.parsed returns a validated instance,
# not hand-coded from memory per CLAUDE.md's SDK-verification rule). Four real
# lanes only - ESCALATE_LOW_CONFIDENCE is a threshold WE apply below, never a
# choice the model itself makes.
class _ClassificationOutput(BaseModel):
    lane: Literal["benign", "dispute", "opt_out", "payment_plan_request"]
    confidence: float = Field(ge=0, le=1)
    reasoning: str


_LANE_GUIDE = """Classify this debtor's email reply into exactly one lane:

- "dispute": the debtor disputes the debt, charge, or invoice's validity
  (e.g. "this isn't mine", "I already paid this", "this amount is wrong").
- "opt_out": the debtor asks to stop being contacted, on any channel - email,
  calls, texts (e.g. "stop emailing me", "don't send me such emails",
  "unsubscribe"). Judge the INTENT, not an exact phrase - opt-out requests are
  worded many different ways.
- "payment_plan_request": the debtor asks to pay in installments, over time,
  or requests a payment plan.
- "benign": anything else - confirmations, questions, a promise to pay, or
  general acknowledgment with no escalation signal.

Give a confidence from 0 to 1, and a short, clear reasoning - a human reviewer
reads it directly, so state plainly what in the message drove your answer."""


@runtime_checkable
class InboundClassifierModel(Protocol):
    name: str

    def classify(self, invoice: Invoice, message_text: str) -> InboundClassification:
        """Return the lane this reply belongs in, given the invoice's thread history."""
        ...


class NoOpClassifierModel:
    """Default model: the regex backstop alone. No SDK, no key, no cost - keeps
    the pipeline runnable and testable offline."""

    name = "regex"

    def classify(self, invoice: Invoice, message_text: str) -> InboundClassification:
        return classify_deterministic(invoice, message_text)


def _low_confidence(result: InboundClassification) -> InboundClassification:
    """Below the trust threshold → escalate rather than act on the guess (shared by
    every live model). A human reads the reasoning, so it names the real model's
    answer + confidence, never a blind benign."""
    return InboundClassification(
        InboundLane.ESCALATE_LOW_CONFIDENCE,
        result.confidence,
        f"model confidence {result.confidence:.2f} below threshold - "
        f"escalating rather than trusting its guess ({result.reasoning})",
    )


class GeminiInboundClassifierModel:
    """🔌 Live Gemini Flash classification. Fail-safe: a missing key, missing SDK,
    any API error, or a low-confidence model answer all fall back to (or are
    overridden to) the deterministic regex classification - never a blind "benign"."""

    def __init__(self, *, model_name: str | None = None, client=None) -> None:
        load_dotenv()
        self._model_name = gemini_flash_model_name(model_name)
        self.name = self._model_name  # log the ACTUAL model, not a hardcoded label
        self._client = client  # injectable for tests; created lazily otherwise

    def _get_client(self):
        if self._client is None:
            from google import genai  # lazy import: the SDK is an optional extra

            self._client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
        return self._client

    def classify(self, invoice: Invoice, message_text: str) -> InboundClassification:
        if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
            return classify_deterministic(invoice, message_text)
        try:
            result = self._call_model(invoice, message_text)
        except Exception:
            return classify_deterministic(invoice, message_text)
        if result.confidence < _CONFIDENCE_ESCALATE_THRESHOLD:
            return _low_confidence(result)
        return result

    def _call_model(self, invoice: Invoice, message_text: str) -> InboundClassification:
        from google.genai import types

        history = thread_classifications(invoice)
        history_note = (
            f"Prior classifications in this thread (oldest first): {', '.join(history)}"
            if history else "No prior classifications in this thread."
        )
        prompt = f"{_LANE_GUIDE}\n\n{history_note}\n\nDebtor's message:\n{message_text}"

        response = self._get_client().models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=_ClassificationOutput,
                temperature=0.1,  # classification, not creative generation
            ),
        )
        parsed = response.parsed
        if not isinstance(parsed, _ClassificationOutput):
            raise ValueError(f"unexpected structured-output shape: {parsed!r}")
        return InboundClassification(InboundLane(parsed.lane), parsed.confidence, parsed.reasoning)


_JSON_INSTRUCTION = (
    'Respond with ONLY a JSON object, no prose, exactly this shape: '
    '{"lane": "benign|dispute|opt_out|payment_plan_request", '
    '"confidence": <number 0..1>, "reasoning": "<one short sentence>"}'
)


class GroqInboundClassifierModel:
    """🔌 Live Groq (open-source Llama) classification - a higher-quota, faster
    alternative to Gemini for the SAME lane routing, on an OpenAI-compatible API.
    Same fail-safe posture as the Gemini model: a missing key, missing SDK, any
    API error, or a low-confidence answer falls back to (or is overridden to) the
    deterministic regex classification - never a blind "benign". Only WHICH lane a
    reply routes to changes; the compliance gate stays the sole send authority."""

    def __init__(self, *, model_name: str | None = None, client=None) -> None:
        load_dotenv()
        self._model_name = groq_model_name(model_name)
        self.name = self._model_name
        self._client = client  # injectable for tests; created lazily otherwise

    def _get_client(self):
        if self._client is None:
            from groq import Groq  # lazy import: the SDK is an optional extra

            self._client = Groq()  # reads GROQ_API_KEY
        return self._client

    def classify(self, invoice: Invoice, message_text: str) -> InboundClassification:
        if not os.environ.get("GROQ_API_KEY"):
            return classify_deterministic(invoice, message_text)
        try:
            result = self._call_model(invoice, message_text)
        except Exception:
            return classify_deterministic(invoice, message_text)
        if result.confidence < _CONFIDENCE_ESCALATE_THRESHOLD:
            return _low_confidence(result)
        return result

    def _call_model(self, invoice: Invoice, message_text: str) -> InboundClassification:
        history = thread_classifications(invoice)
        history_note = (
            f"Prior classifications in this thread (oldest first): {', '.join(history)}"
            if history else "No prior classifications in this thread."
        )
        response = self._get_client().chat.completions.create(
            model=self._model_name,
            messages=[
                {"role": "system", "content": f"{_LANE_GUIDE}\n\n{_JSON_INSTRUCTION}"},
                {"role": "user", "content": f"{history_note}\n\nDebtor's message:\n{message_text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,  # classification, not creative generation
        )
        content = response.choices[0].message.content or ""
        parsed = _ClassificationOutput.model_validate_json(content)
        return InboundClassification(InboundLane(parsed.lane), parsed.confidence, parsed.reasoning)
