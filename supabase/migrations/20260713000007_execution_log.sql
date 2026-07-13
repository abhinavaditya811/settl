-- The audit trail CLAUDE.md requires as non-optional: every agent decision, with its
-- reasoning (audit trail, sales proof, hackathon submission evidence). Append-only -
-- rows are never updated or deleted by the app. Backs the dashboard's Activity view
-- and the per-invoice trace drawer.
create table if not exists execution_log (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  invoice_id text references invoices(invoice_id) on delete set null,
  agent text not null,
  decision text not null,
  reasoning text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists execution_log_invoice_idx on execution_log (tenant_id, invoice_id, occurred_at desc);
create index if not exists execution_log_tenant_idx on execution_log (tenant_id, occurred_at desc);

comment on table execution_log is 'Append-only agent decision trail - every entry carries its reasoning (CLAUDE.md).';
