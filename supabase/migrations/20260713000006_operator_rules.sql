create type rule_scope as enum ('strategy', 'compliance');
create type rule_directive as enum ('always_escalate', 'force_skip', 'force_hold', 'soften_tone', 'waive');

-- Durable operator guardrails (settl/governance/rules.py). A directive can only ever
-- tighten the engine (ALWAYS_ESCALATE/FORCE_SKIP/FORCE_HOLD/SOFTEN_TONE) or WAIVE a
-- soft, non-legal rule - never turn a hard "don't send" into a send. Applied by
-- governance/apply.py at the strategy agent and the compliance gate only, never in a
-- route or component.
create table if not exists operator_rules (
  rule_id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  scope rule_scope not null,
  directive rule_directive not null,
  criteria jsonb not null default '{}'::jsonb,
  waive_code text,
  reason text not null default '',
  factors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operator_rules_tenant_idx on operator_rules (tenant_id, created_at desc);

comment on table operator_rules is 'Durable per-tenant guardrails an operator left after flagging a decision (SCHEMA.md, governance/rules.py).';
