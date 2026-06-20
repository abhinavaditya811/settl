# Settl - The Complete Study Guide
*Understanding every folder, file, and design decision in the repo, written for a data scientist learning software engineering.*

---

## 1. The 30-second pitch (know this cold)

Settl is an **autonomous outreach & recovery engine**: an AI agent that gets freelancers and small businesses paid by chasing overdue invoices. For each invoice it decides *whether* to chase, *when*, on *what channel*, in *what tone* - drafts a message, passes it through a hard **compliance gate**, and only then "sends" it (mocked for now). Every decision is written to an audit log.

The business model: success fee (5-10% of recovered cash), B2B debts only, first-party only (you collect in the business's own name, never as a third-party debt collector - that keeps you out of FDCPA / debt-collector licensing territory). It's being built for a 90-day hackathon, and the same engine is designed to later be pointed at **grant outreach** as a config change, not a rewrite.

---

## 2. The big idea behind the architecture (the one sentence that explains everything)

> **Normalize at the edge, reason over a canonical form, and put one deterministic safety gate between the AI and the outside world.**

Three principles flow from this, and almost every file in the repo exists to serve one of them:

1. **Canonical schema.** Raw invoice data (CSV, Stripe, whatever) is converted by an *adapter* into ONE fixed `Invoice` shape. Every agent only ever reads that shape. Adding a new data source = writing one new adapter. No agent ever special-cases "if this came from Stripe…". (DS analogy: it's exactly like having one feature schema that all your models consume, with all the messy ETL isolated in the ingestion layer - you'd never let a model read raw logs directly.)

2. **Deterministic decision core, LLM later.** The strategy logic is plain Python rules, fully unit-testable, no API key, no cost, no randomness. There's a *seam* (an interface) where Gemini will later plug in to *refine* decisions - but the LLM can never override the rules or the gate.

3. **The compliance gate is the single safety authority.** It's deliberately NOT an LLM - it's regex pattern matching plus boolean checks, because a safety boundary must be predictable and auditable. Any single rule firing = the message is blocked and escalated to a human.

---

## 3. Top-level files (the repo's "front door")

### `README.md`
The contributor's map. What the project is, how to run it (`make setup / test / demo`), the pipeline flow diagram, the repo structure, conventions, a status table, and a **session log** updated after every work session so anyone (including future-you) knows where to pick up. Lesson: a README is for *humans joining the project*, not marketing.

### `CLAUDE.md`
This is a convention from **Claude Code** (the AI coding agent): a file the coding agent reads at the start of every session containing the *durable, non-negotiable rules* - the architecture invariants, the canonical schema, the compliance rules, the file-size cap (300-400 lines max per file), build conventions. Think of it as "the constitution the AI must obey on every change." It's kept lean on purpose: rules here, reasoning elsewhere.

### `DESIGN.md`
The *why* document. Market reasoning (why collections before grants), pricing decisions, the architecture diagram, the agent → Google Cloud mapping (Agent Builder + ADK, Gemini 3 Flash for routing, Gemini 3 Pro for judgment, Agent Engine for logs), the 6-phase build sequence, the grants roadmap, and the hackathon submission checklist. The CLAUDE.md/DESIGN.md split is itself a lesson: **separate the "what you must do" from the "why we chose it"** so the rules file stays short enough to actually be obeyed.

### `pyproject.toml`
Modern Python's single project config file (replaces the old `setup.py` + `requirements.txt` combo). It declares: the package name and version, `requires-python >= 3.11`, the single runtime dependency (**pydantic** - for data validation), an optional `dev` dependency group (**pytest**), where to find the package code (`where = ["src"]`), and pytest config (`testpaths = ["tests"]`, `pythonpath = ["src"]`). When you run `pip install -e .`, pip reads this file. The `-e` means "editable install" - your code changes apply instantly without reinstalling.

### `Makefile`
Three one-line shortcuts so nobody has to remember commands: `make setup` (create a virtualenv + install), `make test` (run pytest), `make demo` (run demo.py). A Makefile is the project's "buttons" - any contributor on any machine runs the exact same commands.

### `demo.py`
A ~70-line script that loads all 25 synthetic invoices, runs each through strategy → gate → mock sender, and prints a decision table (which I ran - see §8). It exists because the hackathon needs *demonstrable* evidence of the AI making decisions. The drafting agent doesn't exist yet, so it uses a fixed benign template string as a stand-in draft.

### `.gitignore`
Tells git which files to never commit: `.venv/`, `__pycache__/`, etc. Generated junk stays out of the repo.

---

## 4. The `src/` layout (the structural lesson you asked about)

The code lives at `src/settl/`, NOT at the repo root. This is called the **src layout** and it's deliberate:

- When the package sits at the root, Python can accidentally import your *uncommitted local files* instead of the *installed package*, hiding packaging bugs. Putting it under `src/` forces you to properly install the package (`pip install -e .`), so your tests run against the code exactly as a user would get it.
- It also cleanly separates "the product" (`src/`) from "the scaffolding" (tests, docs, config) at a glance.

Every folder under `src/settl/` has an `__init__.py`. Two things to know about these files:
1. Their *existence* marks a folder as an importable Python **package**.
2. Their *contents* re-export the folder's public names (e.g. `schema/__init__.py` imports `Invoice` from `invoice.py` and lists it in `__all__`). That lets callers write `from settl.schema import Invoice` instead of digging into internal file paths - the `__init__.py` is the folder's **public API**, and everything not exported there is considered internal.

---

## 5. Folder by folder, file by file

The pipeline order is: **schema → data → agents/strategy → compliance → sending → audit**. Read the code in that order.

### `src/settl/schema/` - the canonical data layer ("read this first")

**`invoice.py` (98 lines).** Defines the one `Invoice` shape using **pydantic** models. Key contents:

- Four small **enums** (fixed sets of allowed values): `Source` (stripe/csv/quickbooks/pdf), `InvoiceStatus` (open/paid/partial/disputed), `Channel` (email/sms), `ContactDirection` (outbound/inbound). Enums mean a typo like `"dispted"` fails loudly at load time instead of silently misbehaving later.
- `PriorContact` - one historical touch on an invoice (date, direction, channel, summary text).
- `Invoice` itself, with three structural tricks worth memorizing:
  1. **`model_config = ConfigDict(frozen=True)`** - the model is **immutable**. Once created, nobody can mutate an invoice mid-pipeline. (There's a test proving that assignment raises an error.) Immutability kills a whole class of bugs where some function quietly changes shared data.
  2. **`days_overdue` is a `@computed_field`** - it is *derived* from `due_date` and `as_of_date` (the reference "today" that the adapter sets). It literally cannot be set from source data. So a data source that lies about how late a payment is *cannot* mislead the agents. This enforces the CLAUDE.md rule "recompute derived fields, never trust the source" *in the type system itself* rather than just in documentation.
  3. **Convenience `@property`s** - `has_phone`, `outbound_contacts`, `is_new_debtor` (no prior outbound touch → first contact → will need human approval). Putting these on the model means every agent computes them the same way; logic lives in one place.
  - Also note `amount_due` is a `Decimal`, not a float - you never use floats for money (floating-point rounding errors on currency are a classic bug).
  - `raw: dict` keeps the original source blob untouched, for debugging and audit.

**`validation.py` (64 lines).** The **validate + quarantine** step. `validate_invoice()` returns a list of `ValidationIssue(field, message)` objects - empty list means actionable. It checks: positive amount, a contact that actually looks like an email/phone, non-blank debtor name, due date not before issue date. `partition_invoices()` splits a batch into `(actionable, quarantined_with_reasons)`. Crucial design choice: this is a **soft gate** - it *returns* issues instead of *raising* exceptions, so one bad row never crashes a whole batch. Bad invoices get flagged to a human ("couldn't read this invoice"); the system never guesses a missing field.

### `src/settl/data/` - the synthetic dataset + its loader

**`synthetic_invoices.json`.** 25 hand-crafted fake invoices plus one `reference_date` ("2026-06-08" - the frozen "today" all tests use, so tests are reproducible forever instead of breaking as real time passes). Each record's `raw.edge_case` field documents which scenario it exists to test: first-time client slightly overdue, repeat late-payer, a consumer (non-B2B) debt that MUST trip the gate, a disputed invoice, one already paid, one malformed (zero amount + no contact → quarantine), a not-yet-due one, a contact-frequency burst, an inbound payment-plan request, an inbound dispute reply, etc. This is the build sequence's "decision core first" philosophy: you can prove the entire engine on fake data before touching a real customer.

**`loader.py` (39 lines).** Reads the JSON and emits canonical `Invoice` objects. It's explicitly a **stand-in adapter** - it plays the role that the real CSV/Stripe adapters will play later, and nothing downstream knows the source was a fixture file. Two details:
- `@lru_cache(maxsize=1)` on the raw file read - the file is read from disk once, then cached (memoization, same idea as caching an expensive computation).
- The defensive line: `record = {k: v for k, v in record.items() if k != "days_overdue"}` - even if a source *tries* to assert days_overdue, the loader strips it. Belt and suspenders on top of the schema-level protection.

### `src/settl/agents/strategy/` - the decision core

Three files implementing one agent - and the *reason* it's three files is the most important structural lesson in the repo:

**`policy.py` (158 lines) - the pure brain.** One function, `decide_strategy(invoice) → StrategyDecision`. **Pure** means: no side effects, no network, no logging, no randomness - same input always gives same output. That's what makes it trivially unit-testable. Contents:

- Tunable thresholds as named constants at the top (`FRIENDLY_MAX_DAYS = 14`, `FIRM_MAX_DAYS = 44`, `LATE_FEE_MIN_DAYS = 15`, `TOO_SOON_DAYS = 2`, `RECENT_WINDOW_DAYS = 7`, `RECENT_TOUCH_LIMIT = 3`) - no magic numbers buried in logic.
- `Action` enum - the four possible outcomes. **Memorize these:**
  - **SKIP** - nothing to do (already paid, or not yet due)
  - **HOLD** - actionable, but not right now (last touch too recent, or too many touches this week - cooldown)
  - **REVIEW** - send to a human now (disputed invoice, or consumer/non-B2B debt)
  - **CHASE** - proceed: pick tone + channel + late-fee, go to drafting and the gate
- `Tone` enum - friendly_reminder / firm_reminder / final_notice.
- `StrategyDecision` - a frozen dataclass carrying the action, a human-readable `reasoning` string, channel, tone, `include_late_fee`, `the_ask`, an `escalation_hint`, `next_touch_in_days` (for HOLD), and a `factors` dict (the inputs that drove the decision - for the audit log).
- The **6 numbered rules**, in priority order (the comments literally number them - "the rules ARE the strategy"):
  1. Paid → SKIP (never chase money that already landed)
  2. Not yet overdue (`days_overdue <= 0`) → SKIP
  3. Disputed → REVIEW
  4. Consumer (non-B2B) → REVIEW
  5. Cooldown/frequency (last touch < 2 days ago, or ≥ 3 touches in last 7 days) → HOLD
  6. Healthy chase → tone by overdue-ness (≤14d friendly, 15-44d firm, ≥45d final notice); late fee only if contract allows it AND ≥15 days overdue; channel = whatever channel the last touch used, else SMS if there's a phone, else email.
- A subtle but important note in the docstring: **strategy recommends; it is NOT the safety authority.** Strategy pre-flags the obvious escalations so the reasoning trail is complete, but only the gate clears sends.

**`model.py` (32 lines) - the seam.** Defines `JudgmentModel`, a `Protocol` (Python's version of an interface - any class with a matching `refine(invoice, decision) → decision` method satisfies it, no inheritance needed). Ships `NoOpModel`, which just returns the decision unchanged. This is the slot where **Gemini 3 Pro plugs in later** to *refine* tone/timing within policy bounds - with the explicit contract that the model may never flip a SKIP/REVIEW into a send and never substitutes for the gate. This pattern - define the interface now, ship a do-nothing default, wire the real thing later - is how you keep a codebase testable and free of API keys during development. (DS analogy: like building your pipeline around a baseline model first, with a clean predict() interface the fancy model later drops into.)

**`agent.py` (37 lines) - the thin wrapper.** `StrategyAgent.decide()` does three things: call the pure policy, let the model refine, write the decision + reasoning to the execution log. Note the constructor: `StrategyAgent(log=..., model=...)` - both collaborators are **passed in** rather than created inside. That's **dependency injection**: tests can pass a fresh log or a fake model, and the agent doesn't care. Also note the policy/agent split itself: pure logic in one file, side effects (logging) in another. That's **separation of concerns** - you can test the brain without the plumbing.

### `src/settl/compliance/` - the safety boundary (deterministic, NOT an LLM)

Three files, again split by responsibility - and the split *is* the convention: **phrases live in `patterns.py`, rules live in `rules.py`, orchestration lives in `gate.py`. Never inline a compliance check anywhere else in the codebase.**

**`patterns.py` (102 lines) - the phrase lists.** Six lists of regex patterns, matched case-insensitively on word boundaries:
- `LEGAL_THREAT` - "sue", "lawsuit", "collections", "attorney", "garnish", "lien", "we'll report you"…
- `UNENFORCEABLE_CONSEQUENCE` - "credit score", "blacklist", "seize", "repossess", "criminal charges"…
- `LEGAL_ADVICE` - "you are legally required", "by law you must"…
- `TONE_BREACH` - insults, "pay now or else", "stop ignoring us"…
- `INBOUND_DISPUTE` - phrases in a *debtor's reply* signaling a dispute ("don't owe", "never received", "wrong amount")
- `INBOUND_PAYMENT_PLAN` - "payment plan", "installments", "can't pay right now"…

The stated philosophy (memorize this - it's the kind of thing Bob would quiz): **in a safety gate, a false positive is cheap (a fine message goes to a human for a tap), a false negative is the failure we will not accept (a legal threat auto-sends).** So the patterns are deliberately broad and conservative. Patterns are pre-compiled once at import time (`_compile`) for speed, and `matches()` returns the actual matched substrings so escalation reasons are human-readable.

**`rules.py` (170 lines) - one function per rule.** Each rule returns a list of `RuleViolation(code, message)` - empty list means clean. Two groups:

*Invoice/state rules* (always run, message or not):
- `rule_consumer_debt` → code **B2B_ONLY** (if `is_b2b` is False - FDCPA exposure)
- `rule_disputed` → **DISPUTED** (status enum says disputed)
- `rule_inbound_dispute` → **DISPUTE_RAISED** (scans the *text of inbound replies* for dispute phrases - catches disputes even when status still says "open")
- `rule_payment_plan_request` → **PAYMENT_PLAN_REQUEST** (never auto-negotiate)
- `rule_contact_frequency` → **FREQUENCY_LIMIT** (≥3 outbound touches in 7 days)
- `rule_first_contact` → **FIRST_CONTACT_APPROVAL** (pilot-mode human-in-the-loop: the first-ever message to a new debtor always needs one-tap human approval)

*Message-content rules* (run only when a drafted message is supplied):
- `rule_legal_threat` → **LEGAL_THREAT**
- `rule_unenforceable_consequence` → **UNENFORCEABLE_CONSEQUENCE**
- `rule_legal_advice` → **LEGAL_ADVICE**
- `rule_tone_bounds` → **TONE_BREACH**

The convention to remember: **adding a rule = adding a function here + registering it in gate.py.** The function names read as a checklist of the CLAUDE.md compliance list.

**`gate.py` (96 lines) - the collector.** `ComplianceGate.evaluate(invoice, message=None)` runs all invoice rules, plus all message rules if a message was supplied, collects every violation, and emits a single binary `ComplianceResult`: **PASS** (zero violations) or **ESCALATE** (one or more). It does NOT short-circuit on the first violation - it collects *all* of them, so the human reviewing sees every reason at once. Every evaluation is logged. The two rule tuples (`_INVOICE_RULES`, `_MESSAGE_RULES`) are the registration point.

### `src/settl/sending/` - the (mock) last mile

**`mock_sender.py` (60 lines).** Never contacts a real channel - it logs exactly what it *would* send ("would send: to=… via=email :: <message>"). The important design detail: **it refuses to send on an ESCALATE result even if a caller wires the pipeline up wrong.** The gate is the authority, but the sender double-checks. That's **defense in depth** - two independent layers both have to fail for a bad message to go out. Returns a `SendOutcome(sent: bool, detail: str)`.

### `src/settl/audit/` - the evidence layer

**`execution_log.py` (67 lines).** An append-only `ExecutionLog`. Every entry is a frozen `LogEntry`: UTC timestamp, invoice_id, which agent ("strategy" | "compliance_gate" | "sender"), a machine-readable decision, a human-readable reasoning string, and a details dict. Kept in memory, optionally mirrored to a **JSONL** file (one JSON object per line - append-friendly, streamable; the standard format for logs). Helpers: `for_invoice(id)` filters one invoice's full trail; `to_json()` serializes everything. Per CLAUDE.md, this log does **triple duty**: compliance audit trail + sales proof ("recovered $3,200, here's exactly what the AI did and why") + the hackathon's required agent-execution evidence. Logging is *required*, not optional - that's why every agent takes a `log` parameter.

---

## 6. `tests/` - what each test file proves

28 tests total, 4 files, mirroring the source structure (standard convention: `tests/test_<module>.py`). They all run against the synthetic dataset - no mocks of the data needed because the data IS the fixture.

**`test_schema.py` (5 tests).** The data-layer guarantees: dataset loads exactly 25 invoices; `days_overdue` is computed (INV-001: due June 1, reference date June 8 → exactly 7) and never carried by the fixture; a future due date gives *negative* overdue; the Invoice model is immutable (mutating raises); the malformed invoice INV-011 lands in quarantine with issues naming the exact bad fields (`amount_due`, `debtor_contact`) - flagged, never guessed.

**`test_strategy.py` (8 tests).** One test per policy behavior: paid → SKIP; not-yet-due → SKIP; first-time slightly-overdue → CHASE + friendly + no fee + `first_contact` hint; repeat late-payer → firm + fee; 100-days-overdue → final notice via SMS (mirrors the last touch's channel); consumer and disputed → REVIEW; 3-touch burst → HOLD; and decisions are logged with non-empty reasoning.

**`test_compliance_gate.py` (11 tests).** The safety proofs. The two *headline* tests (these are the project's main demo claims): **consumer debt escalates with B2B_ONLY and the sender refuses to send it**, and **disputed invoice escalates with DISPUTED and is not sent**. Then one test per remaining rule (payment plan, inbound dispute on an open invoice, frequency, first-contact approval, legal threat, unenforceable consequence, legal advice) - each feeding a crafted message or the matching synthetic invoice and asserting the right violation code appears. Critically, there's also the inverse test: **a clean B2B repeat-payer message PASSES and "sends"** - a gate that blocks everything is useless, so you must prove it lets legitimate traffic through.

**`test_decision_core.py` (4 tests).** End-to-end: run ALL 25 invoices through the full pipeline (strategy → stand-in draft → gate → mock sender, all logged) and assert system-level invariants: *no* consumer or disputed invoice is ever sent; paid invoices are never chased (including INV-014, which is consumer AND paid - skip wins because rule 1 fires first); at least one legitimate invoice (INV-018) does get sent; and every processed invoice produced audit-log entries that serialize to JSON.

Testing lessons embedded here: each test has **one clear assertion theme** and a name that reads as a sentence; tests are short (the whole suite is ~285 lines across 4 files - your "no 100/200-line test files" point); shared setup goes into tiny helpers (`_by_id()`, `_run_pipeline()`); unit tests (policy, rules) and integration tests (full pipeline) are separated; and the suite runs in 0.21 seconds, which is what makes people actually run it.

---

## 7. The flow, end to end (trace one invoice in your head)

```
raw record (JSON fixture, later CSV/Stripe)
   │  loader/adapter - maps fields to canonical shape, sets as_of_date
   ▼
Invoice (canonical, frozen, days_overdue computed)
   │  validate_invoice / partition_invoices - incomplete → QUARANTINE (human)
   ▼
StrategyAgent.decide → policy's 6 rules → SKIP | HOLD | REVIEW | CHASE
   │  (CHASE only)
   ▼
[drafting agent - NOT BUILT YET; a benign template stands in]
   ▼
ComplianceGate.evaluate(invoice, message) → runs 6 invoice rules + 4 message rules
   │  PASS                              │  ESCALATE (any violation)
   ▼                                    ▼
MockSender "would send"            human review queue
   ▼
[reconcile - NOT BUILT YET]
   
…and every box above wrote a LogEntry to the ExecutionLog.
```

Live results from the demo I ran on all 25 invoices: 10 would-send (clean B2B chases like INV-002, the 30-day repeat late-payer), 5 escalated CHASEs withheld (4 first-contact approvals + 1 inbound dispute caught on an "open" invoice - INV-024), 4 REVIEWs (consumer/disputed), 4 SKIPs (paid / not due), 1 HOLD (touched yesterday), 1 quarantined (INV-011, unreadable). 60 audit-log entries. The fact that more messages were *withheld/escalated* than *sent* is the point - the demo's story is "the AI knows when NOT to act."

---

## 8. What exists vs. what doesn't (so you don't overclaim to Bob)

Done: schema + validation/quarantine, 25-invoice synthetic dataset, deterministic strategy agent (Gemini seam stubbed with NoOp), full compliance gate, mock sender, local execution log, 28 passing tests, demo script.

Not built yet (later phases per DESIGN §5): the **orchestrator** (routing), the **drafting agent** (Gemini writing messages in the customer's voice), the **reconcile agent** (detecting payment, billing the fee, looping), real **CSV/Stripe adapters**, real email/SMS sending, and the **Agent Engine** hookup for logs. Real integrations are deliberately last - only once a pilot is signed.

---

## 9. The vocabulary list (the quiz-proof section)

- **src layout** - package under `src/` so tests run against the *installed* package, not stray local files.
- **`__init__.py`** - marks a package; its re-exports define the folder's public API.
- **pyproject.toml** - single modern config: metadata, dependencies, build system, tool settings.
- **editable install (`pip install -e .`)** - code changes take effect without reinstalling.
- **pydantic** - library that validates data into typed models at load time; bad data fails loudly at the boundary.
- **enum** - fixed set of allowed values; typos become errors instead of silent bugs.
- **frozen / immutable model** - can't be mutated after creation; eliminates shared-mutable-state bugs.
- **computed field** - derived value the type itself calculates; sources literally cannot set it.
- **Decimal for money** - never floats for currency.
- **adapter pattern** - per-source translator into one canonical shape; new source = new adapter, zero agent changes.
- **validate + quarantine (soft gate)** - return issues instead of raising; bad rows flag to a human, never crash the batch, never get guessed.
- **pure function** - no side effects; same input → same output; trivially testable. (`decide_strategy`)
- **separation of concerns** - policy (logic) / agent (wiring+logging) / model (LLM seam) in separate files.
- **dependency injection** - collaborators passed into constructors (`StrategyAgent(log=…, model=…)`) so tests can substitute them.
- **Protocol / seam** - an interface defined now with a no-op default, so the real LLM plugs in later without refactoring.
- **deterministic safety gate** - regex + boolean rules, NOT an LLM, because the safety boundary must be predictable and auditable.
- **false positive vs. false negative asymmetry** - in a safety gate, FP is cheap (human taps approve), FN is unacceptable (legal threat auto-sends) → patterns are deliberately broad.
- **defense in depth** - the sender independently refuses ESCALATE results even though the gate already blocked them.
- **human-in-the-loop** - first contact to any new debtor always requires one-tap human approval (pilot mode).
- **append-only log / JSONL** - one JSON object per line; the audit trail = compliance + sales proof + submission evidence.
- **lru_cache** - memoize an expensive call (the dataset file read).
- **fixture + frozen reference date** - synthetic data anchored to a fixed "today" so tests reproduce forever.
- **unit vs. integration tests** - per-function rule tests vs. the full-pipeline invariant tests in `test_decision_core.py`.
- **file-size cap (300-400 lines)** - split along functional seams (one module = one responsibility you can state in a sentence), never mid-logic, never into a junk-drawer `utils`.
- **CLAUDE.md** - the durable rule file an AI coding agent obeys every session; lean by design.

---

## 10. If you had to rebuild something like this from scratch - the recipe

1. **Write CLAUDE.md/DESIGN.md first.** Decide the invariants (canonical schema, the safety boundary, what the AI may never do) before writing code.
2. **Scaffold:** `pyproject.toml`, `Makefile`, `src/<pkg>/` with empty packages, `tests/`, `.gitignore`, README.
3. **Schema first.** Define the canonical pydantic model with enums, frozen config, and computed derived fields. Add validate + quarantine.
4. **Synthetic dataset.** 20-30 records, each engineered to hit one edge case, anchored to a frozen reference date. Write the loader as a stand-in adapter.
5. **Pure decision core.** Numbered rules in one pure function; thresholds as named constants; a frozen decision dataclass with a reasoning string.
6. **Safety gate.** Patterns file → one-function-per-rule file → collector gate. Binary output. Conservative by design.
7. **Thin wrappers + logging.** Agent classes that inject the log and the (no-op) model seam.
8. **Tests mirroring the structure**, including the inverse test (clean input passes) and end-to-end invariants.
9. **A demo script** that makes the decisions visible in one table.
10. **Only then** wire real adapters, the LLM, and real sending - last, behind the proven core.
