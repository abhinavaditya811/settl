# Settl

> Autonomous outreach & recovery engine — an AI agent that gets freelancers and small
> businesses paid by chasing overdue invoices: it decides timing, tone, and channel, drafts
> in the customer's voice, clears a hard compliance gate, sends, and reconciles the outcome.

We prove the engine on **collections**; the same engine later extends to grant outreach
(roadmap, not v1).

- **`CLAUDE.md`** — the durable rules every change must obey (schema, compliance, file caps). Read first.
- **`DESIGN.md`** — the *why*: reasoning, build sequence, and roadmap.

This README is the contributor's map. We update the **Session log** at the bottom after every
work session.

---

## Quick start

```bash
make setup    # create .venv and install the project (one-time)
make test     # run the test suite
make demo     # print the decision-trace table for the synthetic dataset
```

No API keys are needed — the decision core is fully deterministic and runs offline.

---

## How it works (the flow)

Source data is **normalized at the edge** by a per-source adapter into one canonical `Invoice`
shape. Every agent reads only that canonical form — never a raw invoice. A **compliance gate**
sits between every draft and every send.

```
 raw source (CSV / Stripe / fixture)
        │  adapter  ── normalizes to canonical shape, computes days_overdue
        ▼
   Invoice (canonical)
        │  validate + quarantine ── unreadable invoices flag to a human
        ▼
   Strategy agent ── SKIP (paid/not due) · HOLD (too soon) · REVIEW (consumer/disputed) · CHASE
        │  (CHASE only)
        ▼
   Drafting agent ── writes the message   [NOT BUILT YET — tests use a benign stand-in]
        ▼
   Compliance gate ── PASS → send · ESCALATE → human review
        │
        ▼
   Sender (mocked: "would send …")  ──▶  Reconcile  [NOT BUILT YET]

 Every box writes its decision + reasoning to the execution log (audit trail / evidence).
```

The architectural invariant: **adding a new source = a new adapter emitting the canonical
shape.** Orchestrator, strategy, drafting, and compliance logic never special-case a source.

---

## Repo structure

```
src/settl/
├── schema/          # the canonical data layer — read this first
│   ├── invoice.py        Invoice model; days_overdue is COMPUTED, never trusted from source
│   └── validation.py     validate + quarantine ("couldn't read this invoice")
├── data/            # synthetic dataset (building/testing ONLY — never customer evidence)
│   ├── synthetic_invoices.json   25 invoices; each raw.edge_case says what it tests
│   └── loader.py                 stand-in adapter: raw → canonical, sets the reference date
├── agents/
│   └── strategy/    # the decision core
│       ├── policy.py     pure decide_strategy(invoice) — the 6 numbered rules ARE the strategy
│       ├── agent.py      thin wrapper that logs every decision
│       └── model.py      Gemini 3 Pro seam (NoOpModel for now)
├── compliance/      # the safety boundary — deterministic, NOT an LLM
│   ├── patterns.py       phrase lists the gate scans for
│   ├── rules.py          one function per CLAUDE.md rule (read the names as a checklist)
│   └── gate.py           collects violations → PASS / ESCALATE
├── sending/
│   └── mock_sender.py    logs "would send …"; refuses to send on ESCALATE
└── audit/
    └── execution_log.py  every decision + reasoning (audit trail / sales proof / evidence)

tests/               # 28 tests; test_decision_core.py is the clearest end-to-end picture
demo.py              # reproduces the decision-trace table
```

### Conventions for contributors
- **Each file is capped at 300–400 lines.** Split along clean functional seams, not mid-logic.
- **One module = one responsibility.** If you can't describe a file's job in a sentence, split it.
- **The compliance gate is the only thing that can clear a message to send.** Don't inline a
  compliance check anywhere else — add a function in `compliance/rules.py` and register it in `gate.py`.
- **Recompute derived fields; never trust the source.** `days_overdue` and `status` are ours.

---

## Status

| Phase (DESIGN §5) | State |
| --- | --- |
| 1. Schema + synthetic dataset | ✅ done |
| 2. Strategy agent + compliance gate (isolation-tested) | ✅ done |
| 3. Orchestrator (routing spine + unpaid loop) | ✅ done · drafting agent 🔜 next |
| 4. Execution log via Agent Engine | local stand-in done; Agent Engine 🔜 |
| 5. Sending — mocked | ✅ mocked |
| 6. Real adapters (CSV/Stripe) + live email/SMS | ⛔ only once a pilot is signed |

---

## Session log

Newest first. Each entry: what changed, and where to pick up.

### Session 5 — dashboard redesign (customer cockpit)
- Reworked the flat single-page dashboard into a multi-view app for the **paying
  customer**, minimal/restrained styling: sidebar app shell + four routes.
- **Overview** — money-first cockpit: KPI cards (outstanding / in-flight / recovered
  / awaiting you), an aging-by-age chart, an outcome breakdown, and a live "what the
  agent did" feed off the execution log.
- **Approvals** — focused inbox; the AI draft is **editable before sending** and the
  edit is re-run through the compliance gate (`approve_and_send` already re-gates).
- **Invoices** — searchable/filterable table + the decision-trace drawer.
- **Activity** — full audit feed, filterable by agent.
- Engine API gained `GET /metrics`, `GET /activity`, and an optional edited-message
  body on approve; `ExecutionLog.clear()` keeps the feed from double-counting on
  re-run. Shared client `BoardContext` drives every view. **56 Python tests pass**,
  `next build` clean.

### Session 4 — the dashboard (`web/`)
- Built the customer-facing dashboard: **Next.js 14 (App Router, TS) + styled-components**
  with a light/dark toggle and an SSR style registry (no FOUC). See `web/README.md`.
- Three views over the engine: the **invoice board** (summary stat cards + table),
  the **approval queue** (first-contact drafts with a working **Approve & Send** that
  calls the engine's `approve_and_send`), and a slide-over **decision trace** drawer
  (drafted message + per-hop audit timeline).
- The frontend never hits the engine directly — Next route handlers under `/api/*`
  proxy server-side to the FastAPI engine (`SETTL_API_BASE_URL`), keeping the URL off
  the browser. Header badge reflects mock vs. live-email mode.
- Verified end-to-end: `next build` clean (no TS errors), board/approve/trace all flow
  Next → FastAPI → engine. **52 Python tests still pass.**
- **Pick up next:** deploy (frontend → Vercel, engine → Cloud Run); optional polish
  (auto-refresh, filters); then SMS when ready. Drafting agent (Gemini) is still the
  open engine workstream (TASKS Week 2).

### Session 3 — real email send + engine API
- **Real Gmail self-test:** sent a live first-contact draft through the full pipeline
  to a real inbox (`runs/live_self_test.jsonl`), exercising the one-tap approval. All
  creds load from a gitignored `.env` (`src/settl/config.py`; template in `.env.example`).
- **FastAPI engine API** (`src/settl/api/`): `state.py` (`BoardState` runs the
  orchestrator in-process — board batch is always mock/safe; approvals send real email
  only when `SETTL_LIVE_SEND=1` + `SETTL_TEST_RECIPIENT`), `schemas.py` (JSON contract),
  `main.py` (routes: `/health`, `/invoices`, `/invoices/{id}`, `/invoices/{id}/trace`,
  `/invoices/{id}/approve`, `/refresh`). Optional deps: `pip install -e ".[api]"`.
  Run: `uvicorn settl.api.main:app --reload --port 8000`.
- **52 tests pass** (7 new API contract tests via TestClient).
- **Pick up next:** the `web/` Next.js (TS) + styled-components dashboard — board,
  approval queue (Approve & Send → `/approve`), and per-invoice decision trace.
  Frontend → Vercel; this API → Cloud Run.

### Session 2 — orchestrator (the spine)
- Built `src/settl/orchestrator/`: `result.py` (`PipelineResult`/`TerminalState`),
  `pipeline.py` (the routing spine over injected agents), `loop.py` (unpaid re-queue
  skeleton), `runtime.py` (NoOp Gemini-Flash triage seam), `__init__.py`.
- The spine routes every invoice: ingestion → strategy → (CHASE) draft → gate → send.
  First-contact is held as `AWAITING_APPROVAL` (one-tap), classified off the gate's
  `FIRST_CONTACT_APPROVAL` — the orchestrator never overrides the gate.
- Refactored `demo.py` into a **dry run**: decision-trace table + unpaid-loop plan,
  writing a full JSONL audit log to `runs/`. 25/25 invoices route correctly
  (10 sent · 4 awaiting approval · 6 escalated · 3 skipped · 1 held · 1 quarantined);
  85 audit entries. **37 tests pass** (9 new orchestrator tests).
- Scaffolded the **real email self-test** behind the shared `Sender` seam:
  `sending/base.py` (`GatedSender` — the "never send on ESCALATE" guarantee lives
  here once for all senders), `sending/email_sender.py` (`GmailSmtpSender`, all
  creds from env), and `Orchestrator.approve_and_send` (the one-tap human-approval
  action — the only path a first-contact message reaches the sender; the dashboard
  button will call it). `send_live.py` runs one invoice to your own inbox.
  **45 tests pass** (SMTP mocked — no creds needed to build/test).
- **Pick up next:** run the live email self-test (set `SETTL_SMTP_*` env vars),
  then the customer-facing dashboard over the audit log.

### Session 1 — decision core
- Built the canonical `Invoice` schema (with computed `days_overdue`), validate/quarantine,
  and the 25-invoice synthetic dataset covering every required edge case.
- Built the deterministic strategy agent (Gemini seam stubbed) and the full compliance gate.
- Mock sender + execution log wired in; **28 tests pass**, including the two headline proofs:
  consumer-debt and disputed-invoice escalate to a human instead of sending.
- **Pick up next:** orchestrator (routing) + drafting agent, around the proven core.
