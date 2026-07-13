-- Defense-in-depth (SCHEMA.md §6): the FastAPI engine is the only caller, connects
-- with the Postgres service role, and already scopes every query by tenant_id at the
-- query layer - that query-layer scoping is the primary isolation mechanism. RLS here
-- is the backstop: enabling it with NO policies means the anon/authenticated
-- PostgREST roles (Supabase's public REST/JS-client surface) can read or write
-- nothing, even if a key ever leaked. The web dashboard must never talk to Supabase
-- directly - it only calls the FastAPI engine (CLAUDE.md: "the orchestrator,
-- compliance gate, and sender remain the sole authorities"). service_role bypasses
-- RLS by default, so the engine's own access is unaffected.
alter table tenants enable row level security;
alter table invoices enable row level security;
alter table contacts enable row level security;
alter table tenant_config enable row level security;
alter table oauth_tokens enable row level security;
alter table operator_rules enable row level security;
alter table execution_log enable row level security;
alter table payment_events enable row level security;
