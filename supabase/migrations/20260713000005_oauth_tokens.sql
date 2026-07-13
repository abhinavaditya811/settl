-- SCHEMA.md §4. The single auditable boundary holding each vendor's most sensitive
-- credentials. encrypted_refresh_token is app-key encrypted at rest (env now, KMS
-- later) - never logged, never returned to the browser. tenant_config.identity's
-- oauth_token_ref / payments.stripe_connection_ref point here by id; the plaintext
-- token itself never enters the config object agents pass around.
create table if not exists oauth_tokens (
  id text primary key default gen_random_uuid()::text,
  tenant_id text not null references tenants(id) on delete cascade,
  provider text not null check (provider in ('google', 'stripe')),
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

comment on table oauth_tokens is 'Encrypted-at-rest OAuth refresh tokens, one per tenant+provider (SCHEMA.md §4).';
