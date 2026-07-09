"""Evidence export: turn the execution log into a portable, round-trippable bundle.

The hackathon submission requires the agent-execution logs as proof (CLAUDE.md treats the
audit trail as evidence), and sales needs a clean per-invoice decision trail. This turns a
run's ``LogEntry`` list into one self-describing JSON document: run-level counts (entries
by agent, by decision) plus the full trail grouped by invoice and flat. Pure and
deterministic given the entries + a timestamp - no SDK, unit-testable offline, and it
round-trips (write → load yields the same bundle).
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from settl.audit.execution_log import LogEntry

EVIDENCE_VERSION = 1


def evidence_bundle(entries: list[LogEntry], *, generated_at: str | None = None) -> dict:
    """Build the evidence document from a run's log entries.

    ``generated_at`` is injectable so tests are deterministic; defaults to now (UTC).
    """
    stamp = generated_at or datetime.now(timezone.utc).isoformat()
    dicts = [asdict(e) for e in entries]

    by_invoice: dict[str, list] = {}
    for d in dicts:
        by_invoice.setdefault(d["invoice_id"], []).append(d)

    return {
        "version": EVIDENCE_VERSION,
        "generated_at": stamp,
        "entry_count": len(dicts),
        "invoice_count": len(by_invoice),
        "agents": dict(Counter(d["agent"] for d in dicts)),
        "decisions": dict(Counter(d["decision"] for d in dicts)),
        "by_invoice": by_invoice,
        "entries": dicts,
    }


def write_evidence(
    entries: list[LogEntry], path: str | Path, *, generated_at: str | None = None
) -> Path:
    """Write the evidence bundle to ``path`` as pretty JSON. Returns the path written."""
    bundle = evidence_bundle(entries, generated_at=generated_at)
    p = Path(path)
    p.write_text(json.dumps(bundle, indent=2))
    return p


def load_evidence(path: str | Path) -> dict:
    """Load a previously-exported evidence bundle (the round-trip of ``write_evidence``)."""
    return json.loads(Path(path).read_text())
