create type payment_event_kind as enum ('payment', 'refund', 'dispute', 'reply');

-- Canonical money events (SCHEMA.md §5, settl/agents/reconcile/events.py). Reconcile
-- re-derives net paid over the FULL event log every run - it never trusts
-- invoice.status - so a refund/dispute reverses automatically with no stateful
-- "un-pay" code. `reference` is the processor id (payment_intent/charge/dispute) and
-- the dedup key: a poll and a webhook that see the same money must record it once.
create table if not exists payment_events (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  invoice_id text not null references invoices(invoice_id) on delete cascade,
  kind payment_event_kind not null default 'payment',
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  occurred_on date not null,
  source text not null default 'manual' check (source in ('manual', 'stripe', 'synthetic', 'webhook')),
  reference text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists payment_events_invoice_idx on payment_events (tenant_id, invoice_id);

-- Dedup key only enforced when a real processor reference exists ("manual" events
-- may share/omit one).
create unique index if not exists payment_events_reference_uniq
  on payment_events (tenant_id, reference)
  where reference <> '';

comment on table payment_events is 'Normalized payment/refund/dispute/reply events reconcile re-derives net-paid from (SCHEMA.md §5).';
