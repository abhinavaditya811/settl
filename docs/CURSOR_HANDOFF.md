# Cursor → Claude handoff (Settl)

**Purpose:** Give Claude Code (or any new agent) full context on what Cursor shipped in this repo during the YC / control-room push, so it does not redo or fight existing work.

**Authoring agent:** Cursor (Grok / Composer session with Ojas)  
**Handoff date:** 2026-07-27  
**Repo:** `abhinavaditya811/settl`  
**Primary product surface:** `web/` (Next.js dashboard + landing). Engine invariants stay in `CLAUDE.md` / `DESIGN.md` / `SCHEMA.md`.

---

## How to use this file (for Claude)

1. Read **`CLAUDE.md`** first (architecture + compliance invariants). Never violate them.
2. Read this handoff end-to-end once.
3. Skim merged PRs below on GitHub if you need diffs.
4. For demo / X / YC video scripts, use **`docs/DEMO_AND_X_LAUNCH.md`**.
5. Do **not** recreate the control-room tabs or landing recovery stack unless the user asks for a redesign.

Paste to Claude:

> Continue Settl from this handoff. Prior UI/control-room work was done in Cursor and is already on `master` via PRs #34 and #35. Read `docs/CURSOR_HANDOFF.md` and `docs/DEMO_AND_X_LAUNCH.md`. Prefer extending existing modules over new parallel dashboards.

---

## Already merged (do not re-implement)

### PR #34 — Dashboard board elevate
- **URL:** https://github.com/abhinavaditya811/settl/pull/34  
- Elevated **Overview / Approvals / Invoices / Activity** (CashCommand, BookHealth, Pipeline, ChaseQueue, AgentPulse, approvals keyboard/diff, invoice drawer foundations, activity Why, etc.).

### PR #35 — Control room
- **URL:** https://github.com/abhinavaditya811/settl/pull/35  
- **Branch was:** `ojas/dashboard-control-room`  
- Turned the board into an operator control room (see feature map below).

Anything listed under “Control room feature map” is **already on `master`** after #35.

---

## Control room feature map (PR #35)

### Board shell (`web/src/components/dashboard/BoardShell.tsx`)
- Workflow tabs (top): Overview · Inbox · Approvals · Invoices · Plans · Activity  
- Workspace rail (bottom): **Profile · Settings · Help** (available on `/demo` too, not signed-in only)  
- Hash routing: `#inbox`, `#settings`, etc. Legacy `#profile` → Settings  
- Badges on Inbox / Approvals  

### Overview
- `MorningBrief.tsx` — needs-you / cash held / disputes / quarantine / plans  
- `ConnectionsStrip.tsx` — engine arming (Gmail / Stripe / health)  
- `CashForecast.tsx` — aging-weighted estimate (labeled estimate)  
- Plus elevated CashCommand, ChaseQueue, BookHealth, AgentPulse, PipelineMap  

### Inbox
- `InboxView.tsx` — unified Needs-you: first send / dispute / quarantine / plan lanes  

### Plans
- `PlansMonitorView.tsx` + `demoPlans.ts` — proposed / active / broken  
- Demo fixtures when engine has no live plans (YC walkthrough)  

### Case file / Invoices
- Richer `InvoiceDrawer.tsx` (steer, flag/rule, plan panel, trace, evidence)  
- Customer grouping on Invoices  
- Upload CSV / Add invoice UI (import APIs are for **signed-in** tenants; `/demo` is synthetic)  

### Settings / Profile / Help
- `ProfileView.tsx` — Settings: account, connections, autonomy, guardrails, voice note, evidence, plan templates  
- `OperatorProfileView.tsx` — Profile / workspace identity (demo: Maya Chen / Northline)  
- `HelpView.tsx` — tab map + hard rules  
- `WorkspaceExtras.tsx` — lightweight **Billing stub, Team invite (local), Notification toggles (localStorage)**  
- `AutonomyDial.tsx` + `useAutonomy.ts` — local preference; **does not bypass compliance gate**  
- `evidenceDownload.ts` — client JSON evidence pack  

### Landing alignment
- `consoleTabs.ts` + `ProductConsolePreview.tsx` — inbox / plans / settings preview tabs  
- `RecoveryPrelude.tsx` — hero padding fix so tagline does not overlap fixed **Settl.** nav  
- Landing stack (already on master from earlier landing PRs): RecoveryPrelude → RecoveryStory (6 stages) → Voice + ProductConsole → SafetyGate (“Nothing unsafe gets through”) → PricingClose  

### Libs
- `web/src/lib/health.ts` — richer health projection for connections strip  
- `BoardContext` — health object + richer toasts  

### Explicitly **not** built (leave for later)
- Real Stripe billing / subscriptions  
- Real team invite email delivery  
- Slack / mobile push approve  
- Full voice/DNC settings API UI  
- Debtor self-serve / PTP portal  
- Cadence designer  
- Grant mode  

---

## Local / ops notes Cursor hit

- Project path on Desktop can make **`next dev` hang** (slow I/O). Workaround used: run Next from `/tmp/settl-web` copy, or free disk (machine was ~96% full).  
- Engine: FastAPI on `:8000`. UI only projects engine state (`CLAUDE.md`).  
- Demo board: `http://localhost:3000/demo` (or production `/demo`).  
- Google OAuth for `/dashboard` needs env `client_id`; `/demo` does not.  

---

## Docs added for YC / demo / handoff

| File | Why |
|---|---|
| `docs/DEMO_AND_X_LAUNCH.md` | X launch playbook summary + **full speak-and-click demo script** (~5 min) + Zoom/recording notes pointers |
| `docs/CURSOR_HANDOFF.md` | This file — Cursor → Claude continuity |

Do **not** commit personal YC essay answers or secrets into the repo.

---

## Architecture reminders (unchanged)

- Agents never see raw invoices; adapters → canonical `Invoice`.  
- Pipeline: ingest → orchestrator → strategy → draft → **compliance gate** → send / escalate → reconcile → log.  
- Dashboard **projects** engine state; approve flows through `Orchestrator.approve_and_send`.  
- Never custodial; B2B only; no fabricated payment links; first send human-in-the-loop in pilot mode.  
- File size soft cap ~300–400 lines; split on functional seams.  

---

## Suggested next work for Claude (only if user asks)

- Wire real billing / invites / notification delivery  
- Make CSV/manual add work cleanly in a guided pilot onboarding  
- Performance: run Next off Desktop / fix iCloud path issues  
- Voice ops settings backed by engine API  
- Keep demo script and landing in sync if product copy changes  

---

## PR checklist for *this* handoff PR

- [ ] `docs/CURSOR_HANDOFF.md`  
- [ ] `docs/DEMO_AND_X_LAUNCH.md`  
- [ ] No unrelated `docs/YC_*` private application drafts  

**Merged product code:** already on `master` via #34 / #35 — this PR is documentation continuity for Claude, not a second control-room implementation.
