# TASKS.md — Settl engineering roadmap (per-file)

> Picks up where DESIGN §5 left off: decision core is **done** (schema, strategy,
> compliance gate, mock sender, audit log, 28 tests). This is the ~7-week,
> engineering-only build of everything remaining, broken down to the file.
>
> **Runway:** ~6–8 weeks. **Scope:** engineering modules only. **Real Gemini:** yes.
> **Real adapters + sending:** contingent — unlock when the first pilot signs.

## Conventions every task obeys (from CLAUDE.md)
- **300–400 line hard cap per file.** Estimates below are sized to stay under it; if a
  file would blow the cap, split on a clean functional seam — never mid-logic.
- **One module = one responsibility** you can state in a sentence (each file has its
  one-liner below).
- **The compliance gate is the only thing that clears a send.** Never inline a
  compliance check elsewhere — add a rule to `compliance/rules.py` and register it in
  `gate.py`.
- **Never custodial.** Nothing holds, routes, or settles money — fees are *recorded*, not collected.
- **First-contact human approval stays on** (pilot-mode human-in-the-loop).
- **Recompute derived fields; never trust the source.**
- 🔌 = file makes live Gemini/ADK/Vertex/Stripe SDK calls → **verify against current
  official docs (context7), do not code the API from memory.**
- Every new agent writes its decision + reasoning to the execution log.

## Legend
- `[ ]` todo · `[~]` in progress · `[x]` done
- **Owner:** A / B (fill in names) — suggested split noted per week
- **~L:** rough target line count (keep under 400)

---

## Week 1 — Orchestrator (the spine)
**Goal:** a real orchestrator drives every invoice strategy → draft → gate → send →
reconcile, with the unpaid loop. Deterministic draft + mock sender for now.
**Suggested owner:** A (B starts GCP setup + Week-2 prompt work in parallel)

New module: `src/settl/orchestrator/`

- [ ] `orchestrator/result.py` — **~60** — `PipelineResult` / `PipelineStep` dataclasses describing what happened to one invoice end-to-end.
- [ ] `orchestrator/pipeline.py` — **~180** — the routing spine: run strategy, branch on SKIP/HOLD/REVIEW/CHASE, on CHASE call draft → gate → sender, return a `PipelineResult`. No SDK here — pure coordination over injected agents.
- [ ] `orchestrator/loop.py` — **~80** — re-queue / next-touch decision after a run (skeleton now; fleshed out in Week 4 with reconcile).
- [ ] 🔌 `orchestrator/runtime.py` — **~120** — Agent Builder + ADK wiring on **Gemini 3 Flash** ("is this actionable / what's next"); isolated so it can be mocked/swapped.
- [ ] `orchestrator/__init__.py` — **~15** — public exports (`Orchestrator`, `PipelineResult`).
- [ ] Refactor `demo.py` — **~70** — call the orchestrator instead of its own ad-hoc loop.
- [ ] `tests/test_orchestrator.py` — **~120** — all 25 synthetic invoices run end-to-end; loop-back fires for unpaid; every hop logged.
- [ ] `docs/gcp_setup.md` (B) — project, auth, ADK install, enabled APIs.

**Done when:** orchestrator routes all 25 invoices end-to-end, terminal states are
correct, the unpaid loop re-queues, and the audit log captures every hop.

---

## Week 2 — Drafting agent (Gemini 3 Pro) — *the visible AI*
**Goal:** replace the benign template stand-in with real customer-voice generation that
flows straight into the gate. **Suggested owner:** B (A continues orchestrator hardening)

New module: `src/settl/agents/drafting/`

- [x] `drafting/prompt.py` — **~140** — build the customer-voice prompt from `Invoice` + `StrategyDecision` (tone, the_ask, late-fee flag, channel); pure string building, unit-testable. *(141 lines; adds `safe_fallback()` shared with NoOp model.)*
- [x] 🔌 `drafting/model.py` — **~90** — `DraftModel` Protocol + `NoOpDraftModel` (returns a safe template) + `GeminiDraftModel` (Gemini 3 Pro call). Mirrors the strategy `model.py` seam pattern. *(Gemini call is a deferred seam — wire against context7 docs once GCP exists, like `runtime.py`.)*
- [x] `drafting/grounding.py` — **~80** — light Vertex AI Search seam for customer voice/context; `NoOpGrounding` default now, real lookup later. *(`VertexSearchGrounding` is a deferred seam.)*
- [x] `drafting/agent.py` — **~90** — `DraftingAgent.draft(invoice, decision) → DraftedMessage`; calls grounding + model, logs the decision, returns the message for the gate.
- [x] `drafting/__init__.py` — **~15** — exports.
- [x] Wire into `orchestrator/pipeline.py` — drafting replaces the template on the CHASE path. *(DraftingAgent is now the default drafter; a `drafting` step is recorded in the trace.)*
- [x] `tests/test_drafting.py` — **~120** — prompt-building tests + the **adversarial test**: a draft that strays into a legal threat / consumer-debt phrasing gets ESCALATED by the gate, not sent. *(10 tests; gate proven to decide at the gate directly AND end-to-end through the orchestrator.)*

**Done when:** a Gemini-generated draft passes the gate on a clean B2B chase, and a
deliberately bad prompt is caught and escalated. **The gate, not the LLM, decides.**

---

## Week 3 — Gemini judgment seam + gate hardening
**Goal:** let Gemini 3 Pro *refine* strategy within policy bounds — never override it or
the gate. **Suggested owner:** A on judgment+bounds, B on red-team

Extends `src/settl/agents/strategy/` (Protocol already exists in `model.py`)

- [ ] 🔌 `agents/strategy/judgment.py` — **~110** — `GeminiJudgmentModel` implementing the existing `JudgmentModel` Protocol; nudges tone/timing only.
- [ ] `agents/strategy/bounds.py` — **~80** — safety wrapper that clamps any model output: it may adjust tone/timing/late-fee, but **can never change `action`** (no SKIP/REVIEW→send) and never touches the gate.
- [ ] Wire `bounds` around `judgment` in `agents/strategy/agent.py` (model output always passes through the clamp).
- [ ] `tests/test_judgment.py` — **~110** — model refines a CHASE's tone; tests prove it cannot flip an escalation/skip into a send and cannot bypass the gate.
- [ ] `tests/test_gate_redteam.py` (B) — **~120** — adversarial messages (paraphrased threats, indirect overclaims, tone breaches) all ESCALATE; expand `compliance/patterns.py` only if a real gap is found.

**Done when:** judgment improves drafts/tone on the happy path, and no test can make the
model produce a send that the deterministic policy/gate would have blocked.

---

## Week 4 — Reconcile agent + loop closure
**Goal:** detect payment, record the fee (never custodial), loop unpaid, escalate on
reply. **Suggested owner:** A on reconcile, B on event fixtures + orchestrator loop

New module: `src/settl/agents/reconcile/`

- [ ] `reconcile/payment.py` — **~120** — pure: given invoice + payment/reply events, re-verify status → `PAID | PARTIAL | UNPAID | REPLY`; never chase the already-paid.
- [ ] `reconcile/fee.py` — **~70** — success-fee **record** (5–10% config) + `FeeRecord` dataclass; explicitly records, never collects (not custodial).
- [ ] `reconcile/agent.py` — **~100** — `ReconcileAgent.reconcile(invoice, events) → ReconcileOutcome`; logs; decides stop / re-queue / escalate.
- [ ] `reconcile/__init__.py` — **~15** — exports.
- [ ] Flesh out `orchestrator/loop.py` — next-touch scheduling, re-queue unpaid, stop on paid, escalate on inbound reply.
- [ ] `data/synthetic_events.json` + loader hook — **~60** — payment + reply events to drive reconcile against the existing 25 invoices.
- [ ] `tests/test_reconcile.py` — **~130** — paid → fee recorded + loop stops; unpaid → re-queued; partial → handled; reply → escalated.

**Done when:** the full loop closes — a paid invoice exits with a recorded fee, an unpaid
one re-enters the orchestrator, and a reply escalates to a human.

---

## Week 5 — Execution log → Agent Engine
**Goal:** move the audit trail onto Agent Engine observability and make evidence
exportable for the submission. **Suggested owner:** B (A starts Week-6 e2e wiring)

Extends `src/settl/audit/`

- [ ] `audit/sink.py` — **~50** — `LogSink` Protocol so `ExecutionLog` can target local JSONL *or* Agent Engine (dependency injection; keeps local as the test/offline default).
- [ ] Refactor `audit/execution_log.py` — route writes through a `LogSink` (no behavior change for existing tests).
- [ ] 🔌 `audit/agent_engine.py` — **~120** — Agent Engine sink implementing `LogSink`.
- [ ] `audit/export.py` — **~90** — export traces/evidence (the agent-execution logs the submission requires + sales proof).
- [ ] `tests/test_agent_engine.py` — **~90** — recording to a mocked Agent Engine client; export round-trips.

**Done when:** a full synthetic run produces Agent Engine traces, local JSONL still works
offline, and evidence exports cleanly.

---

## Week 6 — End-to-end demo + red-team + polish
**Goal:** one clean recorded run through the *real* stack for the 3-min video.
**Suggested owner:** A + B together (buffer week for slippage)

- [ ] `orchestrator/trace.py` — **~110** — pull the decision-trace table formatting out of `demo.py` into a reusable formatter (keeps `demo.py` under cap).
- [ ] `demo_full.py` — **~90** — full real-stack run (Gemini draft + judgment + gate + reconcile + Agent Engine logs).
- [ ] `tests/test_e2e.py` — **~130** — system invariants on the real stack (SDK mocked): no consumer/disputed invoice ever sent, paid never chased, ≥1 legitimate send, every invoice logged.
- [ ] Red-team pass against the live drafting agent (extend `tests/test_gate_redteam.py`).
- [ ] Demo polish: the "AI knows when *not* to act" narrative in the trace output.

**Done when:** a single recorded run shows the AI drafting, the gate blocking the unsafe
ones, sends going out, payment reconciling — all in the audit trail.

---

## Contingent track — unlock when the first pilot signs (DESIGN §5 step 6)
**Not week-pinned.** Built behind the clean adapter/sender boundaries, so going live is a
small contained swap, not a rewrite. Pre-build against **Stripe test mode** in the Week-7
buffer so the live flip is config-only.

New module: `src/settl/adapters/`

- [ ] `adapters/base.py` — **~80** — shared adapter helpers + `Adapter` Protocol (field-map → canonical, dates → ISO, money → Decimal, status → enum).
- [ ] `adapters/csv_adapter.py` — **~140** — universal CSV export → canonical `Invoice`; validate + quarantine. (Build first — unblocks any pilot.)
- [ ] 🔌 `adapters/stripe_adapter.py` — **~160** — live Stripe pull → canonical `Invoice`.
- [ ] `adapters/__init__.py` — **~15** — exports.
- [ ] `tests/test_csv_adapter.py` — **~110** — real-world-messy CSV maps correctly; bad rows quarantine.
- [ ] `tests/test_stripe_adapter.py` — **~110** — Stripe test-mode payload maps correctly.

Real sending: `src/settl/sending/`

- [ ] `sending/base.py` — **~50** — `Sender` Protocol shared by mock + real (mock already refuses ESCALATE; real senders inherit that guarantee).
- [ ] 🔌 `sending/email_sender.py` — **~110** — real email send behind the `Sender` interface.
- [ ] 🔌 `sending/sms_sender.py` — **~110** — real SMS send behind the `Sender` interface.
- [ ] `tests/test_real_senders.py` — **~90** — refuses ESCALATE; sends on PASS (provider mocked).

---

## Suggested two-person split
- **A (orchestration/core):** Week 1 orchestrator, Week 3 judgment+bounds, Week 4 reconcile, Week 6 e2e.
- **B (AI/IO):** Week 2 drafting, Week 3 gate red-team, Week 5 Agent Engine, GCP setup, contingent adapters.
- Weeks 2–4 parallelize cleanly once the Week-1 orchestrator exists.

## Out of scope here (tracked elsewhere — DESIGN §8)
Entity/OPT question (gates real revenue), cold-acquisition playbook, stat verification,
the video + narrative + revenue/customer evidence. Engineering plan only, as agreed.
