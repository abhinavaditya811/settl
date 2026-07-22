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


# Steps that are REAL EVENTS - a thing that actually happened at a point in time,
# not a re-derivable state. Every occurrence is kept, even if byte-identical to an
# earlier one (two real sends can share the exact reasoning text "emailed INV-1 via
# Gmail SMTP" with no date/content in it - a global dedup once silently hid the
# second, real send). Matched by agent (any decision) or by exact (agent, decision).
_EVENT_AGENTS = frozenset({"inbound_classifier", "operator_flag", "payment_plan_negotiate"})
_EVENT_STEPS = frozenset({
    ("email_sender", "sent"), ("sms_sender", "sent"), ("sender", "sent"),
    ("human_approval", "approved"),
    ("reconcile", "paid"), ("reconcile", "partial"), ("reconcile", "disputed"),
})


def _is_event(e: LogEntry) -> bool:
    return e.agent in _EVENT_AGENTS or (e.agent, e.decision) in _EVENT_STEPS


def deduped_entries(entries: list[LogEntry]) -> list[LogEntry]:
    """Keep every real EVENT (send, approval, reply classification, payment - the
    invoice's actual story); collapse identical re-derivable STATE steps (ingestion,
    strategy, gate re-checks, a withhold) to one, however far apart they are.

    The durable log is append-only, and every server restart / refresh re-runs the
    full pipeline (run_batch) and re-logs the same ingestion/strategy/gate steps -
    so an invoice sitting in "hold" accumulates one identical [ingestion, strategy]
    pair per restart. Those are re-computations of an unchanged state, not new
    events; deduping them globally by (agent, decision, reasoning) removes the
    noise. Events are NEVER deduped, so two genuinely separate sends that happen
    to share identical reasoning both survive (an earlier global-dedup bug hid the
    second one)."""
    seen: set[tuple[str, str, str]] = set()
    out: list[LogEntry] = []
    for e in entries:
        if _is_event(e):
            out.append(e)
            continue
        key = (e.agent, e.decision, e.reasoning)
        if key in seen:
            continue
        seen.add(key)
        out.append(e)
    return out


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
