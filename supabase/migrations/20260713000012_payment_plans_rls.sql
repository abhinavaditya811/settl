-- Same defense-in-depth posture as 20260713000009_rls_lockdown.sql, appended
-- separately (migrations are append-only here) rather than editing that file:
-- RLS enabled with NO policies, so the anon/authenticated PostgREST roles get
-- nothing on payment_plans either. The FastAPI engine (service_role) is
-- unaffected and remains the only caller.
alter table payment_plans enable row level security;
