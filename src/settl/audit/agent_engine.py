"""🔌 Agent Engine sink - mirror execution-log entries to Google Cloud observability.

Agent Engine (Vertex AI) surfaces an agent's decision trail through **structured Cloud
Logging** entries (verified against current Google Cloud docs, not coded from memory:
docs.cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/manage/logging). This sink
emits each ``LogEntry`` via ``log_struct`` under a named log, so a synthetic or real run
shows up alongside the reasoning-engine logs and in the Agent Engine traces dashboard.

Deferred seam, same shape as ``orchestrator/runtime.py`` / ``GeminiJudgmentModel`` /
``StripeLinkMinter``:
  * **opt-in** via ``SETTL_USE_AGENT_ENGINE=1`` (so a plain run/test never calls out),
  * **lazy-imports** the optional ``google-cloud-logging`` SDK,
  * **injectable client** for tests,
  * **fail-safe** - no SDK, no creds, or any API error is swallowed. The in-memory + JSONL
    log stays the source of truth; this is an additional durable mirror, never a gate.
"""

from __future__ import annotations

import os
from dataclasses import asdict
from typing import TYPE_CHECKING

from settl.config import load_dotenv

if TYPE_CHECKING:
    from settl.audit.execution_log import LogEntry

DEFAULT_LOG_NAME = "settl-execution-log"


def agent_engine_enabled() -> bool:
    """Opt-in (SETTL_USE_AGENT_ENGINE=1) - mirrors SETTL_USE_STRIPE / SETTL_USE_GEMINI, so
    the board and the test suite never emit cloud logs just because creds sit in the env."""
    return os.environ.get("SETTL_USE_AGENT_ENGINE") == "1"


class AgentEngineSink:
    """A ``LogSink`` that writes structured entries to Google Cloud Logging."""

    def __init__(self, *, client=None, log_name: str = DEFAULT_LOG_NAME, labels: dict | None = None) -> None:
        load_dotenv()  # surface GOOGLE_CLOUD_PROJECT / creds from .env to the SDK
        self._client = client  # injectable for tests; created lazily otherwise
        self._log_name = log_name
        self._labels = labels or {}
        self._logger = None

    def _get_logger(self):
        if self._logger is None:
            if self._client is None:
                import google.cloud.logging  # lazy: the SDK is an optional extra

                self._client = google.cloud.logging.Client()
            self._logger = self._client.logger(self._log_name)
        return self._logger

    def write(self, entry: LogEntry) -> None:
        try:
            self._get_logger().log_struct(
                asdict(entry),
                severity="INFO",
                labels={"invoice_id": entry.invoice_id, "agent": entry.agent, **self._labels},
            )
        except Exception:
            return  # fail-safe: cloud logging can never break the local pipeline
