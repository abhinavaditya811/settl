"""Log sinks: the swappable durable target an ExecutionLog mirrors each entry to.

``ExecutionLog`` keeps the in-memory list (the hot path the dashboard reads); a ``LogSink``
is where each entry is *also* persisted. Dependency injection keeps the local JSONL file as
the offline/test default and lets the Agent Engine sink (``agent_engine.py``) plug in for
cloud observability without touching any agent - the same normalize-at-the-edge / swap-at-
the-seam pattern the rest of the engine uses.

``LogEntry`` is imported only under ``TYPE_CHECKING`` so this module never imports
``execution_log`` at runtime (which imports this one) - no circular import.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import TYPE_CHECKING, Protocol, runtime_checkable

if TYPE_CHECKING:
    from settl.audit.execution_log import LogEntry


@runtime_checkable
class LogSink(Protocol):
    """A durable target for execution-log entries. One method: persist one entry."""

    def write(self, entry: LogEntry) -> None: ...


class JsonlSink:
    """Append each entry as one JSON line to a local file - the offline/test default.

    This is exactly the persistence ``ExecutionLog`` used to do inline; extracting it
    behind ``LogSink`` is what lets an Agent Engine sink slot in beside (or instead of) it.
    """

    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)

    def write(self, entry: LogEntry) -> None:
        with self._path.open("a") as fh:
            fh.write(json.dumps(asdict(entry)) + "\n")
