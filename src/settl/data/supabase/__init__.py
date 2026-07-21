"""Supabase Postgres persistence (SCHEMA.md, FR-5). Opt-in via SETTL_USE_SUPABASE=1
+ SUPABASE_DB_URL - see connection.supabase_enabled(). Off by default: a plain
run or the test suite never touches the network, same as every other optional
integration in this codebase (Stripe, Gemini, Agent Engine)."""

from settl.data.supabase.connection import supabase_enabled
from settl.data.supabase.contacts_store import write_contact
from settl.data.supabase.execution_log_sink import PostgresLogSink
from settl.data.supabase.guardrails import insert_rule, load_rules
from settl.data.supabase.ingest import insert_invoices
from settl.data.supabase.invoices import load_invoices
from settl.data.supabase.payment_events_store import load_events, upsert_event
from settl.data.supabase.tenant_store import get_or_create_tenant

__all__ = [
    "supabase_enabled",
    "load_invoices",
    "load_rules",
    "insert_rule",
    "load_events",
    "upsert_event",
    "write_contact",
    "PostgresLogSink",
    "get_or_create_tenant",
    "insert_invoices",
]
