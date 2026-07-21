"""🔌 Generation-model seam for reply drafting (Gemini 3 Pro).

Replying is judgment (composing a response), not routing - CLAUDE.md maps that to
Gemini 3 Pro, same as the chase drafting agent. Mirrors model.py's shape exactly.
"""

from __future__ import annotations

import os
from typing import Protocol, runtime_checkable

from settl.agents.drafting.reply_prompt import ReplyPrompt
from settl.config import gemini_model_name, load_dotenv


@runtime_checkable
class ReplyModel(Protocol):
    name: str

    def generate(self, prompt: ReplyPrompt) -> str:
        """Return the candidate reply body for the given prompt."""
        ...


class NoOpReplyModel:
    """Default model: the prompt's deterministic, compliant fallback."""

    name = "template"

    def generate(self, prompt: ReplyPrompt) -> str:
        return prompt.safe_fallback()


class GeminiReplyModel:
    """🔌 Live Gemini generation for replies. Fail-safe: a missing key, missing SDK,
    or any API error falls back to the deterministic template."""

    name = "gemini-3-pro"

    def __init__(self, *, model_name: str | None = None, client=None) -> None:
        load_dotenv()
        self._model_name = gemini_model_name(model_name)
        self._client = client

    def _get_client(self):
        if self._client is None:
            from google import genai

            self._client = genai.Client()
        return self._client

    def generate(self, prompt: ReplyPrompt) -> str:
        if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
            return prompt.safe_fallback()
        try:
            response = self._get_client().models.generate_content(
                model=self._model_name,
                contents=prompt.as_model_input(),
                config={"temperature": 0.6},
            )
            return (getattr(response, "text", "") or "").strip() or prompt.safe_fallback()
        except Exception:
            return prompt.safe_fallback()
