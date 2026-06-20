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

from typing import Protocol, runtime_checkable

from settl.agents.drafting.prompt import DraftPrompt


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
    """🔌 Live Gemini 3 Pro generation. Skeleton only.

    Implement ``generate`` against current official ADK/Vertex/Gemini docs
    (context7) once GCP is configured: feed ``prompt.as_model_input()`` to Gemini 3
    Pro and return the message body. The compliance gate remains the sole authority
    over what may send — never relax a gate rule to accommodate model output.
    """

    name = "gemini-3-pro"

    def __init__(self, *, model_name: str = "gemini-3-pro", client=None) -> None:
        self._model_name = model_name
        self._client = client

    def generate(self, prompt: DraftPrompt) -> str:
        raise NotImplementedError(
            "GeminiDraftModel is a seam: wire the real Gemini 3 Pro call against "
            "current official docs (context7) once GCP is configured. Use "
            "prompt.as_model_input() as the request and return only the message body."
        )
