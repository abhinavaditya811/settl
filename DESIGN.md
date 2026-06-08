# DESIGN.md — Settl

> The fuller context doc for the project. `CLAUDE.md` holds the lean, durable rules
> the coding agent enforces every session; this file holds the reasoning, the build
> sequence, and the roadmap. Read this when you need the *why*; read CLAUDE.md for the *what*.

---

## 1. What we're building

**Settl — an autonomous outreach & recovery engine.**

An AI agent that gets freelancers and small businesses paid: it decides timing, tone,
and channel for each overdue invoice, drafts the message in the customer's voice, clears
a hard compliance gate, sends, and reconciles the outcome — looping until the money lands
or a human takes over.

We prove the engine on **collections** (where money moves fastest and the AI's decisions
are most legible) and design it so the *same engine* can later point at **grant outreach**
(the mission) as a config + data-source change, not a rewrite.

**Primary category:** Money & Financial Access (recovering stranded receivables = working
capital / financial freedom for underserved operators).

---

## 2. Why this, and why not the alternatives

Decisions we've already made and shouldn't relitigate without new information:

- **One engine, one vertical, ship narrow.** Vertical depth beats horizontal breadth. A
  2-person team in 60 days has capacity to make *one* thing genuinely work + produce real
  revenue evidence.
- **Collections first, not grants.** Collections' superpower: *the money already exists*,
  so success-fee revenue is bankable in week 1. Grants is slow (months-long, speculative
  cycles), has a weaker "AI executes a decision" story, and we have no warm channel to
  researchers. Grants is **roadmap**, captured in the narrative, not built in the 60 days.
- **Success-fee pricing.** 5–10% of recovered cash, no monthly to start → frictionless
  pilot ask ("I only get paid if I recover yours"). Add a monthly base later for MRR.
- **First-party + B2B only.** Collect *for* the business, in its name, on business-to-business
  debts. This keeps us out of FDCPA / debt-collector licensing exposure. Never custodial —
  payment flows through the customer's own processor; we never touch the money.
- **No paid acquisition reliance.** The submission scrutinizes marketing spend as a viability
  check. Acquisition is via communities (r/freelance, r/smallbusiness), freelancer FB groups,
  and especially agency-partner / GoHighLevel distribution (one partner = many sub-accounts).

Killed/deferred: ad-campaign generation (creates demand = slow), full intake+scheduling
loop v1 (only earns when *new* clients show up = slow), grants as a v1 feature (see above).

---

## 3. Architecture

One orchestrator routes each overdue invoice through specialized agents. **A compliance
gate sits between every draft and every send.** That gate is both the safety story and the
"AI executes a key decision in production" centerpiece.

### Flow

```
Data ingestion ─▶ Orchestrator ─▶ Strategy agent ─▶ Drafting agent ─▶ Compliance gate
  (Stripe/CSV)      (routes)      (when/tone/chan)    (writes msg)        │
                                                              pass ───────┴─────── flag
                                                               │                    │
                                                               ▼                    ▼
                                                        Sending agent          Human review
                                                       (email/SMS/voice)        (last mile)
                                                               │
                                                               ▼
                                                        Reconcile agent ─▶ Execution log
                                                       (detects payment)   (audit + evidence)
                                                               │
                                                    not paid: loop back to Orchestrator
```

### Agents + Google Cloud mapping

| Agent | Decision it makes | Google Cloud building block |
| --- | --- | --- |
| Data ingestion | Flags overdue invoices; pulls client + terms context | Vertex AI Search (grounding) + scheduled sync |
| Orchestrator | Is this actionable? What's the next step? | Agent Builder + ADK on Gemini 3 Flash |
| Strategy agent | Timing, channel, tone, the ask, late-fee permitted? | Gemini 3 Pro (multi-factor judgment) |
| Drafting agent | Writes the message in the customer's voice | Gemini 3 Pro |
| Compliance gate | Safe to send, or escalate to human? | Hard rules layer (the safety boundary) |
| Sending agent | Delivers + records on chosen channel | Email/SMS APIs; STT/TTS for voice tier |
| Reconcile agent | Paid → bill fee; no response → loop; reply → escalate | Stripe sync + orchestrator |
| Execution log | Records every decision + reasoning | Agent Engine (observability) |

### The compliance gate (non-negotiable)

Blocks and escalates to a human when a message would:
- Make a legal threat ("we'll sue," "goes to collections," "we'll report you")
- Claim a consequence the customer can't/won't carry out
- Cross into anything resembling legal advice
- Violate contact-frequency limits or tone bounds
- Touch **consumer** (non-B2B) debt
- Respond to a client who disputes the debt or asks for a payment plan

**Human-in-the-loop:** in pilot mode, the *first* message to any new debtor requires one-tap
human approval; later touches go autonomous once trust is earned. Model = AI does ~90%
(volume), human does the last mile (judgment).

### The execution log does triple duty

Audit trail (compliance) + sales proof ("recovered $3,200, here's exactly what it did") +
submission evidence (the agent-execution logs judges explicitly ask for).

---

## 4. Data layer — normalize at the edge, reason over a canonical form

Agents **never** see a raw invoice. All format variety is absorbed by thin **source adapters**
that translate into one **canonical Invoice schema**; agents only ever read that.

### Canonical Invoice schema

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
  status            // "open" | "paid" | "partial" | "disputed" — verified, not trusted
  debtor_name
  debtor_contact    // email / phone
  is_b2b            // critical for the compliance gate
  late_fee_allowed  // from terms, drives strategy
  prior_contacts    // history of touches
  raw               // original blob, kept untouched
}
```

### Rules

- **One adapter per source.** New format = new adapter emitting canonical shape. Agent logic
  never special-cases a source. (This is the same seam that makes grants a config change.)
- **Normalize at the edge:** field-map (amount/total/balance_due → `amount_due`), dates → ISO,
  money → number + currency, status → fixed enum.
- **Recompute derived fields.** Compute `days_overdue` ourselves; verify `status` against payment
  data — never dun someone who already paid.
- **Validate + quarantine.** After an adapter runs, validate completeness (due date, positive
  amount, contact method). Failures flag to a human ("couldn't read this invoice"), never guessed.

### For the 60-day build: ship two adapters

- **CSV adapter** — universal lowest common denominator; any customer can export from any tool,
  so no pilot is ever blocked by "we don't support your system."
- **Stripe adapter** — clean, automatable, what most early freelancer/SMB pilots already use.
- PDF + QuickBooks adapters = roadmap.

---

## 5. Build sequence — decision core first, plumbing last

Build against a **synthetic dataset** (20–30 fake invoices with edge cases: first-time client
slightly overdue, repeat late-payer, a consumer debt that *should* trip the gate, a disputed
invoice, one already paid). No real customer needed to build and prove the engine.

1. **Data schema + synthetic dataset.** Foundation + demo material.
2. **Strategy agent + compliance gate, tested in isolation.** The heart of the product — prove
   the judgment and escalation against the edge cases (e.g. consumer debt → escalates).
3. **Orchestrator + drafting agent.** Routing + message generation around the proven core.
4. **Execution log (Agent Engine).** Turn on early so every test run produces audit/evidence.
5. **Sending — mocked first.** Log "would send this" rather than send. Full loop demoable with
   zero real messages.
6. **Real integrations last.** Swap synthetic adapter for live Stripe pull + real email/SMS only
   once a pilot is signed. Small contained change *if* step 1's adapter boundary is clean.

**Caution:** synthetic data is for building/testing logic ONLY — never for revenue or customer
evidence. The submission needs real recovered dollars + real customer contacts. The synthetic
phase is days, not weeks; the moment the engine works on fake data, the game is "point it at one
real customer's real invoices." Build + sell in parallel (partner hunts pilots while you build).

---

## 6. The grants roadmap (the mission, not v1)

Grant outreach is the same engine pointed at a different data source.

| Engine step | Collections (now) | Grant outreach (roadmap) |
| --- | --- | --- |
| Data source | Overdue invoices (Stripe/CSV) | Relevant funders / open calls for a research area |
| Decision | When/how to chase a debtor | Who to approach, when, with what angle |
| Draft | Payment reminder in customer's voice | Tailored funder reach-out / intro |
| Compliance gate | No legal threats, B2B only | Tone, accuracy, no overclaiming |
| Reconcile | Payment detected | Response / meeting / application tracked |

**Narrative for the written submission:** "We built an autonomous outreach-and-recovery engine.
We proved it on collections, where money moves fastest and the AI's decisions are most legible.
The same engine extends to grant outreach for researchers and nonprofits — our roadmap — where
it can widen access to funding for people without a development office." Mission in the *story*,
not in the *scope*.

---

## 7. Submission checklist (what the hackathon requires)

- GitHub repo shared with testing@devpost.com and judging@hacker.fund
- 3-min video showing AI live in production executing key decisions
- 500–1000 word narrative: what AI does vs. humans, economic opportunity created, the build story
- Revenue evidence (Stripe export / bank statement / P&L) + corporate ID if available
- Expenses incl. marketing/customer-acquisition spend (disclose even if zero)
- Product evidence: agent execution logs, API usage, dashboard screenshots
- Customer evidence: real customer contacts + testimonials

---

## 8. Open items to resolve

- **Cold-acquisition playbook** — week-1 plan to land 3 pilots with no warm channel (the real bottleneck).
- **Compliance decision spec** — the explicit enumerated "send autonomously vs. escalate" rule list (core agent logic + best demo artifact).
- **Entity / OPT question** — whose name revenue lands in; resolve before any money moves.
- **Stat verification** — re-check market figures against primary sources before they go in the submission; match the stat to who we actually sell to (freelancer vs. SMB numbers).