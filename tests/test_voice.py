"""Voice channel - Phase 1, all offline (no telephony, no TTS, no SDK).

Proves the four things Phase 1 must guarantee (VOICE_AGENT_SPEC §8):
  * the call script opens with an AI disclosure and never speaks a URL;
  * the gate's voice rules fire (no disclosure / no consent / outside hours → escalate),
    while a clean B2B voice chase passes and email/SMS are unaffected;
  * ``MockVoiceSender`` inherits the gate refusal + payment-link hard-fail from
    ``GatedSender`` (a call is as safe as an email);
  * the tenant ``audio`` config maps into the gate inputs and only speaks a clone with
    active consent.
"""

from datetime import date, time, timedelta
from decimal import Decimal

from settl.compliance import (
    ComplianceGate,
    ComplianceResult,
    GateDecision,
    RuleViolation,
)
from settl.compliance.rules import rule_voice_call_window
from settl.audit import ExecutionLog
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import (
    PAYMENT_LINK_PLACEHOLDER,
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)
from settl.tenancy.config import (
    Audio,
    AudioMode,
    CallWindow,
    ConsentRecord,
    audio_with,
)
from settl.voice import MockVoiceSender, build_call_script, voice_context_for

BLOCK = ComplianceResult(
    GateDecision.ESCALATE, [RuleViolation("LEGAL_THREAT", "bad")], "blocked"
)


def _invoice(*, b2b=True, phone="+15551234567", payment_link="https://buy.stripe.com/x"):
    today = date.today()
    # One prior outbound touch → not first-contact (keeps the clean case off the
    # FIRST_CONTACT_APPROVAL hold), and 1 touch is well under the frequency ceiling.
    prior = [
        PriorContact(
            occurred_on=today - timedelta(days=5),
            direction=ContactDirection.OUTBOUND,
            channel=Channel.EMAIL,
            summary="friendly reminder",
        )
    ]
    return Invoice(
        invoice_id="V-1", tenant_id="t_test", source=Source.CSV, source_ref="x",
        amount_due=Decimal("100.00"), currency="USD",
        issue_date=today - timedelta(days=40), due_date=today - timedelta(days=12),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="ap@acme.test",
        debtor_phone=phone, is_b2b=b2b, late_fee_allowed=True, prior_contacts=prior,
        payment_link=payment_link, as_of_date=today,
    )


REMINDER = f"Your invoice V-1 for $100 is 12 days past due. Pay here: {PAYMENT_LINK_PLACEHOLDER}"


def _script():
    return build_call_script(business_name="Acme", reminder=REMINDER)


def _ctx(*, consent=True, now=time(10, 0), audio=None):
    return voice_context_for(
        audio or Audio(), call_consent=consent, now_local=now
    )


# --- script.py ----------------------------------------------------------------


def test_script_opens_with_ai_disclosure():
    s = _script()
    assert s.spoken.startswith("Hi, this is an AI assistant")


def test_script_never_speaks_a_url_but_full_carries_the_placeholder():
    s = _script()
    # The spoken leg reads no URL and no placeholder aloud...
    assert PAYMENT_LINK_PLACEHOLDER not in s.spoken
    assert "http" not in s.spoken
    # ...but the companion SMS keeps the placeholder, so the sender still resolves it.
    assert PAYMENT_LINK_PLACEHOLDER in s.sms_followup
    assert PAYMENT_LINK_PLACEHOLDER in s.full


def test_script_without_link_leg_has_no_sms():
    s = build_call_script(business_name="Acme", reminder="A short reminder.",
                          include_payment_link=False)
    assert s.sms_followup == ""
    assert PAYMENT_LINK_PLACEHOLDER not in s.full


# --- gate voice rules ---------------------------------------------------------


def test_clean_b2b_voice_chase_passes():
    res = ComplianceGate().evaluate(
        _invoice(), _script().full, channel=Channel.VOICE, voice=_ctx()
    )
    assert res.passed, res.codes


def test_missing_disclosure_escalates():
    plain = f"Your invoice is past due. Pay: {PAYMENT_LINK_PLACEHOLDER}"  # no disclosure
    res = ComplianceGate().evaluate(
        _invoice(), plain, channel=Channel.VOICE, voice=_ctx()
    )
    assert not res.passed and "VOICE_NO_DISCLOSURE" in res.codes


def test_no_call_consent_escalates():
    res = ComplianceGate().evaluate(
        _invoice(), _script().full, channel=Channel.VOICE, voice=_ctx(consent=False)
    )
    assert not res.passed and "VOICE_NO_CONSENT" in res.codes


def test_outside_call_window_escalates():
    res = ComplianceGate().evaluate(
        _invoice(), _script().full, channel=Channel.VOICE,
        voice=_ctx(now=time(23, 30)),  # after the 21:00 window close
    )
    assert not res.passed and "VOICE_OUTSIDE_HOURS" in res.codes


def test_missing_voice_context_fails_safe():
    # channel is VOICE but no context supplied → treated as no consent, must escalate.
    res = ComplianceGate().evaluate(
        _invoice(), _script().full, channel=Channel.VOICE, voice=None
    )
    assert not res.passed and "VOICE_NO_CONSENT" in res.codes


def test_consumer_debt_still_blocks_on_voice():
    # The existing B2B_ONLY rule applies to voice unchanged (reuses the gate).
    res = ComplianceGate().evaluate(
        _invoice(b2b=False), _script().full, channel=Channel.VOICE, voice=_ctx()
    )
    assert not res.passed and "B2B_ONLY" in res.codes


def test_voice_rules_do_not_touch_email():
    # Same invoice + a clean email body, EMAIL channel: no voice codes appear even
    # though we passed no VoiceContext. Voice rules must be voice-only.
    email = f"Your invoice V-1 for $100 is 12 days past due. Pay here: {PAYMENT_LINK_PLACEHOLDER}"
    res = ComplianceGate().evaluate(_invoice(), email, channel=Channel.EMAIL)
    assert res.passed
    assert not any(c.startswith("VOICE_") for c in res.codes)


# --- MockVoiceSender (inherits GatedSender guarantees) ------------------------


def test_voice_sender_refuses_on_escalate():
    out = MockVoiceSender().send(_invoice(), _script().full, BLOCK, Channel.VOICE)
    assert out.sent is False and "WITHHELD" in out.detail


def test_voice_sender_calls_and_resolves_link_on_pass():
    inv = _invoice(payment_link="https://buy.stripe.com/test_voice")
    res = ComplianceGate().evaluate(inv, _script().full, channel=Channel.VOICE, voice=_ctx())
    assert res.passed
    out = MockVoiceSender().send(inv, _script().full, res, Channel.VOICE)
    assert out.sent is True
    assert "would CALL +15551234567" in out.detail
    assert "https://buy.stripe.com/test_voice" in out.detail  # link resolved
    assert PAYMENT_LINK_PLACEHOLDER not in out.detail  # placeholder gone


def test_voice_sender_hard_fails_when_link_unresolvable():
    inv = _invoice(payment_link=None)  # no invoice link, no mint, no tenant default
    res = ComplianceGate().evaluate(inv, _script().full, channel=Channel.VOICE, voice=_ctx())
    out = MockVoiceSender().send(inv, _script().full, res, Channel.VOICE)
    assert out.sent is False and "unresolved payment link" in out.detail


# --- audio config -------------------------------------------------------------


def test_default_audio_uses_default_voice():
    assert Audio().active_voice_id == "default"


def test_cloned_voice_used_only_with_active_consent():
    consent = ConsentRecord(kind="clone", granted_by="owner", granted_at="2026-07-01")
    cloned = audio_with(mode=AudioMode.CLONED, voice_id="vox_owner", clone_consent=consent)
    assert cloned.active_voice_id == "vox_owner"
    # Revoke it → we must fall back to the default voice, never speak the clone.
    revoked = audio_with(
        mode=AudioMode.CLONED, voice_id="vox_owner",
        clone_consent=ConsentRecord(
            kind="clone", granted_by="owner", granted_at="2026-07-01",
            revoked_at="2026-07-09",
        ),
    )
    assert revoked.active_voice_id == "default"
    # Opted into cloning but no consent record at all → default too.
    no_consent = audio_with(mode=AudioMode.CLONED, voice_id="vox_owner")
    assert no_consent.active_voice_id == "default"


def test_voice_context_for_pulls_window_from_audio():
    audio = audio_with(call_window=CallWindow(start_local=time(9, 0), end_local=time(17, 0)))
    ctx = voice_context_for(audio, call_consent=True, now_local=time(8, 30))
    assert ctx.window_start == time(9, 0) and ctx.window_end == time(17, 0)
    # 08:30 is before the tenant's 09:00 open → the window rule escalates.
    assert [v.code for v in rule_voice_call_window(ctx)] == ["VOICE_OUTSIDE_HOURS"]


# --- orchestrator wiring (fail-safe until consent is wired) --------------------


def test_orchestrator_voice_approval_fails_safe_without_consent():
    # A voice approval flows the channel into the gate. With no per-debtor consent
    # source wired yet (Phase 3), the gate escalates rather than clearing a call -
    # a voice send can never slip through on email-only rules.
    log = ExecutionLog()
    orch = Orchestrator(log=log, sender=MockVoiceSender(log=log))
    res = orch.approve_and_send(_invoice(), _script().full, Channel.VOICE)
    assert res.terminal_state is TerminalState.ESCALATED
    assert "VOICE_NO_CONSENT" in res.detail
