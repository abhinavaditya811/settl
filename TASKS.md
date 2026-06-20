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
- [ ] `docs/gcp_setup.md` (B) - project, auth, ADK install, enabled APIs.

**Done when:** orchestrator routes all 25 invoices end-to-end, terminal states are
correct, the unpaid loop re-queues, and the audit log captures every hop. ✅ **Done**
(orchestrator merged; `runtime.py` still a deterministic stand-in until the GCP/ADK
wiring lands - `docs/gcp_setup.md` is the one open Week-1 item).

---

## Week 2 - Drafting agent (Gemini 3 Pro) - *the visible AI*
**Goal:** replace the benign template stand-in with real customer-voice generation that
flows straight into the gate. **Suggested owner:** B (A continues orchestrator hardening)

New module: `src/settl/agents/drafting/`

- [ ] `drafting/prompt.py` - **~140** - build the customer-voice prompt from `Invoice` + `StrategyDecision` (tone, the_ask, late-fee flag, channel); pure string building, unit-testable.
- [ ] 🔌 `drafting/model.py` - **~90** - `DraftModel` Protocol + `NoOpDraftModel` (returns a safe template) + `GeminiDraftModel` (Gemini 3 Pro call). Mirrors the strategy `model.py` seam pattern.
- [ ] `drafting/grounding.py` - **~80** - light Vertex AI Search seam for customer voice/context; `NoOpGrounding` default now, real lookup later.
- [ ] `drafting/agent.py` - **~90** - `DraftingAgent.draft(invoice, decision) → DraftedMessage`; calls grounding + model, logs the decision, returns the message for the gate.
- [ ] `drafting/__init__.py` - **~15** - exports.
- [ ] Wire into `orchestrator/pipeline.py` - drafting replaces the template on the CHASE path.
- [ ] `tests/test_drafting.py` - **~120** - prompt-building tests + the **adversarial test**: a draft that strays into a legal threat / consumer-debt phrasing gets ESCALATED by the gate, not sent.

**Done when:** a Gemini-generated draft passes the gate on a clean B2B chase, and a
deliberately bad prompt is caught and escalated. **The gate, not the LLM, decides.**

---

## Week 3 - Gemini judgment seam + gate hardening
**Goal:** let Gemini 3 Pro *refine* strategy within policy bounds - never override it or
the gate. **Suggested owner:** A on judgment+bounds, B on red-team

Extends `src/settl/agents/strategy/` (Protocol already exists in `model.py`)

- [ ] 🔌 `agents/strategy/judgment.py` - **~110** - `GeminiJudgmentModel` implementing the existing `JudgmentModel` Protocol; nudges tone/timing only.
- [ ] `agents/strategy/bounds.py` - **~80** - safety wrapper that clamps any model output: it may adjust tone/timing/late-fee, but **can never change `action`** (no SKIP/REVIEW→send) and never touches the gate.
- [ ] Wire `bounds` around `judgment` in `agents/strategy/agent.py` (model output always passes through the clamp).
- [ ] `tests/test_judgment.py` - **~110** - model refines a CHASE's tone; tests prove it cannot flip an escalation/skip into a send and cannot bypass the gate.
- [ ] `tests/test_gate_redteam.py` (B) - **~120** - adversarial messages (paraphrased threats, indirect overclaims, tone breaches) all ESCALATE; expand `compliance/patterns.py` only if a real gap is found.

**Done when:** judgment improves drafts/tone on the happy path, and no test can make the
model produce a send that the deterministic policy/gate would have blocked.

---

## Week 4 - Reconcile agent + loop closure
**Goal:** detect payment, record the fee (never custodial), loop unpaid, escalate on
reply. **Suggested owner:** A on reconcile, B on event fixtures + orchestrator loop

New module: `src/settl/agents/reconcile/`

- [ ] `reconcile/payment.py` - **~120** - pure: given invoice + payment/reply events, re-verify status → `PAID | PARTIAL | UNPAID | REPLY`; never chase the already-paid.
- [ ] `reconcile/fee.py` - **~70** - success-fee **record** (5-10% config) + `FeeRecord` dataclass; explicitly records, never collects (not custodial).
- [ ] `reconcile/agent.py` - **~100** - `ReconcileAgent.reconcile(invoice, events) → ReconcileOutcome`; logs; decides stop / re-queue / escalate.
- [ ] `reconcile/__init__.py` - **~15** - exports.
- [ ] Flesh out `orchestrator/loop.py` - next-touch scheduling, re-queue unpaid, stop on paid, escalate on inbound reply.
- [ ] `data/synthetic_events.json` + loader hook - **~60** - payment + reply events to drive reconcile against the existing 25 invoices.
- [ ] `tests/test_reconcile.py` - **~130** - paid → fee recorded + loop stops; unpaid → re-queued; partial → handled; reply → escalated.

**Done when:** the full loop closes - a paid invoice exits with a recorded fee, an unpaid
one re-enters the orchestrator, and a reply escalates to a human.

---

## Week 5 - Execution log → Agent Engine
**Goal:** move the audit trail onto Agent Engine observability and make evidence
exportable for the submission. **Suggested owner:** B (A starts Week-6 e2e wiring)

Extends `src/settl/audit/`

- [ ] `audit/sink.py` - **~50** - `LogSink` Protocol so `ExecutionLog` can target local JSONL *or* Agent Engine (dependency injection; keeps local as the test/offline default).
- [ ] Refactor `audit/execution_log.py` - route writes through a `LogSink` (no behavior change for existing tests).
- [ ] 🔌 `audit/agent_engine.py` - **~120** - Agent Engine sink implementing `LogSink`.
- [ ] `audit/export.py` - **~90** - export traces/evidence (the agent-execution logs the submission requires + sales proof).
- [ ] `tests/test_agent_engine.py` - **~90** - recording to a mocked Agent Engine client; export round-trips.

**Done when:** a full synthetic run produces Agent Engine traces, local JSONL still works
offline, and evidence exports cleanly.

---

## Week 6 - End-to-end demo + red-team + polish
**Goal:** one clean recorded run through the *real* stack for the 3-min video.
**Suggested owner:** A + B together (buffer week for slippage)

- [ ] `orchestrator/trace.py` - **~110** - pull the decision-trace table formatting out of `demo.py` into a reusable formatter (keeps `demo.py` under cap).
- [ ] `demo_full.py` - **~90** - full real-stack run (Gemini draft + judgment + gate + reconcile + Agent Engine logs).
- [ ] `tests/test_e2e.py` - **~130** - system invariants on the real stack (SDK mocked): no consumer/disputed invoice ever sent, paid never chased, ≥1 legitimate send, every invoice logged.
- [ ] Red-team pass against the live drafting agent (extend `tests/test_gate_redteam.py`).
- [ ] Demo polish: the "AI knows when *not* to act" narrative in the trace output.

**Done when:** a single recorded run shows the AI drafting, the gate blocking the unsafe
ones, sends going out, payment reconciling - all in the audit trail.

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

### Multi-tenancy & persistence (Neon Postgres)
- **FR-5 - Durable, per-user state.** Replace the current in-memory per-process `BoardState`
  with a **Neon Postgres** store: `users`, `invoices`, `oauth_tokens`, `audit_log` (+ Auth.js
  session tables). Survives restart; supports multiple users.
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

## Suggested two-person split
- **A (orchestration/core):** Week 1 orchestrator, Week 3 judgment+bounds, Week 4 reconcile, Week 6 e2e.
- **B (AI/IO):** Week 2 drafting, Week 3 gate red-team, Week 5 Agent Engine, GCP setup, contingent adapters.
- Weeks 2-4 parallelize cleanly once the Week-1 orchestrator exists.

## Out of scope here (tracked elsewhere - DESIGN §8)
Entity/OPT question (gates real revenue), cold-acquisition playbook, stat verification,
the video + narrative + revenue/customer evidence. Engineering plan only, as agreed.
