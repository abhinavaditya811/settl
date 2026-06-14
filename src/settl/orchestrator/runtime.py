"""🔌 Runtime seam for the orchestrator's routing brain (Gemini 3 Flash via ADK).

DESIGN §3 maps the *orchestrator* to Gemini 3 Flash — fast, high-volume "is this
actionable / what's next" routing. We keep that wiring isolated behind this
interface so the spine (``pipeline.py``) stays pure and testable offline, and so
the live SDK call is a single swappable component.

Per CLAUDE.md build order ("decision core first, plumbing last") and the note that
the Google Cloud / Gemini SDK surface moves fast, we ship a deterministic
``NoOpRuntime`` default now and DO NOT hand-code the ADK call from memory. When the
GCP project is set up, implement ``GeminiFlashRuntime`` against the current official
ADK docs (context7) — it must only *order/triage* work, never decide safety: the
deterministic policy and the compliance gate remain the authorities.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from settl.schema.invoice import Invoice


@runtime_checkable
class OrchestratorRuntime(Protocol):
    def triage(self, invoices: list[Invoice]) -> list[Invoice]:
        """Return the invoices in the order they should be processed. Triage only —
        it may reorder/prioritise, never drop or decide an outcome."""
        ...


class NoOpRuntime:
    """Default runtime: process invoices in the order given. No SDK, no cost."""

    def triage(self, invoices: list[Invoice]) -> list[Invoice]:
        return list(invoices)
