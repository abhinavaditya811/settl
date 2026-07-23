create type payment_plan_status as enum ('proposed', 'approved', 'rejected', 'active', 'broken', 'completed');
create type payment_plan_source as enum ('template', 'negotiated');

-- Tenant-opt-in installment payment plans, one per invoice (SCHEMA.md §8). The AI
-- never unilaterally commits the vendor to modified debt terms: status only
-- reaches 'approved'/'active' via the vendor's explicit decide action
-- (decided_by set), re-running the compliance gate the same as
-- Orchestrator.approve_and_send. `installments` is the durable, explicit
-- schedule (jsonb array of {index, amount, due_date, payment_link, paid_at}) -
-- Invoice.due_date is singular and can't represent multiple installment dates.
create table if not exists payment_plans (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  invoice_id text not null references invoices(invoice_id) on delete cascade,
  status payment_plan_status not null default 'proposed',
  installments jsonb not null default '[]'::jsonb,
  source payment_plan_source not null default 'template',
  template_ref text,
  -- Template offers made to the debtor so far (SCHEMA.md §8: capped at 3 before
  -- mandatory human handoff).
  offer_count integer not null default 1 check (offer_count >= 0 and offer_count <= 3),
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  contact_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_plans_invoice_idx on payment_plans (tenant_id, invoice_id);

comment on table payment_plans is 'Tenant-opt-in installment payment plans, one per invoice, vendor-approved before anything is confirmed to the debtor (SCHEMA.md §8).';
