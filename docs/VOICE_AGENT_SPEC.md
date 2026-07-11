# Settl Voice Agent — build & preparation spec

> Status: **proposal for review** (Ojas → Abhinav). No code yet. This is the
> "how we'll build it, start to end" document: the two-voice model, the rules we
> must respect, the data schema, how it plugs into the existing engine, the call
> flow, the UX, and a phased build plan.

---

## 1. Goal (one paragraph)

Add **voice** as a channel to Settl: the agent can *phone* an overdue B2B customer
and deliver the reminder out loud — in the business owner's **own cloned voice** if
they opt in, or a **professional default voice** if they don't. Voice reuses the
exact pipeline we already have (`strategy → draft → compliance gate → send →
reconcile`): a call is just a "send" on the `voice` channel. Nothing about voice is
allowed to bypass the compliance gate, the human-in-the-loop, or the audit log.

---

## 1.5 — Two different things are both called "voice" (read this first)

Abhinav's `SCHEMA.md §8` already defines **`CustomerVoiceProfile`** — but that is the
**writing persona** (how the *words* are written for email/SMS: persona, formality,
warmth, greeting). It is **grounding for drafting only**, it **never touches the
compliance gate**, and it applies to *every* channel.

**This document is about the audio / phone channel** — the **spoken voice** that reads
the reminder out loud on a call. That's a *separate* thing, and (per `SCHEMA.md §8` +
`VOICE_AGENT_VENDORS.md`) it's an audio design pass with its own big compliance surface.

They **compose, they don't collide**:

| Layer | Answers | Lives on | Touches the gate? |
|---|---|---|---|
| `CustomerVoiceProfile` (existing) | *what words are said* (writing style) | `TenantConfig.voice` | no — grounding only |
| **Audio voice** (this doc) | *whose spoken voice says them* (default vs cloned) | a **new `TenantConfig.audio`** slice | yes — via new voice gate rules |

So a cloned audio voice **speaks a script whose wording still comes from the tenant's
`CustomerVoiceProfile`**. To avoid the exact naming clash Abhinav flagged, all audio
settings go in a **new `audio` slice — never on the `voice` attribute** (that one stays
`CustomerVoiceProfile`, the writing persona).

---

## 2. The two-voice model (Abhinav's requirement)

Not everyone will hand over their voice, so every tenant picks one of two modes at
onboarding — and can change or revoke it any time:

| Mode | What it is | Setup | Default? |
|---|---|---|---|
| **Default voice** | A neutral, professional stock voice from the provider library. | None — works out of the box. | ✅ Yes |
| **Cloned voice** (opt-in) | The owner's *own* voice, cloned from a short sample, so reminders sound like them. | Owner records ~1 min + gives explicit clone consent. | Opt-in |

- The choice lives on the tenant (`TenantConfig.voice.mode`). Declining cloning is a
  first-class path, not a second-class one — the default voice is fully supported.
- **Revocable:** deleting the clone reverts the tenant to the default voice, and the
  clone consent record is marked revoked.
- **Fallback:** if a cloned voice fails to synthesize at call time, fall back to the
  default voice rather than fail the call.

Provider for cloning + TTS: **ElevenLabs** (best quality/latency; instant clone from
~1 min of audio). Per Abhinav's `VOICE_AGENT_VENDORS.md`: the free tier is ~10k
credits/mo but has **no commercial rights**, so anything real needs a paid tier
(~$5–6/mo consumer, $99/mo API Pro). Alternatives behind a seam: Cartesia, PlayHT.

---

## 3. Rules we must respect (the important part)

Split into **legal/compliance** rules (why voice collection is hard) and **product**
rules (how Settl stays safe). Every one of these maps onto machinery we already have
(the compliance gate, governance guardrails, the audit log).

### 3a. Legal / compliance rules
1. **AI-voice disclosure at call open** — the call MUST open by clearly stating it's
   an AI-generated voice. Applies to **both** modes (the default voice is AI too).
2. **Consent to call** — informational payment reminders need prior express consent
   on file before we dial (recorded per debtor).
3. **Separate voice-clone consent** — explicit, logged, revocable; we only ever clone
   the **owner's own** voice, never a debtor's or a third party's.
4. **Call-hour window** — only dial within allowed local hours (e.g. 8am–9pm debtor time).
5. **Frequency caps** — a voice call counts as a contact touch; it obeys the same
   contact-frequency limit the gate already enforces.
6. **Recording consent** — announce recording where required (2-party-consent states);
   store recordings encrypted.
7. **B2B, first-party only** — no consumer debt (reuses the gate's `B2B_ONLY` rule).
   This deliberately keeps us out of third-party-collector (FDCPA mini-Miranda, 7-in-7)
   territory — a core scope decision, now doubly important for voice.
8. **Immediate opt-out / do-not-call** — if the person says "stop calling," honor it
   at once, log it, and never dial again.
9. **Full call artifact retained** — transcript + disclosure text + recording ref +
   consent citation, for 4–7 years (this is just our audit log, extended).
10. **Non-custodial** — the voice agent NEVER takes a card or payment on the call. It
    texts the payment link (`{{payment_link}}`) instead. Funds never touch Settl.

### 3b. Product / architecture rules
11. **The gate is still the only thing that clears a "send."** The call *script* must
    pass the compliance gate (plus new voice rules) **before** we dial — same as email.
12. **Human-in-the-loop:** the first voice call to a new debtor needs one-tap approval
    (reuses `FIRST_CONTACT_APPROVAL`).
13. **Escalate + end call** on dispute, a payment-plan request, or "stop" — the gate
    already escalates these; the voice agent hangs up and hands to a human.
14. **Mock-first.** Default is "would call" (log + render the audio locally). Live
    telephony sits behind a flag, exactly like the email sender does today.
15. **Per-tenant isolation** — each tenant's voice id + consent records are scoped to
    its `tenant_id` (RLS), never shared.
16. **Governance guardrails can tighten voice** — e.g. an operator rule "voice off for
    this customer" or "voice only after 30 days" (reuses `governance`, downgrade-only).
17. **Idempotency** — never double-dial the same invoice for the same touch.

---

## 4. Data model (the "schema" Abhinav asked about)

Additions only; nothing existing changes shape.

```
Channel enum        → add VOICE (alongside EMAIL, SMS). A call is a durable `contact`
                      row (SCHEMA.md §2, channel = "voice"), so it feeds the same
                      frequency caps + strategy timing as email/SMS.

TenantConfig.voice   // UNCHANGED — this stays CustomerVoiceProfile (writing persona,
                     // SCHEMA.md §8). The audio channel does NOT reuse this slice.

TenantConfig.audio { // NEW slice — the spoken-voice config for the phone channel
  mode              // "default" | "cloned"
  provider          // "elevenlabs" (default) | ...
  voice_id          // provider voice id (default library id OR the cloned id)
  default_voice_id  // the stock fallback, always set
  clone_consent     // ConsentRecord | None   (present only when mode == cloned)
  call_window       // { start_local, end_local }  e.g. 08:00–21:00
}

ConsentRecord {
  kind              // "clone" | "call" | "recording"
  granted_by        // user id / owner
  granted_at        // ISO
  method            // "checkbox" | "oral_on_call" | "signed"
  evidence_ref      // pointer to the audio sample / signed doc
  revoked_at        // ISO | None
}

CallArtifact  (written to the execution log per call — extends the audit trail)
{
  call_id, invoice_id, tenant_id
  dialed_at, called_number, agent_voice_id, voice_mode
  disclosure_text          // the AI-disclosure that was spoken
  transcript               // full turn-by-turn
  recording_ref            // encrypted storage pointer (if recorded)
  outcome                  // "pay_intent" | "dispute" | "no_answer" | "voicemail" | "escalated" | "opted_out"
  consent_citation         // which ConsentRecord authorized the dial
  duration_secs
}
```

Invoice already carries `debtor_phone`, so no invoice-schema change is needed.

---

## 5. How it plugs into the existing engine

Voice is a **channel**, so the pipeline is unchanged:

```
strategy (channel = voice if phone present + config allows)
  → drafting  (writes the spoken SCRIPT — words come from the tenant's CustomerVoiceProfile)
  → compliance gate  (existing rules + new voice rules §3a)
  → VoiceSender.send()  = place the call via the provider
        · agent speaks the script in the chosen voice
        · handles simple replies: pay → SMS the link; dispute/plan/stop → escalate + end
  → reconcile  (payment detected as usual; the call artifact + transcript → audit log)
```

New code (all behind clean seams, mock-first):

- `src/settl/voice/sender.py` — `VoiceSender` implementing the existing **`Sender`**
  interface. `MockVoiceSender` ("would call" + render audio) is the default; the live
  provider sender sits behind a flag.
- `src/settl/voice/provider.py` — 🔌 provider seam (Vapi / Retell for the call
  orchestration; ElevenLabs for TTS + clone). Verified against current docs, not memory.
- `src/settl/voice/script.py` — builds the call script = AI disclosure + the drafted
  message + the "I'll text you the link" close. Pure, unit-testable.
- `src/settl/voice/consent.py` — consent + call-window checks (pure helpers the gate uses).
- `compliance/rules.py` — add voice rules: `VOICE_NO_DISCLOSURE`, `VOICE_NO_CONSENT`,
  `VOICE_OUTSIDE_HOURS` (all *tightening*, via the existing gate).

The gate, human-in-the-loop, per-tenant isolation, and audit log are **reused as-is**.

---

## 6. Call flow (start to end)

1. Strategy decides `CHASE`, `channel = voice` (phone on file, config allows, e.g.
   after email/SMS didn't land).
2. Drafting writes the **script**; `voice/script.py` prepends the AI disclosure.
3. **Compliance gate** runs — content rules + voice rules (disclosure present, consent
   on file, within call window, frequency ok, B2B). If anything fails → **escalate,
   don't dial.**
4. First contact → held for **one-tap human approval** in the dashboard.
5. `VoiceSender.send()` places the call (mock = log + play audio; live = provider).
6. Call opens: *"Hi, this is an AI assistant calling on behalf of {business}…"* then
   the reminder in the chosen voice.
7. Debtor response:
   - "I'll pay" → agent texts the payment link, logs `pay_intent`.
   - "I dispute this" / "set up a plan" / "stop calling" → agent **stops, escalates to
     a human**, logs the outcome (+ opt-out if "stop").
   - No answer / voicemail → leave a compliant voicemail (if allowed), log it.
8. **CallArtifact** (transcript, disclosure, recording ref, consent citation, outcome)
   is written to the audit log.
9. Reconcile detects payment as usual and closes/loops the invoice.

---

## 7. What it looks like (UX)

- **Onboarding — "Choose your reminder voice":** a card with `[▶ Default professional
  voice]` (preview) and `[Clone my voice]` (record 1 min + tick the clone-consent box).
  Declining is fine; you're on the default voice.
- **Approvals tab:** a first voice call shows as a card with the **script + a play
  button** to hear it, and Approve / Edit / Skip (same as email drafts).
- **Invoices / Activity:** the call appears in the decision trace and the audit
  timeline, with the transcript and outcome — the same explainable-AI story we already
  have, now with audio.

---

## 8. Phased build plan

| Phase | What | Live SDKs? | Status |
|---|---|---|---|
| **0** | This spec → Abhinav review + decisions (§9) | — | ✅ done |
| **1** | Schema + `MockVoiceSender` + `voice/script.py` + voice gate rules + channel wiring + **tests** (all offline) | No | ✅ done |
| **2** | ElevenLabs **default voice** TTS (render audio) + **clone onboarding** (opt-in, consent) | ElevenLabs | ✅ done (cloning live needs a paid tier — §10) |
| **3** | **Live calls** via Retell, behind env config; artifact + transcript pull-back + consent records | Retell | ✅ done — **live-verified 2026-07-11** |
| **4** | Compliance hardening: call-hour + opt-out + do-not-call + idempotent dialing, **red-team the scripts** through the gate | — | ✅ done |

We ship value at Phase 1 (safe, testable, no telephony) — mirroring how the email
sender was mock-first until a pilot.

---

## 10. Status & remaining roadmap (post Phases 1–4)

**Built and tested** (PR #13): `Channel.VOICE` end-to-end; the `audio` tenant slice;
call-script builder (disclosure-first, URL-never-spoken); gate rules
`VOICE_NO_DISCLOSURE` / `VOICE_NO_CONSENT` / `VOICE_OUTSIDE_HOURS` / `VOICE_OPTED_OUT`
(all hard, none waivable); per-debtor `ConsentStore` + `DoNotCallRegistry` +
`DialLedger` (never double-dial); strategy escalates to voice (opt-in, 30d+, after
written touches); mock + live (Retell) senders behind one seam; TTS seam (mock / macOS
`say` / ElevenLabs); consent-gated clone onboarding; `CallArtifact` pull-back with
deterministic outcome labelling ("stop calling" → do-not-call, immediately); the
companion SMS leg through the `Sender` seam; dashboard voice-approval card with a
script play button. A real call was placed and answered on 2026-07-11.

**Remaining (deliberately deferred):**

1. **Voice cloning live** — code path is done and consent-gated; activating it needs
   ElevenLabs Starter (~$5/mo, commercial rights). One config change.
2. **Live SMS provider** — the SMS leg runs mock-first behind the existing `Sender`
   seam; wire Twilio (or Retell in-call SMS) when a pilot needs real texts.
3. **Webhook artifact ingestion** — today we *pull* call artifacts (`--pull CALL_ID`);
   production should also accept Retell's end-of-call webhook (push), same mapper.
4. **Consent capture UX** — consent records exist in the engine; the dashboard needs
   the "debtor agreed to calls" capture + display (and per-debtor revoke button).
5. **Per-state recording consent** — recording announcement text keyed by the debtor's
   two-party-consent state; recordings encrypted at rest with 4–7y retention.
6. **Durable stores** — `ConsentStore`/`DoNotCallRegistry`/`DialLedger` are in-memory
   (like the audit log); move to the DB with RLS when persistence lands (SCHEMA.md).
7. **Debtor-local time zones** — the call-window check uses a caller-supplied local
   time; resolve the debtor's timezone from their number/address for production.
8. **Conversational depth v2** — v1 is a compliant reminder + simple replies; a fuller
   two-way agent (negotiation-free, still gate-scripted) is a later, bigger surface.

---

## 9. Decisions we need from Abhinav

1. **Call platform** (per `VOICE_AGENT_VENDORS.md`): **Retell** ($10 free ~67–90 min,
   20 concurrent, bring-your-own-LLM + pick an ElevenLabs voice) vs **Synthflow**
   (no-code, PAYG ~$0.08/min, 5 concurrent free). Recommendation: **Retell +
   ElevenLabs voice**. Sierra is enterprise-priced ($150k+/yr) — out of scope for v1.
2. **Conversation depth for v1:** a **one-way compliant reminder + "press 1 / I'll text
   you the link"** (simpler, lower compliance surface) vs a **full two-way conversational
   agent** (more impressive, more surface). Recommendation: **one-way for v1**, conversational later.
3. **Clone provider:** ElevenLabs (recommended) — agreed?
4. **When does voice fire?** e.g. only 30+ days overdue, after email/SMS, B2B only.
5. **Pilot jurisdiction** (drives the exact consent + recording rules).

---

*Everything here reuses Settl's existing invariants — the gate stays the sole send
authority, nothing is custodial, first contact needs a human, and every call is
logged. Voice is a new channel, not a new set of rules to trust.*
