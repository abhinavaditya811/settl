# TASKS.md - Settl engineering roadmap (per-file)

> Picks up where DESIGN §5 left off: decision core is **done** (schema, strategy,
> compliance gate, mock sender, audit log) and so is the **Week-1 orchestrator**
> (merged). A **FastAPI + Next.js dashboard** and a **real Gmail sender** (self-test
> only) have also landed ahead of schedule - see the new tracks below. 56 tests green.
> This is the ~7-week, engineering-only build of everything remaining, broken to the file.
>
> **Runway:** ~6-8 weeks. **Scope:** engineering modules only. **Real Gemini:** yes.
> **Real adapters + sending:** contingent - unlock when the first pilot signs.

## Conventions every task obeys (from CLAUDE.md)
- **300-400 line hard cap per file.** Estimates below are sized to stay under it; if a
  file would blow the cap, split on a clean functional seam - never mid-logic.
- **One module = one responsibility** you can state in a sentence (each file has its
  one-liner below).
- **The compliance gate is the only thing that clears a send.** Never inline a
  compliance check elsewhere - add a rule to `compliance/rules.py` and register it in
  `gate.py`.
- **Never custodial.** Nothing holds, routes, or settles money - fees are *recorded*, not collected.
- **First-contact human approval stays on** (pilot-mode human-in-the-loop).
- **Recompute derived fields; never trust the source.**
- 🔌 = file makes live Gemini/ADK/Vertex/Stripe SDK calls → **verify against current
  official docs (context7), do not code the API from memory.**
- Every new agent writes its decision + reasoning to the execution log.

## Legend
- `[ ]` todo · `[~]` in progress · `[x]` done
- **Owner:** A / B (fill in names) - suggested split noted per week
- **~L:** rough target line count (keep under 400)

---

## Week 1 - Orchestrator (the spine)
**Goal:** a real orchestrator drives every invoice strategy → draft → gate → send →
reconcile, with the unpaid loop. Deterministic draft + mock sender for now.
**Suggested owner:** A (B starts GCP setup + Week-2 prompt work in parallel)

New module: `src/settl/orchestrator/`

- [x] `orchestrator/result.py` - `PipelineResult` / `PipelineStep` dataclasses describing what happened to one invoice end-to-end.
- [x] `orchestrator/pipeline.py` - the routing spine: run strategy, branch on SKIP/HOLD/REVIEW/CHASE, on CHASE call draft → gate → sender, return a `PipelineResult`. No SDK here - pure coordination over injected agents.
- [x] `orchestrator/loop.py` - re-queue / next-touch decision after a run (skeleton; fleshed out in Week 4 with reconcile).
- [x] 🔌 `orchestrator/runtime.py` - runtime seam (currently a deterministic stand-in; the Agent Builder + ADK / **Gemini 3 Flash** wiring plugs in here, isolated so it can be mocked/swapped).
- [x] `orchestrator/__init__.py` - public exports (`Orchestrator`, `PipelineResult`, `TerminalState`).
- [x] Refactor `demo.py` - calls the orchestrator instead of its own ad-hoc loop.
- [x] `tests/test_orchestrator.py` - all 25 synthetic invoices run end-to-end; loop-back fires for unpaid; every hop logged.
- [ ] `docs/gcp_setup.md` (B) - project, auth, ADK install, enabled APIs. **→ carried to Week 7.**

**Done when:** orchestrator routes all 25 invoices end-to-end, terminal states are
correct, the unpaid loop re-queues, and the audit log captures every hop. ✅ **Done**
(orchestrator merged; `runtime.py` still a deterministic stand-in until the GCP/ADK
wiring lands - `docs/gcp_setup.md` is the one open Week-1 item).

---

## Week 2 - Drafting agent (Gemini 3 Pro) - *the visible AI*
**Goal:** replace the benign template stand-in with real customer-voice generation that
flows straight into the gate. **Suggested owner:** B (A continues orchestrator hardening)

New module: `src/settl/agents/drafting/`

- [x] `drafting/prompt.py` - **~140** - build the customer-voice prompt from `Invoice` + `StrategyDecision` (tone, the_ask, late-fee flag, channel); pure string building, unit-testable. *(141 lines; adds `safe_fallback()` shared with NoOp model.)*
- [x] 🔌 `drafting/model.py` - **~90** - `DraftModel` Protocol + `NoOpDraftModel` (returns a safe template) + `GeminiDraftModel` (Gemini 3 Pro call). Mirrors the strategy `model.py` seam pattern. *(Gemini call is a deferred seam - wire against context7 docs once GCP exists, like `runtime.py`.)*
- [x] `drafting/grounding.py` - **~80** - light Vertex AI Search seam for customer voice/context; `NoOpGrounding` default now, real lookup later. *(`VertexSearchGrounding` is a deferred seam.)*
- [x] `drafting/agent.py` - **~90** - `DraftingAgent.draft(invoice, decision) → DraftedMessage`; calls grounding + model, logs the decision, returns the message for the gate.
- [x] `drafting/__init__.py` - **~15** - exports.
- [x] Wire into `orchestrator/pipeline.py` - drafting replaces the template on the CHASE path. *(DraftingAgent is now the default drafter; a `drafting` step is recorded in the trace.)*
- [x] `tests/test_drafting.py` - **~120** - prompt-building tests + the **adversarial test**: a draft that strays into a legal threat / consumer-debt phrasing gets ESCALATED by the gate, not sent. *(10 tests; gate proven to decide at the gate directly AND end-to-end through the orchestrator.)*

**Done when:** a Gemini-generated draft passes the gate on a clean B2B chase, and a
deliberately bad prompt is caught and escalated. **The gate, not the LLM, decides.**

---

## Week 3 - Gemini judgment seam + gate hardening
**Goal:** let Gemini 3 Pro *refine* strategy within policy bounds - never override it or
the gate. **Suggested owner:** A on judgment+bounds, B on red-team

Extends `src/settl/agents/strategy/` (Protocol already exists in `model.py`)

- [x] 🔌 `agents/strategy/judgment.py` - `GeminiJudgmentModel` implementing the existing `JudgmentModel` Protocol; nudges tone/late-fee only. *(LIVE google-genai call, env-overridable model id, fail-safe to the deterministic decision on any error.)*
- [x] `agents/strategy/bounds.py` - safety wrapper that clamps any model output: it may adjust tone/timing/late-fee, but **can never change `action`** (no SKIP/REVIEW→send), never adds a fee the terms forbid, and never touches the gate.
- [x] Wire `bounds` around `judgment` in `agents/strategy/agent.py` - `StrategyAgent` always wraps the model in `ClampedModel`, so model output cannot bypass the clamp.
- [x] `tests/test_judgment.py` - 14 tests: clamp can't be tricked into a send by a rogue model; tone refinement applies; Gemini model is fail-safe (no key / API error -> deterministic decision).
- [x] `tests/test_gate_redteam.py` (B) - 19 tests: direct + paraphrased threats, indirect overclaims, tone breaches all ESCALATE; a clean firm message still passes. Closed two real gaps in `compliance/patterns.py` (legal proceedings/remedies, credit agencies/reporting).

**Done when:** judgment improves drafts/tone on the happy path, and no test can make the
model produce a send that the deterministic policy/gate would have blocked.

---

## Week 4 - Reconcile agent + loop closure
**Goal:** detect payment, record the fee (never custodial), loop unpaid, escalate on
reply. **Suggested owner:** A on reconcile, B on event fixtures + orchestrator loop

New module: `src/settl/agents/reconcile/`

- [x] `reconcile/payment.py` - pure re-derivation over the **full event log**: `tally_events` (dedup by reference, currency guard, refund netting) + `classify` → `PAID | PARTIAL | UNPAID | REPLY | DISPUTED | ANOMALY`; never chase the already-paid.
- [x] `reconcile/fee.py` - success-fee **record** (5-10% config) + `FeeRecord`; basis **capped at the invoice total** (overpayment never inflates the fee); records, never collects.
- [x] `reconcile/agent.py` - `ReconcileAgent.reconcile(invoice, events) → ReconcileOutcome`; logs; PAID stops + fee, PARTIAL records a **proportional** fee + carries the residual, DISPUTED/REPLY/ANOMALY escalate + stop.
- [x] `reconcile/__init__.py` - exports.
- [x] Flesh out `orchestrator/loop.py` - `next_touch_after_reconcile`: stop on paid, chase the residual on partial, normal cadence on unpaid, escalate + stop on dispute/reply/anomaly.
- [x] 🔌 **Payment edge cases + Stripe webhook** (`payments/currency.py`, `payments/webhook.py`, `api/state.ingest_webhook`, `POST /stripe/webhook`) - zero-decimal currencies, paginated `paid_sessions` (no session cap), refund/chargeback reversal, and a signature-verified webhook so payments/refunds/disputes update the board **server-side with no tab open**. Poll + webhook share one event log keyed by payment_intent (no double-count).
- [~] `data/synthetic_events.json` + loader hook - **superseded**: `test_reconcile.py` builds canonical `PaymentEvent`s inline and `test_api.py`/`test_webhook.py` drive the webhook path directly, so no separate fixture file was needed. Add one only if a scripted multi-touch demo wants it.
- [x] `tests/test_reconcile.py` (+ `tests/test_webhook.py`) - paid → fee + stop; unpaid → re-queue; partial → proportional fee + residual; refund → nets down; dispute → escalate; currency mismatch → anomaly; duplicate reference deduped; overpayment fee capped.

**Done when:** the full loop closes - a paid invoice exits with a recorded fee, an unpaid
one re-enters the orchestrator, a reply/dispute escalates to a human, and a refund/
chargeback reverses automatically because reconcile re-derives net over the full event
log. ✅ **Done** (reconcile + payment edge cases + Stripe webhook merged; 162 tests green).

---

## Week 5 - Execution log → Agent Engine
**Goal:** move the audit trail onto Agent Engine observability and make evidence
exportable for the submission. **Suggested owner:** B (A starts Week-6 e2e wiring)

Extends `src/settl/audit/`

- [x] `audit/sink.py` - `LogSink` Protocol + `JsonlSink` (dependency injection; local JSONL stays the offline/test default). JSONL write extracted out of `ExecutionLog`.
- [x] Refactor `audit/execution_log.py` - in-memory list stays the source of truth; each entry mirrors to any attached `LogSink` (`jsonl_path` constructor + `add_sink`); sink writes are fail-safe. No behavior change for existing tests.
- [x] 🔌 `audit/agent_engine.py` - `AgentEngineSink` implementing `LogSink` via Google Cloud Logging `log_struct` (Agent Engine reads structured Cloud Logging). Opt-in (`SETTL_USE_AGENT_ENGINE=1`), lazy SDK import, injectable client, fail-safe - same seam pattern as `runtime.py` / Gemini / Stripe. Wired into `BoardState` when armed.
- [x] `audit/export.py` - `evidence_bundle` / `write_evidence` / `load_evidence`: run-level counts (by agent, by decision) + per-invoice grouped trail, round-trippable JSON. Pure/deterministic.
- [x] `tests/test_agent_engine.py` - sink seam + fake Cloud Logging client, fail-safe on client error, local JSONL unchanged, evidence export round-trips.

**Done when:** a full synthetic run produces Agent Engine traces, local JSONL still works
offline, and evidence exports cleanly. ✅ **Done** (LogSink seam + Agent Engine sink +
evidence export merged; the sink is a deferred 🔌 seam that lights up when GCP creds land -
`docs/gcp_setup.md` from Week 1 is still the one prerequisite).

---

## Governance / human-in-the-loop - reasoning drill-down + flag→guardrail→re-orchestrate
**Goal:** an operator can see *why* an agent decided what it did (the full "thought
process"), and flag a decision so the engine behaves differently for similar future cases
- as a durable guardrail, re-orchestrated through the gate. Lands ahead of Week 6 and sets
its narrative up. **Invariant:** the dashboard only projects; guardrails live in the engine
and can only make it *stricter* (waive soft rules only; legal/consumer/dispute never).

New module: `src/settl/governance/`

- [x] `governance/rules.py` - `OperatorRule` + `Directive` (ALWAYS_ESCALATE / FORCE_SKIP / FORCE_HOLD / SOFTEN_TONE / WAIVE) + attribute `matches()`.
- [x] `governance/store.py` - `RuleStore` (in-memory per-tenant; add/matching/all), mirrors the TenantConfig "config steers the engine as input" pattern.
- [x] `governance/apply.py` - `tighten_strategy` (downgrade-only), `guardrail_violations` (adds `OPERATOR_GUARDRAIL`), `waived_codes` (soft-only, intersected with `WAIVABLE_CODES`). Lazy cross-imports to avoid a cycle.
- [x] Wire into the engine: `ComplianceGate` (tighten + soft-waive), `StrategyAgent` (tighten after the clamp), `Orchestrator` threads a `RuleStore` via DI (like TenantConfig). `compliance/rules.py` gains `WAIVABLE_CODES` + `OPERATOR_GUARDRAIL`.
- [x] API: `BoardState.flag_decision` (store + re-orchestrate + log `operator_flag`; refuses waiving a hard code) + `guardrails()`; `POST /invoices/{id}/flag` + `GET /guardrails`; schemas. (`api/metrics.py` extracted to keep `state.py` under cap.)
- [x] Dashboard: `InvoiceDrawer` reasoning drill-down (per-hop `details` "thought process" via `DecisionTrace`), a `FlagForm` (scope/directive/waive/reason), and a `GuardrailsPanel`; `BoardContext.flag` + proxy routes.
- [x] `tests/test_governance.py` + red-team extension + `test_api.py` flag tests. **Safety proven:** tighten downgrades only; a near-miss the base gate misses is caught by an `ALWAYS_ESCALATE` guardrail; a WAIVE of `B2B_ONLY` / `LEGAL_THREAT` is refused and still ESCALATES.

**Done when:** flagging a decision re-orchestrates the invoice, stores a guardrail that
steers similar cases, and no flag can make the engine send something a hard rule blocks.
✅ **Done** (190 tests green; the deep-reasoning + human-correction loop is live).

---

## Payment-plan track (SCHEMA.md §8) - installment plans as a bounded-autonomy lane
**Goal:** a debtor asking to pay over time gets a vendor-preapproved installment plan,
never confirmed without the vendor's explicit approve/reject. Built across several
sessions via live manual testing (not week-pinned). **Invariant:** the AI may offer a
template and read the debtor's response, but only `orchestrator/payment_plan.py::
decide_payment_plan` (the vendor's explicit action) can ever confirm anything to the
debtor - `payment_plan_autonomy` gates whether that confirmation actually sends, it can
never make the AI decide on the vendor's behalf.

- [x] `agents/payment_plan/` - offer/build_installments/reoffer (pure, currency-exact),
  negotiate.py::read_response (accept vs. wants-different-terms, never auto-negotiates),
  monitor.py (missed-installment reminder-then-escalate state machine).
- [x] `api/payment_plan_board.py` + `api/payment_plan_routes.py` - offer / reoffer /
  decide over HTTP, durable via `payment_plans` table (hydrated on startup - a restart
  used to silently forget every in-flight plan).
- [x] `InboundMailBoard` wired to negotiate.py - a reply while a plan is proposed/active
  routes to negotiation, not the generic inbound lanes; the outcome + the debtor's own
  words are persisted onto the plan (`negotiation_outcome`, `requested_terms`, migration
  013) so the vendor sees what was said BEFORE deciding, not just in the log.
- [x] `payment_plan_autonomy` is a real per-tenant setting (`tenant_config_routes.py`,
  Profile tab + asked once at the ZeroState onboarding screen) - previously the gate
  never consulted per-tenant policy at all (`ComplianceGate` was built once, shared
  across every tenant, with no config), so the flag had no way to ever take effect.
- [x] `PaymentPlanPanel.tsx` - offer / approve / reject / re-offer, shows the debtor's
  negotiation response before the vendor decides.

**Deferred - pinned here, not yet built:**
- [ ] **Threaded confirmation reply.** `decide_payment_plan`'s confirmation currently
  sends as a fresh email via the standard `GatedSender`, not as a reply into the
  debtor's "can I get a payment plan" thread. The pieces exist: `InboundMailBoard.
  _send_and_record` already knows how to send a threaded Gmail reply (`thread_id`/
  `in_reply_to`), and the debtor's inbound contact carries `thread_ref`/
  `provider_message_id`. Needs: at approve-time, look up the invoice's inbound
  `payment_plan_request` contact and route the confirmation through the threaded send
  path instead of `GatedSender`. `PaymentPlan.contact_ref` was seemingly built for
  exactly this and is still unused.
- [ ] **Per-installment payment links.** The confirmation currently contains **no
  payment link at all** - a debtor who accepts a plan has no way to actually pay it.
  `payments/stripe_links.py::StripeLinkMinter.mint(invoice, installment_index=i,
  amount=...)` already mints a separate, idempotent link per installment (tagged with
  `settl_installment_index` metadata) - nothing calls it. `Installment.payment_link`
  stays `None` forever. Recommended shape (discussed, not yet built): mint at
  **approve**, not offer (don't create live Stripe objects for terms that might be
  rejected); keep the existing pooled/FIFO reconcile math (`classify_plan`,
  `mark_paid_installments`) as the source of truth for "is this plan on track" rather
  than rearchitecting reconcile to attribute a specific session to a specific
  installment - the per-installment link is for debtor-facing clarity in each
  reminder, not reconcile precision.

**Done when:** a debtor's plan request is offered, negotiated, approved, and confirmed
*as a reply in their own thread*, with a payable link on every installment.

---

## Week 6 - End-to-end demo + red-team + polish
**Goal:** one clean recorded run through the *real* stack for the 3-min video.
**Suggested owner:** A + B together (buffer week for slippage)

- [x] `orchestrator/trace.py` - reusable decision-trace formatter (`format_trace_table` / `format_summary` / `format_loop_plan` + `describe_details`) pulled out of `demo.py`; `demo.py` now uses it. Shared by CLI + (indirectly) the dashboard drill-down.
- [ ] `demo_full.py` - full real-stack run. **→ carried to Week 7.**
- [ ] `tests/test_e2e.py` - system invariants on the real stack (SDK mocked). **→ carried to Week 7.**
- [~] Red-team pass against the live drafting agent. Static red-team extended (near-miss + guardrail-catches-it + non-waivable-legal-code). **Live-drafting pass → carried to Week 7.**
- [~] Demo polish: the "AI knows when *not* to act" narrative. Reasoning drill-down + flag→guardrail loop deliver the story. **Final trace-output polish → carried to Week 7.**

**Done when:** a single recorded run shows the AI drafting, the gate blocking the unsafe
ones, sends going out, payment reconciling - all in the audit trail. **Status: the
decision core is all built and the happy path runs end-to-end (`demo.py` routes all 25
invoices; 190 tests green). What remains is the recorded real-stack run + e2e invariants +
GCP doc - carried into Week 7 below.**

---

## Week 7 - Catch-up sprint: real-stack demo, e2e invariants, docs + tech debt
**Goal:** close out everything left from Weeks 1-6 so the repo is demo- and PR-ready.
Scoped to one sprint - the **happy path already works end-to-end** (decision core, drafting,
judgment+clamp, gate, reconcile+webhook, audit→Agent-Engine sink, governance/HITL all built;
`demo.py` routes all 25 invoices; 190 tests green). What's left is the recorded real-stack
run, the system-invariant e2e tests, the GCP doc, a live-drafting red-team pass, and one
pinned refactor - no new engine capability required.

- [ ] `docs/gcp_setup.md` (carried from Week 1) - **~80** - project, auth (ADC), ADK install, enabled APIs; what `SETTL_USE_GEMINI` / `SETTL_USE_AGENT_ENGINE` / `SETTL_USE_STRIPE` need to light up.
- [ ] `demo_full.py` - **~90** - full real-stack run (Gemini draft + judgment + gate + reconcile + Agent Engine logs), rendered via `orchestrator/trace.py`. Minimal wiring: the rule store, trace formatter, reconcile, and Agent Engine sink all exist.
- [ ] `tests/test_e2e.py` - **~130** - system invariants on the real stack (SDK mocked): no consumer/disputed invoice ever sent, paid never chased, ≥1 legitimate send, every invoice logged, and a flag→guardrail re-orchestration holds.
- [ ] Live-drafting red-team pass - drive **real Gemini** drafts through the gate (extend `tests/test_gate_redteam.py`); prove the gate still catches an LLM that strays.
- [ ] Demo polish - final "AI knows when *not* to act" trace-output narrative for the 3-min video.
- [x] **Tech debt (pinned):** extract the reconcile/webhook cluster (`check_payments`, `ingest_webhook`, `_record_event`, `_correlate`, `_apply_reconcile` + their state) out of `BoardState` into a `ReconciliationDesk` collaborator (`api/reconcile_ops.py`) - SRP + gives `api/state.py` headroom under the 400-line cap. Behavior-preserving; `test_api.py`/`test_webhook.py` are the regression net (both green). `state.py` is now 373 lines, `reconcile_ops.py` 219.

**Done when:** a single recorded real-stack run shows drafting → gate → send → reconcile in
the audit trail, `test_e2e.py` invariants pass (SDK mocked), the GCP doc lets a fresh clone
light up the real integrations, and `state.py` is back under the file cap.

---

## Contingent track - unlock when the first pilot signs (DESIGN §5 step 6)
**Not week-pinned.** Built behind the clean adapter/sender boundaries, so going live is a
small contained swap, not a rewrite. Pre-build against **Stripe test mode** in the Week-7
buffer so the live flip is config-only.

New module: `src/settl/adapters/`

- [ ] `adapters/base.py` - **~80** - shared adapter helpers + `Adapter` Protocol (field-map → canonical, dates → ISO, money → Decimal, status → enum).
- [ ] `adapters/csv_adapter.py` - **~140** - universal CSV export → canonical `Invoice`; validate + quarantine. (Build first - unblocks any pilot.)
- [ ] 🔌 `adapters/stripe_adapter.py` - **~160** - live Stripe pull → canonical `Invoice`.
- [ ] `adapters/__init__.py` - **~15** - exports.
- [ ] `tests/test_csv_adapter.py` - **~110** - real-world-messy CSV maps correctly; bad rows quarantine.
- [ ] `tests/test_stripe_adapter.py` - **~110** - Stripe test-mode payload maps correctly.

Real sending: `src/settl/sending/`

- [x] `sending/base.py` - `Sender` Protocol + `GatedSender` shared by mock + real (mock already refuses ESCALATE; real senders inherit that guarantee centrally).
- [x] 🔌 `sending/email_sender.py` - real Gmail SMTP send behind the `Sender` interface. **Built early as a controlled self-test only** (env-gated; `force_recipient`/`SETTL_TEST_RECIPIENT` redirects every message to the operator's own inbox). Not customer outreach - that still waits on a signed pilot. See `send_live.py`.
- [ ] 🔌 `sending/sms_sender.py` - **~110** - real SMS send behind the `Sender` interface. (Note: `policy.py` can already choose `Channel.SMS`, but no SMS sender exists yet - the email sender ignores channel, so until this lands keep channel selection email-only or guard it.)
- [x] `tests/test_senders.py` - refuses ESCALATE; sends on PASS (provider mocked).

---

## Functional requirements - auth, data upload, multi-tenancy
**Status: design agreed, not yet built.** These are the product-level requirements behind the
two in-design dashboard items (zero-state + auth, data upload). They cut across the engine,
the API, and `web/`, so they live here as one referenceable spec. IDs (`FR-n`) are for linking
from the per-file tasks below. **None of these may weaken an existing CLAUDE.md invariant -
the compliance gate still clears every send, agents still read only canonical `Invoice`.**

### Authentication & identity
- **FR-1 - Google (Gmail) sign-in.** Users authenticate with Google via **Auth.js / NextAuth**
  (Google provider) in Next.js. Real multi-user - no shared/demo password.
- **FR-2 - One identity, one mailbox.** The Google account a user logs in with is the **same
  account Settl sends from** (`From:` = the user's address). Reinforces first-party positioning
  ("in the business's name"); keeps us non-custodial of sending infra.
- **FR-3 - Scopes.** Request `openid email profile` (identity) + `gmail.send` (sending) +
  `access_type=offline` (to obtain a refresh token for FR-7). `gmail.send` is a Google
  **restricted scope** → until app verification (CASA) completes we run in **test-user mode
  (≤100 manually-added users)**. Acceptable for demo/pilot; flagged as an ops constraint.
- **FR-4 - Account lifecycle.** Sign in / sign out; **disconnect Google** (revoke + delete
  stored tokens, which must cancel any scheduled autonomous sends - see FR-8); **delete account
  + data** (all invoices, tokens, and audit rows for that user).

### Multi-tenancy & persistence (Supabase Postgres)
- **FR-5 - Durable, per-user state.** Replace the current in-memory per-process `BoardState`
  with a **Supabase Postgres** store. Schema landed in `supabase/migrations/`: `tenants`,
  `invoices`, `contacts`, `tenant_config`, `oauth_tokens`, `operator_rules`, `execution_log`,
  `payment_events` - RLS-locked (defense-in-depth), FastAPI connects as the service role and
  scopes every query by `tenant_id`. Still open: point `settl/data`/`state.py` at these tables
  instead of the synthetic JSON fixture. Survives restart; supports multiple users.
- **FR-6 - Hard tenant isolation.** Every invoice, draft, audit entry, and metric is scoped to
  its owning `user_id`; **a user can never read or act on another user's data.** Enforce at the
  query layer (and consider Postgres RLS as defence-in-depth). The audit log is per-user.

### Sending (Gmail API, autonomous)
- **FR-7 - Autonomous offline sending.** Store each user's **encrypted** Gmail refresh token so
  follow-up touches can send when the operator is not logged in. Tokens are **encrypted at rest**
  (app-level key, never plaintext, never logged) - consistent with "never hold anything sensitive
  in the clear." A new `GmailApiSender` implements the existing `Sender` protocol (uses the user's
  OAuth token; replaces/joins `GmailSmtpSender`). The compliance gate gates it like any sender.
- **FR-8 - Background send scheduler (NEW - surfaced by FR-7).** Autonomous sending needs a
  worker/cron that wakes on a schedule, finds invoices whose next-touch is due (drives off
  `orchestrator/loop.py`, Week 4 reconcile), and sends via the stored refresh token. No human is
  present at send time, so: **first-contact approval still applies** - FR-9.
- **FR-9 - First contact stays human-in-the-loop.** Autonomy covers **follow-up** touches only.
  The first message to any new debtor still requires one-tap approval in the dashboard before it
  can send (existing `FIRST_CONTACT_APPROVAL` rule) - the scheduler never auto-sends a first contact.
- **FR-10 - Reply / dispute detection (FLAGGED, likely roadmap).** Reconcile escalates on an
  inbound reply/dispute. Detecting replies in Gmail needs an **inbox-read scope** (`gmail.readonly`
  - another restricted scope) or a webhook/polling design. Out of scope for the first cut unless we
  decide otherwise; until then inbound events come from the existing synthetic/manual path.

### Data ingestion / upload (CSV first)
- **FR-11 - CSV upload.** The user uploads a CSV of their own invoices through the dashboard
  (replacing the static synthetic set for that user). File goes through the **CSV adapter**
  (contingent track below) → canonical `Invoice` → validate → pipeline. **No source format is
  ever special-cased outside the adapter** (CLAUDE.md invariant).
- **FR-12 - Compute, never trust.** The adapter computes `days_overdue`, sets `as_of_date`, and
  maps `status` onto the enum - it never trusts those from the uploaded file.
- **FR-13 - Validate + quarantine, surfaced in UI.** Rows missing a due date / positive amount /
  contact method are **quarantined, not guessed**, and shown to the user as "couldn't read this
  invoice (N rows)" so they can fix and re-upload. Good rows still flow through.
- **FR-14 - PDF / arbitrary invoice = roadmap.** Out of v1; the upload UI is built so a future
  PDF/multimodal-extraction adapter slots in behind the same adapter→validate→quarantine seam.

### Zero-state & onboarding
- **FR-15 - Zero-state UX.** Before any data exists, the board, approvals, and activity views
  show purposeful empty states (not blank tables), guiding the user through the onboarding path.
- **FR-16 - Onboarding flow.** Connect Google (FR-1) → upload a CSV (FR-11) → see the board run.
  Each step's empty/zero state points to the next.

### Open items to resolve (not yet decided)
- Where the `GmailApiSender` gets the live token at send time (Next.js passes it to FastAPI, vs.
  FastAPI reads the encrypted refresh token from Neon and mints an access token itself).
- Per-user config (success-fee %, tone bounds, contact-frequency limits) - global defaults now,
  per-user later?
- Encryption key management for FR-7 (env-provided app key now; KMS later).
- Google app verification timeline vs. staying in test-user mode for the hackathon.

---

## Dashboard track - engine API + Next.js cockpit (landed early, off the original plan)
**Not originally week-pinned.** A read-mostly operator dashboard over the engine: see the
board, drill into any invoice's decision trace, one-tap approve a held first-contact draft.
The contract is strict - **the API only projects engine state; the orchestrator, gate, and
sender stay the sole authorities.** No business logic in routes.

Backend: `src/settl/api/`

- [x] `api/schemas.py` - Pydantic response/request contract (cards, detail, metrics, trace, approve).
- [x] `api/state.py` - `BoardState`: runs the orchestrator over the dataset in-process, holds per-invoice results, serves trace/metrics, performs approvals. In-memory/per-process (durable store is later). Live-send is opt-in (`SETTL_LIVE_SEND=1` + `SETTL_TEST_RECIPIENT`) and always redirected to the operator inbox.
- [x] `api/main.py` - FastAPI routes (`/health /invoices /metrics /activity /invoices/{id} …/trace …/approve /refresh`). Thin projectors only.

Frontend: `web/` (Next.js + styled-components)

- [x] Overview cockpit (KPIs, aging, outcomes), invoice table + drawer, activity feed, approvals queue, theming.
- [ ] **Zero-state + auth** (current branch `abhinav/zero-state-plus-auth`) - empty-state UX before any data + Google auth layer. **Spec: FR-1..FR-6, FR-15..FR-16.**
- [ ] **Data upload (CSV first; PDF/arbitrary = roadmap) → adapter → pipeline** - let the user load their own data instead of the static synthetic set. Depends on the CSV adapter (contingent track) + DB-backed state. **Spec: FR-11..FR-14.**
- [ ] **Gmail send + autonomous scheduler** - send from the user's own mailbox; background worker for follow-up touches. **Spec: FR-7..FR-10.**

⚠️ **Guardrail:** the dashboard runs on the **synthetic** dataset, and its money KPIs
(`recovered`, `outstanding`) are computed from that synthetic data. Per CLAUDE.md, synthetic
data is for logic/demo ONLY - **never screenshot these figures as revenue/customer evidence.**
Label the demo dashboard as synthetic.

## Voice track - calls as a compliant channel (spec: docs/VOICE_AGENT_SPEC.md)
**Goal:** the agent can PHONE an overdue B2B customer - same pipeline, same gate, new
channel. Live-verified 2026-07-11 (a real Retell call, answered). Full status + the
deferred list live in the spec's §10; the checklist below is the working view.

Engine: `src/settl/voice/`

- [x] `schema` - `Channel.VOICE`; `contact_for` routes voice → `debtor_phone`.
- [x] `tenancy` - new `audio` slice (default/cloned voice, `ConsentRecord`, `CallWindow`, voice-eligibility knobs). Separate from `voice` (writing persona).
- [x] `voice/script.py` - disclosure-first call script; URL never spoken (link rides the SMS leg).
- [x] `compliance` - hard voice rules: `VOICE_NO_DISCLOSURE`, `VOICE_NO_CONSENT`, `VOICE_OUTSIDE_HOURS`, `VOICE_OPTED_OUT` (none waivable); gate is channel-aware, fails safe.
- [x] `voice/sender.py` + `voice/retell_sender.py` - mock + live senders behind `GatedSender` (escalated script can never dial; link never sent to the voice provider).
- [x] `voice/provider.py` (+ `system_provider`, `elevenlabs_provider`) - TTS/clone seam: mock / macOS `say` / ElevenLabs.
- [x] `voice/onboarding.py` - consent-gated clone onboarding (refuses without active consent; revocable).
- [x] `voice/registry.py` - per-debtor `ConsentStore` + `DoNotCallRegistry` (permanent) + `DialLedger` (never double-dial).
- [x] `voice/artifact.py` - pull the ended call from Retell; deterministic outcome labels; "stop calling" → do-not-call immediately.
- [x] `voice/followup.py` - companion SMS leg through the existing `Sender` seam (mock-first).
- [x] `agents/strategy` - voice as an escalation channel: opt-in, 30d+ overdue, after written touches, phone on file.
- [x] red-team: adversarial call scripts through the gate (consent can't launder content).
- [x] dashboard: voice approval card with a script play button (preview surface).
- [ ] 🔌 voice cloning LIVE - needs ElevenLabs Starter (~$5/mo, commercial rights); code path done.
- [ ] 🔌 live SMS provider (Twilio) behind the same `Sender` seam.
- [x] 🔌 Retell end-of-call webhook - `POST /retell/webhook`, signature-verified, same artifact recorder as `--pull`.
- [x] rich per-call dynamic variables (invoice facts, business name, {{transfer_number}} handoff, per-tenant business_facts).
- [x] recording disclosure per US state (`voice/recording.py`, conservative) + debtor-local clock (`voice/timezones.py`).
- [x] red-team transcripts: injection never buys a good outcome; dispute/opt-out outrank pay-words.
- [ ] consent-capture UX in the dashboard (grant/revoke per debtor) + durable stores (DB + RLS).
- [ ] adapters carry the debtor's US state so production feeds the timezone + recording helpers automatically.

## Suggested two-person split
- **A (orchestration/core):** Week 1 orchestrator, Week 3 judgment+bounds, Week 4 reconcile, Week 6 e2e.
- **B (AI/IO):** Week 2 drafting, Week 3 gate red-team, Week 5 Agent Engine, GCP setup, contingent adapters.
- Weeks 2-4 parallelize cleanly once the Week-1 orchestrator exists.

## Out of scope here (tracked elsewhere - DESIGN §8)
Entity/OPT question (gates real revenue), cold-acquisition playbook, stat verification,
the video + narrative + revenue/customer evidence. Engineering plan only, as agreed.
