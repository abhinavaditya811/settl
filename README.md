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
| 3. Orchestrator + drafting agent | 🔜 next |
| 4. Execution log via Agent Engine | local stand-in done; Agent Engine 🔜 |
| 5. Sending — mocked | ✅ mocked |
| 6. Real adapters (CSV/Stripe) + live email/SMS | ⛔ only once a pilot is signed |

---

## Session log

Newest first. Each entry: what changed, and where to pick up.

### Session 1 — decision core
- Built the canonical `Invoice` schema (with computed `days_overdue`), validate/quarantine,
  and the 25-invoice synthetic dataset covering every required edge case.
- Built the deterministic strategy agent (Gemini seam stubbed) and the full compliance gate.
- Mock sender + execution log wired in; **28 tests pass**, including the two headline proofs:
  consumer-debt and disputed-invoice escalate to a human instead of sending.
- **Pick up next:** orchestrator (routing) + drafting agent, around the proven core.
