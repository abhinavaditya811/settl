"""🔌 Generation-model seam for inbound classification (Gemini 3 Flash).

CLAUDE.md maps high-volume routing to Gemini 3 Flash, judgment (strategy, drafting)
to Gemini 3 Pro. Classifying which lane a reply belongs in is routing, not judgment,
so it gets Flash. Mirrors the drafting/strategy model seams: a deterministic
``NoOpClassifierModel`` default (decision core first) and a fail-safe live model.

Unlike drafting's fail-safe (falls back to a safe template), classification's
fail-safe falls back to the regex backstop (classifier.py) rather than to a fixed
"benign" answer - an API error is not evidence a reply is safe to auto-handle.
"""

from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

from settl.agents.inbound.classifier import (
    InboundClassification,
    InboundLane,
    classify_deterministic,
)
from settl.config import gemini_flash_model_name, load_dotenv
from settl.schema.invoice import Invoice

# Below this, the model's own answer is not trusted enough to act on - escalate
# instead of guessing (matches the earlier agreed rule: low confidence -> escalate).
_CONFIDENCE_ESCALATE_THRESHOLD = 0.6


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


class GeminiInboundClassifierModel:
    """🔌 Live Gemini Flash classification. Fail-safe: a missing key, missing SDK,
    any API error, or a low-confidence model answer all fall back to (or are
    overridden to) the deterministic regex classification - never a blind "benign"."""

    name = "gemini-3-flash"

    def __init__(self, *, model_name: str | None = None, client=None) -> None:
        load_dotenv()
        self._model_name = gemini_flash_model_name(model_name)
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
            return InboundClassification(
                InboundLane.ESCALATE_LOW_CONFIDENCE,
                result.confidence,
                f"model confidence {result.confidence:.2f} below threshold - "
                f"escalating rather than trusting its guess ({result.reasoning})",
            )
        return result

    def _call_model(self, invoice: Invoice, message_text: str) -> InboundClassification:
        # Verify against current Gemini/ADK structured-output docs before wiring this
        # for real (CLAUDE.md: the SDK surface moves fast, don't hand-code from memory).
        # Expected to prompt for {lane, confidence, reasoning} as structured JSON over
        # message_text + thread_classifications(invoice), constrained to InboundLane's
        # values. Until implemented, defer to the regex backstop.
        raise NotImplementedError
