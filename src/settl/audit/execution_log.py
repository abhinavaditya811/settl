"""Structured execution log.

CLAUDE.md treats logging as required, not optional: every agent decision is
recorded with its reasoning. This in-memory + JSONL implementation is the local
stand-in for Agent Engine observability (wired later). The shape is intentionally
flat and serializable so it doubles as audit trail, sales proof, and submission
evidence.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    invoice_id: str
    agent: str  # "strategy" | "compliance_gate" | "sender" | ...
    decision: str  # short machine-readable outcome
    reasoning: str  # human-readable why
    details: dict[str, Any] = field(default_factory=dict)


class ExecutionLog:
    """Append-only log. Optionally mirrors entries to a JSONL file."""

    def __init__(self, jsonl_path: str | Path | None = None) -> None:
        self._entries: list[LogEntry] = []
        self._jsonl_path = Path(jsonl_path) if jsonl_path else None

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
        self._entries.append(entry)
        if self._jsonl_path is not None:
            with self._jsonl_path.open("a") as fh:
                fh.write(json.dumps(asdict(entry)) + "\n")
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
