-- Needed for gen_random_uuid() used as the default id generator throughout.
create extension if not exists pgcrypto;

-- Root of tenant isolation (SCHEMA.md §6: "tenant_id on every row"). One row per
-- signed-in vendor. id is text, not native uuid, so synthetic/demo tenants can keep
-- their existing human-readable slugs (e.g. "t_brightwork") while real sign-ups get
-- a generated id - every other table's tenant_id is a text FK into this table.
-- google_sub is the stable OAuth subject NextAuth sees on Google sign-in.
create table if not exists tenants (
  id text primary key default gen_random_uuid()::text,
  google_sub text unique,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table tenants is 'One row per vendor (tenant). FK target for every other table (SCHEMA.md §6).';
