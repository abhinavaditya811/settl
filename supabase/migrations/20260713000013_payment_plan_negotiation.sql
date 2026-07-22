-- The debtor's response to an offered plan (SCHEMA.md §8's one non-binding
-- negotiation round, agents/payment_plan/negotiate.py::read_response) - surfaced
-- on the plan itself so the vendor sees it BEFORE deciding, instead of only in the
-- execution log where a UI blindly showing Approve/Reject could miss it (an
-- observed gap: the vendor could approve terms the debtor already said they
-- didn't want). Cleared back to null on a fresh offer/reoffer - it's a "since the
-- last offer" signal, not cumulative history (the log/contacts already keep that).
alter table payment_plans
  add column if not exists negotiation_outcome text,
  add column if not exists requested_terms text;
