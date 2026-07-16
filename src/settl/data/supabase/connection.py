"""Connection helper for the Supabase Postgres store (SCHEMA.md, FR-5).

Opt-in (SETTL_USE_SUPABASE=1 + SUPABASE_DB_URL), same fail-safe/off-by-default
pattern as SETTL_USE_STRIPE / SETTL_USE_GEMINI / SETTL_USE_AGENT_ENGINE - a plain
run or the test suite never touches the network. The engine connects with the
project's direct Postgres credentials (not the anon/service_role REST keys) and
is the ONLY caller; RLS on every table (supabase/migrations/..._rls_lockdown.sql)
is a defense-in-depth backstop, not the access path.

Short-lived connections, opened per call and closed via the context manager -
this is a single-instance demo engine, not high-throughput, so a pool is
premature (YAGNI). The one exception is `PostgresLogSink`, which writes one
row per agent decision (dozens-hundreds per `refresh()`) - `open_connection()`
below hands it a single raw connection to hold for its own lifetime instead of
paying a fresh TLS handshake per row.
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from settl.config import load_dotenv


def supabase_enabled() -> bool:
    """True only when explicitly armed AND a connection string is present."""
    load_dotenv()
    return os.environ.get("SETTL_USE_SUPABASE") == "1" and bool(
        os.environ.get("SUPABASE_DB_URL")
    )


@contextmanager
def connect() -> Iterator[psycopg.Connection]:
    """A connection with dict-row results (``row["col"]`` instead of tuples).

    Raises if SUPABASE_DB_URL is unset - callers must check ``supabase_enabled()``
    first; this never silently falls back (that would mask a real misconfiguration).
    """
    load_dotenv()
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("SUPABASE_DB_URL is not set")
    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        yield conn


def open_connection() -> psycopg.Connection:
    """A raw, caller-owned connection - not a context manager, doesn't auto-close.

    For callers that hold a connection across many calls (see module docstring)
    instead of one-per-call. Autocommit is on since there's no multi-statement
    transaction to batch - each caller writes one row at a time.
    """
    load_dotenv()
    dsn = os.environ.get("SUPABASE_DB_URL")
    if not dsn:
        raise RuntimeError("SUPABASE_DB_URL is not set")
    conn = psycopg.connect(dsn, row_factory=dict_row)
    conn.autocommit = True
    return conn


def to_jsonb(value: dict) -> Jsonb:
    """Wrap a dict so psycopg writes it as jsonb (plain dicts aren't auto-adapted
    on the write path - only reads come back as native dict/list automatically)."""
    return Jsonb(value)
