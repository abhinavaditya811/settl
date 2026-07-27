# Settl: X launch notes + full demo script

Use this as the single source for (1) posting on X and (2) walking someone through the product on camera or live.

**Live URLs (fill in your production domain):**
- Landing: `/` (or `https://YOUR_DOMAIN/`)
- Demo board: `/demo`
- Sign-in: `/signin`

---

## Part A — X launch playbook (source)

**Original post:** [how to do a viral launch on X in 2026 — @askOkara](https://x.com/askokara/status/2080254018400690490?s=46)

### What the post says (summary)

| Folder | Do this |
|---|---|
| **Product** | Build something people want. Show value in the first 30 seconds. Get users to the aha moment. Make signup + onboarding frictionless. |
| **Launch messaging** | Write a one-page press release: what you’re launching, who it’s for. Use it as the source of truth for all launch content. |
| **Launch video** | Study good launch videos. Keep it under 60 seconds. Show the product solving a real problem. End with one clear CTA. |
| **Launch thread** | Study hooks. Write 20, pick the best. First line must stop the scroll. Attach the launch video. |
| **Supporters** | Reach friends, users, VCs before launch day. Calendar invites. Aim for 50+ committed. Ask them to engage in the first hour. |
| **Influencers** | Brief them. Share examples of good quote tweets. |
| **Launch day** | Post when ICP is active. Send the link to supporters. Reply to every comment. Repost good quote tweets. Email users. Track signups / traffic / conversions. |
| **After launch** | Follow up engagers. Turn feedback into product. Boost as an ad if the first tweet had no link. Share results and milestones. |
| **Execution loop** | Build → launch → feedback → improve → launch again. |

### Settl one-pager (messaging source of truth)

- **What:** Settl is an AI recovery agent that chases overdue B2B invoices for freelancers and small businesses.
- **Who:** Freelancers, agencies, and SMBs who hate writing “just checking in” emails and can’t hire collections.
- **How it works:** Decides timing, tone, and channel → drafts in your voice → hard compliance gate → you approve the first send → reconciles when paid. Never holds money.
- **Aha:** Open `/demo`, see a case waiting for one-tap approve with the exact draft and Why.
- **CTA:** Try the demo → `/demo`

### Posting now vs full launch day

- **Tonight / this week:** Ship a strong thread + demo link + short screen recording. Reply to everyone.
- **Full viral launch day:** Only after you have ~50 people who agreed to engage in the first hour. Same messaging, bigger push.

### Sample thread hooks (pick one)

1. Freelancers don’t have a collections department. They have anxiety and a half-written “just checking in” email.
2. Your invoice isn’t late because people hate you. It’s late because nobody owns the chase.
3. We built an AI that gets freelancers paid without sounding like a debt collector.
4. Overdue invoices don’t need another dashboard. They need someone who actually follows up.
5. First send held for your OK. Everything after that, Settl runs the recovery loop.

### Under-60s video skeleton

| Time | Show | Say |
|---|---|---|
| 0–8s | Overdue invoice stress | “$6,800. 21 days late. You’re still just checking in.” |
| 8–25s | Landing story or Overview | “Settl decides the next move and queues what needs you.” |
| 25–45s | Approvals → Approve | “You see the exact message. One tap. Compliance already cleared.” |
| 45–55s | Activity Why | “Every decision leaves a reason.” |
| 55–60s | URL | “Try the demo. Link below.” |

---

## Part B — Full product demo script (speak + click)

**Target length: ~4:30–5:00** for YC / investor walkthrough.  
**X cut:** still edit down to **45–60s** (hero → Approvals approve → URL). Do not post this full cut in-feed.

This version covers the **whole landing** (hero → 6 story beats → voice → console → safety → pricing) then the **board with real clicks**: Overview, Inbox, Approvals (approve), Invoices (add / open case), Plans, Activity.

**Honest constraint on `/demo`:** Upload CSV / Add invoice hit the signed-in import APIs (not the synthetic demo tenant). On demo: **open the Add invoice modal and show the form**, then use an existing invoice for the rest. On a signed-in empty account (`/dashboard`), you can actually upload CSV / add one and re-run the engine.

### Before you hit record
1. Tab 1 = `/` · Tab 2 = `/demo` (hard refresh, dark theme).
2. Optional Tab 3 = `/signin` → `/dashboard` only if you will show a real CSV add (zero-state).
3. Zoom ~110%. Landing sound **on** for the voice section (or click play on the call card).
4. Practice once with a timer.

---

### Act 1 — Landing (~2:00)

#### 0:00–0:20 · Hero
**Do:** Land on `/`. Point at brand + $6,800 Atlas invoice card.  
**Say:**
> Freelancers don’t have a collections department. They have unpaid invoices and “just checking in” emails. This is Settl — an AI recovery agent that chases overdue B2B invoices: it decides the next move, writes in your voice, clears a hard compliance gate, and only pulls you in when a human is needed. We never hold the money.

**Do:** Click **Follow one invoice ↓** or scroll into the story.

---

#### 0:20–1:05 · Recovery story (six stages — keep moving)
Scroll so each stage fills the screen. One sentence each:

| Stage | Say | Do |
|---|---|---|
| **01 Ingest** | “Messy CSV or Stripe becomes one clean canonical invoice. Agents never see the raw mess.” | Pause on title |
| **02 Strategy** | “Next move is a decision, not a dumb calendar — days overdue, prior contact, channel.” | Scroll |
| **03 Draft** | “It writes in your voice — amount, due date, payment-link placeholder.” | Scroll |
| **04 Compliance** | “Hard gate: no legal threats, no fake links, no consumer debt. First send needs your OK.” | Pause — trust beat |
| **05 Reach** | “After you approve, it sends from your side and logs delivery.” | Scroll |
| **06 Recovered** | “Payment closes the loop. Chase stops.” | Scroll |

---

#### 1:05–1:25 · Voice (`#voice`)
**Do:** Scroll to voice. Click the call card / play so you can **hear the agent**.  
**Say:**
> Same recovery path can place a natural AI voice call in your business’s name — disclosed, compliant, optional. Listen — this is the channel, not a gimmick. Same gate rules still apply.

**Do:** Stop playback after ~5–8 seconds. Keep scrolling.

---

#### 1:25–1:40 · Product console (`#console`)
**Do:** Scroll to console. Click **Overview → Approvals → Inbox** once each in the preview.  
**Say:**
> This is a live preview of the operator board — Overview, Inbox, Approvals, Invoices, Plans, Activity. You’re about to click the real one.

---

#### 1:40–1:55 · Safety (`#safety`)
**Do:** Scroll to “Nothing unsafe gets through.” Optionally click **Run gate again**.  
**Say:**
> The AI can write. It cannot overrule the gate. Risky language, consumer debt, disputes — blocked or escalated to you.

---

#### 1:55–2:05 · Pricing / close (`#pricing`)
**Do:** Scroll to “Our fee moves when your money does.”  
**Say:**
> We’re aligned with recovery — fee moves when money moves. Pre-beta now. Let’s open the live control room.

**Do:** Switch to `/demo` (or click Open dashboard / demo CTA).

---

### Act 2 — Live board with functionality (~2:30)

#### 2:05–2:25 · Overview
**Do:** Point at connections strip → morning brief → cash command → chase queue.  
**Say:**
> Control room. Connections: is the engine armed. Morning brief: how many need you and how much cash is held on first sends. Cash position: outstanding, in flight, recovered, awaiting you. Chase queue: who to handle next.

**Do:** Click one chase-queue row if it jumps to a case, or continue to Inbox.

---

#### 2:25–2:40 · Inbox
**Do:** Open **Inbox**. Click lane chips: All → Approve → Dispute (or Plans). Click one row so it expands / focuses.  
**Say:**
> Inbox is only what needs you — first sends, disputes, quarantine, payment-plan asks. Not the whole ledger. This is triage. Approvals is where we send.

---

#### 2:40–3:20 · Approvals (aha — actually click)
**Do:**
1. Open **Approvals**.
2. Expand the top awaiting case.
3. Scroll the draft. Point at destination + Why / chips.
4. Click **Approve & send** (demo may log a would-send — that’s fine).
5. Watch toast / list update.

**Say:**
> Send workbench. Exact draft, who it goes to, and Why. Compliance already passed or it wouldn’t be here. First contact: one tap. I’m approving now — that’s the human gate. Live send stays off on synthetic demo; the path is identical for a real tenant.

---

#### 3:20–3:55 · Invoices (show add + case file)
**Do:**
1. Open **Invoices**.
2. Click **Add invoice** (and/or **Upload CSV**) — show the modal fields.
3. On `/demo`: close modal after showing it; say real accounts import here and the engine re-runs.
4. Toggle **By customer** if visible.
5. Click an invoice row → open the **case drawer**.
6. Scroll: message, steer / Set a rule, plan panel if present, **trace**.

**Say:**
> Full book. Here’s where you add invoices — CSV upload or manual entry — then the agent decides the next move. Opening a case: identity, draft, rules, plan, and the execution trace. This is the audit trail for one invoice.

*(If you prepared a signed-in account with CSV: switch tab, upload, wait for refresh / re-run, then come back to Approvals.)*

---

#### 3:55–4:15 · Plans
**Do:** Open **Plans**. Click a **proposed**, then **active**, then **broken** row.  
**Say:**
> When a debtor asks for a payment plan, it doesn’t die in email. Proposed waiting on your decide, active schedules, broken installs — click through.

---

#### 4:15–4:35 · Activity
**Do:** Open **Activity**. Click a filter chip (All / Strategy / Compliance). Expand one event’s Why.  
**Say:**
> Every decision leaves a reason — strategy, gate, waiting on you, paid. Not a black box. This is what you’d show a co-founder or an auditor.

---

#### 4:35–4:50 · Profile / Settings (10 seconds each)
**Do:** Bottom rail → **Profile** (avatar / workspace) → **Settings** (scroll past autonomy + billing stub).  
**Say:**
> Profile is who operates the board. Settings is how it’s armed — autonomy, guardrails, connections, evidence export. Gate still wins over autonomy.

---

#### 4:50–5:00 · Close
**Do:** Back to Approvals or Overview. Show URL.  
**Say:**
> That’s Settl. Landing is the recovery path. Board is where you run it. B2B only. Never custodial. First send needs you. Try the demo — *[your URL]/demo*.

Stop talking.

---

### If you must fit ~3:00
Keep: Hero (15s) → Story stages 01+04 only (25s) → Voice play (10s) → Safety one line (10s) → `/demo` Overview (20s) → Approvals expand + Approve (50s) → Invoices open case (25s) → Activity Why (15s) → CTA (10s).  
Cut: full six-stage narration, console tab tour, Plans, Profile/Settings, Add-invoice modal.

---

### Optional 60-second X cut
1. Hero pain (8s)  
2. Voice OR Safety one line (8s)  
3. Approvals expand + Approve click (30s)  
4. CTA + URL (10s)  

---

## Part C — Tips for giving the demo

1. **Clicks > claims.** Every major feature gets one mouse action.
2. **Approvals approve is the spine.** Pause on draft + Why, then click.
3. **Say the three hard promises once:** never custodial · B2B only · first send needs you.
4. **Name money out loud:** $6,800 · 21 days overdue.
5. **Demo honesty:** synthetic board; CSV add is for signed-in tenants — show the button either way.
6. **Voice:** actually play audio; don’t just describe it.
7. **Safety:** say the headline on screen — “Nothing unsafe gets through.”
8. **X ≠ full cut.** Feed ≤60s. This full script ~5 min unlisted / YC demo field.
9. **No music. No slides.** Screen + your voice.
10. **End on a verb:** open `/demo` / reply / book a pilot.

---

## Part D — Teleprompter (full ~5:00)

```
LANDING
  0:00  HERO       unpaid / just checking in → Settl runs the chase
  0:20  STORY 01–06 ingest → strategy → draft → GATE → send → paid
  1:05  VOICE      play the call · disclosed · same gate
  1:25  CONSOLE    flip Overview / Approvals preview
  1:40  SAFETY     nothing unsafe gets through · run gate
  1:55  PRICING    fee moves when money moves → /demo

BOARD
  2:05  OVERVIEW   brief + cash + chase
  2:25  INBOX      lanes · click a needs-you row
  2:40  APPROVALS  expand · Why · Approve & send   ← aha
  3:20  INVOICES   Add invoice modal · open case · trace
  3:55  PLANS      proposed / active / broken
  4:15  ACTIVITY   filter · expand Why
  4:35  PROFILE/SETTINGS  who · how armed
  4:50  CLOSE      B2B · never hold money · first send needs you → URL

X CUT: hero → voice/safety → approvals click → URL
```

---

## Commit note

This file is safe to commit under `docs/` when you’re ready (e.g. `docs/DEMO_AND_X_LAUNCH.md`). It contains no secrets; demo amounts are synthetic.
