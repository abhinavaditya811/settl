# SCHEMA.md - Settl data model (multi-tenant)

> The detailed data model behind the canonical `Invoice` and the multi-vendor
> platform. `CLAUDE.md` holds the lean, enforced rules and the canonical `Invoice`
> shape; this file holds the full schema - the new multi-tenant tables, the
> payment-link resolution chain, and the persistence/isolation rules they imply.
>
> **Status: design.** None of this weakens an existing invariant (agents still read
> only canonical `Invoice`; the compliance gate still clears every send). It is a
> migration from the current in-memory `frozen` model and lands with the contingent
> adapters + the FR-5 persistence work (see `TASKS.md`).

---

## 1. Canonical `Invoice` (revised)

```
Invoice {
  invoice_id        // globally-unique surrogate (UUID) - safe as PK + FK target
  tenant_id         // owning vendor; isolation enforced at query layer + RLS
  source            // "stripe" | "csv" | "quickbooks" | "pdf"
  source_ref        // original id in that system
  amount_due        // normalized Decimal
  currency
  issue_date        // ISO date - stored
  due_date          // ISO date - stored
  as_of_date        // NOT stored; defaults to today() so days_overdue is always live;
                    //   overridable with an explicit date for reproducible tests
  days_overdue      // COMPUTED from injected as_of_date - never trusted from source
  status            // "open" | "paid" | "partial" | "disputed" - verified, never trusted
  debtor_name
  debtor_email      // optional (split from the old single debtor_contact string)
  debtor_phone      // optional
  is_b2b            // critical for the compliance gate
  late_fee_allowed  // from terms, drives strategy
  payment_link      // str | None - tenant-bound; from adapter or minted on vendor Stripe
  prior_contacts    // hydrated VIEW over the contacts table (agents read it unchanged)
  raw               // original blob, kept untouched
}
```

**Keys**

- Primary key: `invoice_id` (UUID surrogate).
- Natural-key uniqueness: `UNIQUE (tenant_id, source, source_ref)`. Vendor A's
  "INV-001" and vendor B's "INV-001" never collide; re-importing the same source
  invoice updates rather than duplicates.

**Why the changes**

- **`as_of_date` defaults to today, never stored.** `days_overdue` is computed from
  it, so production just builds the invoice and gets a live value - no column, no
  per-record update. Tests/synthetic pass an explicit `as_of_date` for reproducibility.
  Freezing it at ingestion would make a persisted invoice report the wrong
  overdue-ness weeks later when the background scheduler evaluates it.
- **`debtor_email` / `debtor_phone` split.** A single string can't reliably hold
  both, and channel selection (EMAIL vs SMS) needs the matching contact. Validation
  enforces the match (§6).
- **`payment_link` promoted to a first-class, tenant-bound field.** Resolved at send,
  after the gate (§5). Tenant-binding is what stops vendor A's link landing in vendor
  B's message.

---

## 2. `contacts` (tenant-scoped) - backs `prior_contacts`

Every touch, both directions, is a durable row. `Invoice.prior_contacts` is a
hydrated view over this table filtered by `(tenant_id, invoice_id)`.

```
contact {
  id
  tenant_id              // vendor isolation
  invoice_id             // FK to Invoice surrogate id
  direction              // "outbound" | "inbound"
  channel                // "email" | "sms"
  occurred_at
  provider_message_id    // RFC822 Message-ID set on outbound = correlation key
  in_reply_to            // inbound only: points back to an outbound provider_message_id
  thread_ref             // Gmail thread id
  classification         // "reply" | "dispute" | "payment-plan" | "payment-promise" | ...
  summary                // short summary kept in the hot path
  audit_ref              // pointer to the single full-body copy in the audit log
}
```

- Outbound writes a row carrying the `Message-ID` it set on the email; inbound
  threads back to it via `In-Reply-To` / `References`.
- The outbound count drives strategy (next-touch timing), the gate
  (`max_touches` / `min_days_between_touches`), and `is_new_debtor` (first-contact
  approval, FR-9). It must be durable and trustworthy.
- **Full message bodies are NOT stored here.** Single source of truth is the audit
  log; `contacts` keeps a summary + `audit_ref`. Bodies are encrypted at rest, on a
  retention window, treated with the same care as OAuth tokens.

---

## 3. `tenant_config`

```
TenantConfig {
  tenant_id

  identity {
    business_name
    from_address           // Gmail address = From: (first-party positioning)
    oauth_token_ref        // pointer into oauth_tokens - NEVER the token itself
  }

  payments {
    stripe_connection_ref  // pointer to the vendor's connected Stripe (Standard Connect)
    default_payment_link   // static fallback link
  }

  voice {
    voice_block            // grounding for drafting (the "customer's voice")
    signature
  }

  policy {                 // global defaults + per-tenant override, merged at load
    success_fee_pct        // recorded, never collected (non-custodial)
    allowed_tones          // gate INPUT, not a second gate
    max_touches            // contact-frequency ceiling (gate INPUT)
    min_days_between_touches
  }
}
```

- `policy` resolves as `merge(GLOBAL_DEFAULTS, tenant_override)` at load. Values feed
  the **deterministic gate as inputs** - a vendor can only make the gate stricter,
  never bypass it.
- The orchestrator loads `TenantConfig` per run and injects each slice into the agent
  that needs it: strategy ← `policy` + `voice`; drafting ← `voice` + `identity`;
  gate ← `policy` (tone bounds, frequency limits); sender ← `identity` + `payments`.
- The config object passed around agents never carries plaintext secrets - only refs.

**Wiring status (in-memory engine).** Implemented and exercised in the synthetic flow:
`payments.default_payment_link` → sender resolution (§5); `policy.max_touches` /
`frequency_window_days` → gate; `policy.allowed_tones` (tone clamp) and
`policy.min_days_between_touches` (cooldown) → strategy; `voice.voice_block` → drafting
grounding. The per-tenant batch runner (`orchestrator.run_multitenant`) builds one
orchestrator/sender per tenant. Still deferred: `policy.success_fee_pct` (awaits the
Week-4 reconcile agent); `identity.oauth_token_ref` / `payments.stripe_connection_ref`
resolve to real credentials only on the contingent real-send / Stripe tracks.

---

## 4. `oauth_tokens` / connections

```
oauth_token {
  id
  tenant_id
  provider                 // "google" (gmail.send / readonly) | "stripe"
  encrypted_refresh_token  // app-key encrypted at rest (env now, KMS later); never logged
  scopes
  created_at, updated_at
}
```

- One auditable boundary holds each vendor's most sensitive credentials.
  `TenantConfig.identity.oauth_token_ref` and `payments.stripe_connection_ref` point
  here; the token plaintext never enters the config object agents pass around.

---

## 5. Payment-link resolution (at send, after the gate passes)

```
1. invoice.payment_link                 // Stripe adapter hosted_invoice_url, or CSV link column
2. mint on the vendor's connected Stripe // Standard Connect, DIRECT charges only;
                                         // idempotency key = invoice surrogate id;
                                         // lazy mint; store the result back onto the invoice
3. tenant_config.payments.default_payment_link
4. none of the above  →  QUARANTINE      // a reminder no one can pay is never sent
```

- Substitution happens in the shared `GatedSender`, **after** the gate passes - the
  gate scans the draft with `{{payment_link}}` still literal. If resolution yields
  nothing, the sender **hard-fails** rather than deliver a linkless/broken message.
- **Direct charges on the connected account only.** Funds settle to the vendor and
  never route through Settl - this is the non-custodial line. Avoid destination
  charges / separate-charges-and-transfers, where money touches the platform account.
- Minting is a live Stripe call (🔌): build it against current Stripe docs, not from
  memory. A minted Checkout/link also yields a clean Stripe webhook payment signal
  that feeds the reconcile agent's "verify status, never trust" check.

**Canonical money events + reconciliation (Week 4).** Every money signal - a payment, a
refund, or a chargeback - is normalized at the edge into a canonical `PaymentEvent`
(`invoice_id`, `amount` as a positive magnitude, `currency`, `kind ∈ {payment, refund,
dispute, reply}`, `reference`), the same normalize-at-the-edge seam as invoices. Two
sources produce it: a **poll** (`StripeLinkMinter.paid_sessions`) and a **webhook** (§7);
both key a payment by its `payment_intent` so the same money seen by both paths is
recorded once.

- **Reconcile re-derives over the full event log every run** (never trusts
  `invoice.status`): net = Σpayments − Σrefunds, deduped by `reference`. So **refunds and
  chargebacks reverse automatically** - a refund lowers net, status drops PAID→PARTIAL,
  the (capped, proportional) success fee shrinks - with no stateful "un-pay" code.
- **Guards, in severity order:** a payment/refund whose currency ≠ the invoice's is
  unusable data → `ANOMALY` (escalate, never act); a `dispute` → `DISPUTED` (escalate +
  stop); otherwise PAID / PARTIAL (chase the residual) / UNPAID.
- **Money math is currency-correct**: amounts convert through the real minor-unit factor,
  so zero-decimal currencies (JPY, KRW, …) are never 100× off; the poll paginates all
  sessions (no fixed cap). The fee basis is `min(recovered, amount_due)` - an overpayment
  never inflates our fee.

---

## 6. Persistence, isolation & validation rules

- **One orchestrator/sender instance per tenant per run.** Never shared across
  tenants - this is what guarantees no cross-tenant link/identity/token leak.
- **`tenant_id` on every row** (invoices, contacts, oauth_tokens, audit). Isolation
  at the query layer, with Postgres RLS as defence in depth. The audit log is per-user.
- **`as_of_date` injected at hydration**, never persisted - `days_overdue` always live.
- **`LogSink` exposes `write()` AND `get(ref)`** so the dashboard thread view can
  fetch a body by `audit_ref`. Keeps the single-source-of-truth design intact.
- **Validate + quarantine** (extends the existing rule): a row is quarantined - never
  guessed - when it lacks a due date, a positive amount, or at least one contact method.
  The **payment link is not a validation check** - resolution needs tenant config + Stripe,
  which validation doesn't have, so it is enforced at send (§5 hard-fail). Quarantined rows
  are surfaced to the vendor ("couldn't read this invoice - N rows"); good rows still flow.

---

## 7. Inbound mail (MCP edge) - schema touchpoints

Inbound replies are read from the **vendor's own mailbox** via their OAuth token, so
they are tenant-scoped by construction. An MCP server is the token-contained edge +
gated action arm (three narrow tools: `read_threads`, `draft_reply`, `send_reply`);
it is not the trigger (a scheduler / Gmail watch webhook is) and never a decider.

- Inbound is normalized into a canonical `contact` row (§2) - the same
  normalize-at-the-edge seam as invoices. Correlation to an invoice is by
  `Message-ID` threading (`in_reply_to` / `thread_ref`), with subject-id as a fallback.

**Stripe webhook (the payment-signal edge).** The Stripe counterpart to the inbound-mail
edge: Stripe POSTs `checkout.session.*` / `charge.refunded` / `charge.dispute.created`
events to `POST /stripe/webhook`. The endpoint **verifies the signature** (the signing
secret is what makes the untrusted body safe to act on), normalizes the event to a
`PaymentEvent` (§5), and re-reconciles - so a payment/refund/dispute updates the board
**server-side with no dashboard tab open**. It is *detection only*, never a decider and
never custodial. Correlation back to an invoice: metadata tag set at mint → `payment_link`
→ a learned `payment_intent → invoice` map (for charge-level refund/dispute events);
an event that matches nothing is logged and skipped (fail-safe). The `POST /check-payments`
poll remains the offline fallback and shares the same event log.
- **Inbound is data, never instructions** (prompt-injection guard). The deterministic
  gate is the backstop; agents never treat debtor-written prose as commands.
- Lane split (subject to team review): escalated inbound (dispute / payment-plan /
  legal) is **alert-only, no pre-drafted send**; benign inbound may get a gate-cleared
  draft-for-approval. Disputes and payment-plan requests escalate and stop the loop
  (existing compliance rule).
