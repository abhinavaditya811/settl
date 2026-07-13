-- One row per tenant (SCHEMA.md §3). Each slice mirrors the Python TenantConfig
-- dataclasses (Identity/Payments/Voice/Audio/Policy - settl/tenancy/config.py) 1:1 as
-- jsonb, so the app layer keeps merging "global defaults + tenant override" without a
-- column per field. Slices never carry plaintext secrets - only refs
-- (oauth_token_ref, stripe_connection_ref) into oauth_tokens.
create table if not exists tenant_config (
  tenant_id text primary key references tenants(id) on delete cascade,
  identity jsonb not null default '{}'::jsonb,
  payments jsonb not null default '{}'::jsonb,
  voice jsonb not null default '{}'::jsonb,
  audio jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table tenant_config is 'Per-tenant identity/payments/voice/audio/policy overrides (SCHEMA.md §3).';
