"""Customer-voice grounding seam (Vertex AI Search).

DESIGN §3 grounds drafting in the customer's own past messages / brand voice via
Vertex AI Search. We define the seam now and ship a no-op default so the drafting
agent runs fully offline with no index, no key, no cost — exactly mirroring the
``model.py`` and orchestrator ``runtime.py`` pattern.

``NoOpGrounding`` returns empty context (the prompt then carries no voice block).
``VertexSearchGrounding`` is a 🔌 skeleton: DO NOT hand-code the SDK from memory —
wire it against current official Vertex AI Search docs (context7) once the GCP
project and a customer data store exist. Grounding only *informs* the draft; it is
never a safety authority and never touches the compliance gate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from settl.schema.invoice import Invoice


@dataclass(frozen=True)
class VoiceContext:
    """Retrieved voice/context snippets to match the customer's tone."""

    snippets: list[str] = field(default_factory=list)
    tone_hint: str | None = None

    @property
    def is_empty(self) -> bool:
        return not self.snippets and not self.tone_hint

    def as_prompt_block(self) -> str:
        """Render the context as a prompt fragment (empty string when ungrounded)."""
        if self.is_empty:
            return ""
        parts = list(self.snippets)
        if self.tone_hint:
            parts.append(f"Preferred tone: {self.tone_hint}")
        return "\n".join(f"- {p}" for p in parts)


@runtime_checkable
class Grounding(Protocol):
    def lookup(self, invoice: Invoice) -> VoiceContext:
        """Return voice/context for this invoice's debtor; empty if none."""
        ...


class NoOpGrounding:
    """Default grounding: no retrieval, empty context. Offline, no cost."""

    def lookup(self, invoice: Invoice) -> VoiceContext:
        return VoiceContext()


class StaticVoiceGrounding:
    """Grounding from a tenant's configured voice (no retrieval, offline).

    Carries the vendor's ``voice.voice_block`` (and optional tone hint) from their
    ``TenantConfig`` into the draft prompt - the simplest way per-tenant voice flows
    through, until ``VertexSearchGrounding`` does real retrieval."""

    def __init__(self, voice_block: str = "", tone_hint: str | None = None) -> None:
        self._voice_block = voice_block
        self._tone_hint = tone_hint

    def lookup(self, invoice: Invoice) -> VoiceContext:
        snippets = [self._voice_block] if self._voice_block.strip() else []
        return VoiceContext(snippets=snippets, tone_hint=self._tone_hint)


class VertexSearchGrounding:
    """🔌 Live Vertex AI Search grounding. Skeleton only.

    Implement ``lookup`` against current official Vertex AI Search docs (context7)
    once a customer data store is configured. Kept isolated so the live retrieval is
    a single swappable component.
    """

    def __init__(self, *, data_store: str | None = None, client=None) -> None:
        self._data_store = data_store
        self._client = client

    def lookup(self, invoice: Invoice) -> VoiceContext:
        raise NotImplementedError(
            "VertexSearchGrounding is a seam: wire the real Vertex AI Search query "
            "against current official docs (context7) once GCP is configured."
        )
