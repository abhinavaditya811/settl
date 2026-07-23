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

write() is called once per agent decision - dozens to hundreds of times in a
single refresh() batch. Opening a fresh connection (a TLS handshake to remote
Supabase) per call turned refresh() into a multi-minute operation once tenant
data grew past a handful of invoices, which meant every Cloud Run cold start
paid it too. This sink holds one connection for its own process lifetime
instead, reconnecting only if it's dropped.
"""

from __future__ import annotations

from typing import Callable, TYPE_CHECKING

import psycopg

from settl.data.supabase.connection import connect, open_connection, to_jsonb

if TYPE_CHECKING:
    from settl.audit.execution_log import LogEntry

_SELECT_SQL = """
    select agent, decision, reasoning, details, occurred_at
    from execution_log
    where tenant_id = %(tenant_id)s and invoice_id = %(invoice_id)s
    order by occurred_at asc
"""


def load_execution_log(tenant_id: str, invoice_id: str) -> list["LogEntry"]:
    """The FULL durable decision history for one invoice, oldest first - the
    lifetime record the in-memory log can't give (it clear()s on every refresh).
    The per-invoice timeline reads this so it shows the invoice's whole story
    (sent, replied, paid) and survives restarts, instead of just the latest run."""
    from settl.audit.execution_log import LogEntry

    with connect() as conn:
        rows = conn.execute(
            _SELECT_SQL, {"tenant_id": tenant_id, "invoice_id": invoice_id}
        ).fetchall()
    return [
        LogEntry(
            timestamp=r["occurred_at"].isoformat() if hasattr(r["occurred_at"], "isoformat") else str(r["occurred_at"]),
            invoice_id=invoice_id,
            agent=r["agent"],
            decision=r["decision"],
            reasoning=r["reasoning"],
            details=r["details"] or {},
        )
        for r in rows
    ]


_INSERT_SQL = """
    insert into execution_log (tenant_id, invoice_id, agent, decision, reasoning, details, occurred_at)
    values (%(tenant_id)s, %(invoice_id)s, %(agent)s, %(decision)s, %(reasoning)s, %(details)s, %(occurred_at)s)
"""


class PostgresLogSink:
    def __init__(self, tenant_of: Callable[[str], str | None]) -> None:
        self._tenant_of = tenant_of
        self._conn: psycopg.Connection | None = None

    def _connection(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = open_connection()
        return self._conn

    def write(self, entry: "LogEntry") -> None:
        tenant_id = self._tenant_of(entry.invoice_id)
        if not tenant_id:
            return  # unresolvable tenant (e.g. an unmatched webhook) - skip, never guess
        params = {
            "tenant_id": tenant_id,
            "invoice_id": entry.invoice_id,
            "agent": entry.agent,
            "decision": entry.decision,
            "reasoning": entry.reasoning,
            "details": to_jsonb(entry.details),
            "occurred_at": entry.timestamp,
        }
        try:
            self._connection().execute(_INSERT_SQL, params)
        except psycopg.OperationalError:
            # connection dropped (e.g. idle timeout) - reconnect once and retry
            self._conn = open_connection()
            self._conn.execute(_INSERT_SQL, params)
