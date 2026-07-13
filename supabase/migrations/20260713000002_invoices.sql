create type invoice_source as enum ('stripe', 'csv', 'quickbooks', 'pdf');
create type invoice_status as enum ('open', 'paid', 'partial', 'disputed');

-- Canonical Invoice (CLAUDE.md / SCHEMA.md §1). Deliberately does NOT store
-- as_of_date or days_overdue - both are computed at hydration time in the app layer
-- so overdue-ness is always live, never a stale snapshot (SCHEMA.md §6). invoice_id
-- is text (not native uuid) to preserve existing human-readable ids like "INV-001".
create table if not exists invoices (
  invoice_id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  source invoice_source not null,
  source_ref text not null,
  amount_due numeric(14, 2) not null check (amount_due >= 0),
  currency text not null default 'USD',
  issue_date date not null,
  due_date date not null,
  status invoice_status not null default 'open',
  debtor_name text not null,
  debtor_email text,
  debtor_phone text,
  is_b2b boolean not null,
  late_fee_allowed boolean not null default false,
  payment_link text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, source, source_ref)
);

create index if not exists invoices_tenant_idx on invoices (tenant_id, due_date);

-- Deliberately NO contact-method (or other completeness) check constraint here.
-- Validate + quarantine (SCHEMA.md §6, settl/schema/validation.py) is a RUNTIME
-- pipeline step, not a storage-layer gate: a malformed row must still land in this
-- table so the orchestrator can quarantine it and surface a reason to a human
-- ("couldn't read this invoice") - a raw DB constraint violation would silently
-- swallow exactly the rows that step exists to explain.
comment on table invoices is 'Every ingested invoice, including malformed ones - the orchestrator quarantines those at runtime (SCHEMA.md §6, schema/validation.py), it is not enforced here.';
