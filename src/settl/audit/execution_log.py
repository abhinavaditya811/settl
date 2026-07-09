"""Structured execution log.

CLAUDE.md treats logging as required, not optional: every agent decision is
recorded with its reasoning. The in-memory list is the source of truth the dashboard
reads; durable persistence is delegated to swappable ``LogSink``s (``sink.py``): local
JSONL by default (offline/test), the Agent Engine sink (``agent_engine.py``) for cloud
observability. The shape is intentionally flat and serializable so it doubles as audit
trail, sales proof, and submission evidence (exported by ``export.py``).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from settl.audit.sink import JsonlSink, LogSink


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    invoice_id: str
    agent: str  # "strategy" | "compliance_gate" | "sender" | ...
    decision: str  # short machine-readable outcome
    reasoning: str  # human-readable why
    details: dict[str, Any] = field(default_factory=dict)


class ExecutionLog:
    """Append-only log. Mirrors each entry to any attached ``LogSink`` (JSONL by
    default when ``jsonl_path`` is given, plus any injected ``sinks``)."""

    def __init__(
        self,
        jsonl_path: str | Path | None = None,
        *,
        sinks: list[LogSink] | None = None,
    ) -> None:
        self._entries: list[LogEntry] = []
        self._sinks: list[LogSink] = []
        if jsonl_path is not None:
            self._sinks.append(JsonlSink(jsonl_path))
        if sinks:
            self._sinks.extend(sinks)

    def add_sink(self, sink: LogSink) -> None:
        """Attach another durable target (e.g. the Agent Engine sink) at runtime."""
        self._sinks.append(sink)

    def record(
        self,
        *,
        invoice_id: str,
        agent: str,
        decision: str,
        reasoning: str,
        **details: Any,
    ) -> LogEntry:
        entry = LogEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            invoice_id=invoice_id,
            agent=agent,
            decision=decision,
            reasoning=reasoning,
            details=details,
        )
        self._entries.append(entry)  # in-memory is the source of truth, always recorded
        for sink in self._sinks:
            try:
                sink.write(entry)
            except Exception:
                pass  # a durable mirror is best-effort; never let it break the pipeline
        return entry

    @property
    def entries(self) -> list[LogEntry]:
        return list(self._entries)

    def clear(self) -> None:
        """Drop in-memory entries (the JSONL file, if any, is left intact). Used
        when a run is re-executed so the live activity feed doesn't double-count."""
        self._entries.clear()

    def for_invoice(self, invoice_id: str) -> list[LogEntry]:
        return [e for e in self._entries if e.invoice_id == invoice_id]

    def to_json(self) -> str:
        return json.dumps([asdict(e) for e in self._entries], indent=2)
