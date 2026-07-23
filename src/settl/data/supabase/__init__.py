"""Supabase Postgres persistence (SCHEMA.md, FR-5). Opt-in via SETTL_USE_SUPABASE=1
+ SUPABASE_DB_URL - see connection.supabase_enabled(). Off by default: a plain
run or the test suite never touches the network, same as every other optional
integration in this codebase (Stripe, Gemini, Agent Engine)."""

from settl.data.supabase.connection import supabase_enabled
from settl.data.supabase.contacts_store import find_by_message_id, write_contact
from settl.data.supabase.execution_log_sink import PostgresLogSink, load_execution_log
from settl.data.supabase.guardrails import insert_rule, load_rules
from settl.data.supabase.ingest import insert_invoices
from settl.data.supabase.invoices import load_invoices
from settl.data.supabase.oauth_tokens_store import list_connected_tenants, load_token, upsert_token
from settl.data.supabase.payment_events_store import load_events, upsert_event
from settl.data.supabase.payment_plans_store import load_plans, upsert_plan
from settl.data.supabase.tenant_config_store import (
    load_policy_overrides,
    set_payment_plan_autonomy,
    set_payment_plan_templates,
)
from settl.data.supabase.tenant_store import get_or_create_tenant

__all__ = [
    "supabase_enabled",
    "load_invoices",
    "load_rules",
    "insert_rule",
    "load_events",
    "upsert_event",
    "write_contact",
    "find_by_message_id",
    "load_plans",
    "upsert_plan",
    "load_token",
    "upsert_token",
    "list_connected_tenants",
    "PostgresLogSink",
    "load_execution_log",
    "get_or_create_tenant",
    "insert_invoices",
    "load_policy_overrides",
    "set_payment_plan_templates",
    "set_payment_plan_autonomy",
]
