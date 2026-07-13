create type contact_direction as enum ('outbound', 'inbound');
create type contact_channel as enum ('email', 'sms', 'voice');

-- Backs Invoice.prior_contacts (SCHEMA.md §2). Full message bodies are never stored
-- here - only a summary + audit_ref pointing at the single copy kept in
-- execution_log/the evidence bundle, so there is one source of truth for content.
create table if not exists contacts (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  invoice_id text not null references invoices(invoice_id) on delete cascade,
  direction contact_direction not null,
  channel contact_channel not null,
  occurred_at timestamptz not null default now(),
  provider_message_id text,
  in_reply_to text,
  thread_ref text,
  classification text,
  summary text not null default '',
  audit_ref text,
  created_at timestamptz not null default now()
);

create index if not exists contacts_invoice_idx on contacts (tenant_id, invoice_id, occurred_at desc);

comment on table contacts is 'Every touch, both directions - hydrated into Invoice.prior_contacts (SCHEMA.md §2).';
