"""🔌 Generation-model seam for the drafting agent (Gemini 3 Pro via ADK/Vertex).

DESIGN §3 maps drafting — the *visible* AI — to Gemini 3 Pro. We keep that wiring
behind this interface, mirroring the strategy agent's ``model.py`` seam, so the
agent stays testable offline and the live SDK call is a single swappable component.

Per CLAUDE.md build order ("decision core first, plumbing last") and the note that
the Gemini/ADK surface moves fast, we ship a deterministic ``NoOpDraftModel`` that
renders the prompt's safe fallback, and a ``GeminiDraftModel`` skeleton that must be
implemented against current official docs (context7) — never hand-coded from memory.

Whatever a model returns is only a *candidate*. The compliance gate, never the
model, decides what may send — a model that emits a legal threat is caught and
escalated downstream, by design.
"""

from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

from settl.agents.drafting.prompt import DraftPrompt
from settl.config import gemini_model_name, load_dotenv


@runtime_checkable
class DraftModel(Protocol):
    # Short label for the audit trail / trace ("template", "gemini-3-pro", ...).
    name: str

    def generate(self, prompt: DraftPrompt) -> str:
        """Return the candidate message body for the given prompt."""
        ...


class NoOpDraftModel:
    """Default model: returns the prompt's deterministic, compliant fallback.

    No SDK, no key, no cost — keeps the whole pipeline runnable and testable
    offline while still producing a real, gate-clearing draft.
    """

    name = "template"

    def generate(self, prompt: DraftPrompt) -> str:
        return prompt.safe_fallback()


class GeminiDraftModel:
    """🔌 Live Gemini generation for the drafting agent (the visible AI).

    Feeds ``prompt.as_model_input()`` - which already carries the full instructions
    and compliance guardrails - to Gemini and returns the message body. Mirrors the
    strategy ``GeminiJudgmentModel``: lazy SDK client, key read from the env, and
    **fail-safe** (a missing key, missing SDK, or any API error falls back to the
    deterministic template, so the pipeline never breaks). The compliance gate remains
    the sole authority over what may send.
    """

    name = "gemini-3-pro"

    def __init__(self, *, model_name: str | None = None, client=None) -> None:
        load_dotenv()  # surface a .env-provided key to the SDK
        self._model_name = gemini_model_name(model_name)
        self._client = client  # injectable for tests; created lazily otherwise

    def _get_client(self):
        if self._client is None:
            from google import genai  # lazy import: the SDK is an optional extra

            self._client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY
        return self._client

    def generate(self, prompt: DraftPrompt) -> str:
        if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
            return prompt.safe_fallback()  # no key -> deterministic, never call out
        try:
            response = self._get_client().models.generate_content(
                model=self._model_name,
                contents=prompt.as_model_input(),  # instructions + guardrails baked in
                config={"temperature": 0.6},
            )
            return (getattr(response, "text", "") or "").strip() or prompt.safe_fallback()
        except Exception:
            return prompt.safe_fallback()  # fail-safe: never break the pipeline
