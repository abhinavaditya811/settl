"""Durable mirror of the execution log (CLAUDE.md: logging is required, not
optional - this is the audit trail / sales proof / submission evidence).

Same swap-at-the-seam pattern as AgentEngineSink: a LogSink that never breaks the
pipeline. ExecutionLog.clear() wipes the in-memory list (what the dashboard's
Activity tab reads) on every refresh() so a re-run doesn't double-count; this
sink is unaffected by that - the Postgres table is the full historical record
across every refresh/restart, by design.

A LogEntry carries only invoice_id, not tenant_id, so the sink is given a lookup
callback to resolve one from the other (BoardState's own _invoices map). An
entry whose invoice_id doesn't resolve to a known tenant (e.g. "-" placeholders
for unmatched webhooks) is skipped, not guessed - same fail-safe posture as
every other durable mirror in this codebase.
"""

from __future__ import annotations

from typing import Callable, TYPE_CHECKING

from settl.data.supabase.connection import connect, to_jsonb

if TYPE_CHECKING:
    from settl.audit.execution_log import LogEntry

_INSERT_SQL = """
    insert into execution_log (tenant_id, invoice_id, agent, decision, reasoning, details, occurred_at)
    values (%(tenant_id)s, %(invoice_id)s, %(agent)s, %(decision)s, %(reasoning)s, %(details)s, %(occurred_at)s)
"""


class PostgresLogSink:
    def __init__(self, tenant_of: Callable[[str], str | None]) -> None:
        self._tenant_of = tenant_of

    def write(self, entry: "LogEntry") -> None:
        tenant_id = self._tenant_of(entry.invoice_id)
        if not tenant_id:
            return  # unresolvable tenant (e.g. an unmatched webhook) - skip, never guess
        with connect() as conn:
            conn.execute(
                _INSERT_SQL,
                {
                    "tenant_id": tenant_id,
                    "invoice_id": entry.invoice_id,
                    "agent": entry.agent,
                    "decision": entry.decision,
                    "reasoning": entry.reasoning,
                    "details": to_jsonb(entry.details),
                    "occurred_at": entry.timestamp,
                },
            )
