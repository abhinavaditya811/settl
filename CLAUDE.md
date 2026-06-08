# CLAUDE.md — Settl

Settl is an autonomous outreach & recovery engine: an AI agent that gets freelancers and
small businesses paid by chasing overdue invoices — deciding timing, tone, and channel,
drafting in the customer's voice, clearing a compliance gate, sending, and reconciling the
outcome. We prove it on **collections**; the same engine later extends to grant outreach
(roadmap, not v1). Full reasoning, build sequence, and roadmap live in **DESIGN.md** — read
it for the *why*; this file is the *what* you must always follow.

## Architecture invariants (do not violate)

- Agents **never** see a raw invoice. Source data is normalized at the edge by a per-source
  **adapter** into the canonical `Invoice` schema below. All agents read only the canonical form.
- Adding a new source = a new adapter emitting canonical shape. **Never** special-case a source
  format inside orchestrator, strategy, drafting, or compliance logic. This boundary is what
  lets the engine later point at grants as a config change.
- The pipeline is: ingestion → orchestrator → strategy → drafting → **compliance gate** →
  (pass) sending / (flag) human review → reconcile → execution log → loop if unpaid.
- Every agent decision is written to the execution log with its reasoning (this is our audit
  trail, sales proof, and hackathon submission evidence — treat logging as required, not optional).

## Canonical Invoice schema

```
Invoice {
  invoice_id        // internal id
  source            // "stripe" | "csv" | "quickbooks" | "pdf"
  source_ref        // original id in that system
  amount_due        // normalized number
  currency
  issue_date        // ISO date
  due_date          // ISO date
  days_overdue      // COMPUTED by us, never trusted from source
  status            // "open" | "paid" | "partial" | "disputed" — verified, never trusted
  debtor_name
  debtor_contact    // email / phone
  is_b2b            // critical for the compliance gate
  late_fee_allowed  // from terms, drives strategy
  prior_contacts    // history of touches
  raw               // original blob, kept untouched
}
```

- **Recompute derived fields.** Always compute `days_overdue` from `due_date`; verify `status`
  against payment data before acting. Never chase someone who may have already paid.
- **Validate + quarantine.** After an adapter runs, validate completeness (due date, positive
  amount, contact method). Failures flag to a human ("couldn't read this invoice") — never guess.

## Compliance rules (NON-NEGOTIABLE — the compliance gate enforces these)

A message must be **blocked and escalated to a human** if it would:
- Make any legal threat ("we'll sue", "this goes to collections", "we'll report you").
- Claim a consequence the customer can't or won't carry out.
- Cross into anything resembling legal advice.
- Violate contact-frequency limits or configured tone bounds.
- Concern **consumer (non-B2B) debt** — we operate first-party + B2B only, to stay clear of
  FDCPA / debt-collector licensing. If `is_b2b` is false, escalate; do not send.
- Respond to a debtor who disputes the debt or requests a payment plan.

Additional hard rules:
- **Never custodial.** We never touch funds. Payment always flows through the customer's own
  processor via a link. Do not build anything that holds, routes, or settles money for us.
- **Human-in-the-loop (pilot mode):** the FIRST message to any new debtor requires one-tap
  human approval before sending. Later touches may go autonomous. Default to this behavior.

## Build conventions

- **Stack / Google Cloud:** Agent Builder + ADK for orchestration; Gemini 3 Flash for fast
  high-volume routing (orchestrator), Gemini 3 Pro for judgment (strategy, drafting); Agent
  Engine for execution logs/observability; Vertex AI Search for grounding in customer data.
- **Build order:** decision core first, plumbing last. Build + test the strategy agent and
  compliance gate against the **synthetic dataset** before wiring real integrations. Mock the
  sending agent (log "would send") until a real pilot is signed. Stripe + real email/SMS last.
- **Adapters for v1:** CSV (universal export, unblocks any pilot) and Stripe. PDF/QuickBooks = roadmap.
- Synthetic data is for building/testing logic ONLY — never for revenue or customer evidence.

## When working on SDK integrations

The Google Cloud / Gemini SDK surface moves fast and your training data may be stale. When
wiring up Agent Builder, ADK, Vertex AI, or Gemini APIs, verify against current official docs
rather than guessing (e.g. append "use context7" if the Context7 MCP server is configured).

## Code organization (keep the codebase readable)

- **Hard cap: each file is 300–400 lines maximum.** If a file would exceed this, do not let it
  grow — extract logic into a separate util/helper/function module and import it back.
- **Split along clean functional seams, never arbitrarily mid-logic.** The cap exists for
  readability; splitting a file at line 400 in the middle of a function defeats the purpose.
  Group related functions into a cohesive module (e.g. `adapters/csv_adapter`, `compliance/rules`,
  `agents/strategy`) rather than dumping overflow into a generic `utils` grab-bag.
- One module = one responsibility. If you can't describe a file's job in one sentence, it's
  doing too much and should be split.
- Prefer many small, well-named files over a few large ones. Readability for a 2-person team
  reviewing each other's code is the goal.

## Guardrails

- If a change would violate an architecture invariant or compliance rule above, stop and flag
  it rather than implementing it.
- Keep this file lean. New durable rules go here; everything else (rationale, market, roadmap)
  goes in DESIGN.md.