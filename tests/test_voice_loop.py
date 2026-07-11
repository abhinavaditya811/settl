"""The voice loop closed end-to-end, all offline: consent records → strategy picks
the channel → gate reads the records → idempotent dial → SMS leg → call artifact
(with opt-out honored). Spec §3a.2/3a.8/3b.17 + §4 + §9.4."""

import json
from datetime import date, time, timedelta
from decimal import Decimal

import pytest

from settl.agents.strategy.policy import decide_strategy
from settl.audit import ExecutionLog
from settl.compliance import ComplianceGate, GateDecision
from settl.compliance.rules import WAIVABLE_CODES
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import (
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)
from settl.sending.mock_sender import MockSender
from settl.tenancy.config import Audio, TenantConfig, audio_with
from settl.voice import (
    AlreadyDialed,
    ConsentStore,
    DialLedger,
    DoNotCallRegistry,
    build_call_script,
    classify_outcome,
    pull_call_artifact,
    send_sms_followup,
    voice_context_from_records,
)
from settl.voice.retell_sender import RetellVoiceSender
from tests.test_voice_live import PASS, _fake_request, _script, _sender

TENANT = "t_loop"
PHONE = "+15551234567"


def _aged_invoice(*, days_overdue=35, touches=2, phone=PHONE, inbound_summary=None):
    """A B2B invoice aged enough for voice escalation, with N written touches."""
    today = date.today()
    prior = [
        PriorContact(
            occurred_on=today - timedelta(days=25 - i * 7),
            direction=ContactDirection.OUTBOUND,
            channel=Channel.EMAIL,
            summary=f"reminder {i + 1}",
        )
        for i in range(touches)
    ]
    if inbound_summary:
        prior.append(
            PriorContact(
                occurred_on=today - timedelta(days=3),
                direction=ContactDirection.INBOUND,
                channel=Channel.EMAIL,
                summary=inbound_summary,
            )
        )
    return Invoice(
        invoice_id="INV-LOOP", tenant_id=TENANT, source=Source.CSV, source_ref="x",
        amount_due=Decimal("900.00"), issue_date=today - timedelta(days=days_overdue + 30),
        due_date=today - timedelta(days=days_overdue), status=InvoiceStatus.OPEN,
        debtor_name="Loop Co", debtor_email="ap@loop.test", debtor_phone=phone,
        is_b2b=True, late_fee_allowed=True, prior_contacts=prior,
        payment_link="https://buy.stripe.com/x", as_of_date=today,
    )


# --- consent records + do-not-call (the stateful side of the gate) ------------


def test_consent_grant_revoke_roundtrip():
    store = ConsentStore()
    assert store.has_active(TENANT, PHONE) is False
    store.grant(TENANT, PHONE, granted_by="owner", method="checkbox")
    assert store.has_active(TENANT, PHONE) is True
    store.revoke(TENANT, PHONE)
    assert store.has_active(TENANT, PHONE) is False
    store.revoke(TENANT, PHONE)  # idempotent


def test_consent_is_tenant_scoped():
    store = ConsentStore()
    store.grant(TENANT, PHONE, granted_by="owner")
    assert store.has_active("t_other", PHONE) is False  # isolation (SCHEMA.md §6)


def test_records_feed_the_gate_and_a_clean_call_passes():
    inv = _aged_invoice()
    consents, dnc = ConsentStore(), DoNotCallRegistry()
    consents.grant(TENANT, PHONE, granted_by="owner")
    ctx = voice_context_from_records(
        Audio(), inv, consents=consents, do_not_call=dnc, now_local=time(14, 0)
    )
    script = build_call_script(business_name="Loop Co", reminder="Invoice INV-LOOP is due. {{payment_link}}")
    result = ComplianceGate().evaluate(inv, script.full, channel=Channel.VOICE, voice=ctx)
    assert result.decision is GateDecision.PASS


def test_do_not_call_blocks_forever_and_is_not_waivable():
    inv = _aged_invoice()
    consents, dnc = ConsentStore(), DoNotCallRegistry()
    consents.grant(TENANT, PHONE, granted_by="owner")  # consent alone isn't enough
    dnc.register(TENANT, PHONE)
    ctx = voice_context_from_records(
        Audio(), inv, consents=consents, do_not_call=dnc, now_local=time(14, 0)
    )
    script = build_call_script(business_name="Loop Co", reminder="Invoice due. {{payment_link}}")
    result = ComplianceGate().evaluate(inv, script.full, channel=Channel.VOICE, voice=ctx)
    assert result.decision is GateDecision.ESCALATE
    assert "VOICE_OPTED_OUT" in result.codes
    assert "VOICE_OPTED_OUT" not in WAIVABLE_CODES  # an operator can never waive it


def test_written_stop_calling_blocks_even_with_stale_registry():
    inv = _aged_invoice(inbound_summary="Please stop calling me about this.")
    consents, dnc = ConsentStore(), DoNotCallRegistry()  # registry NOT updated yet
    consents.grant(TENANT, PHONE, granted_by="owner")
    ctx = voice_context_from_records(
        Audio(), inv, consents=consents, do_not_call=dnc, now_local=time(14, 0)
    )
    script = build_call_script(business_name="Loop Co", reminder="Invoice due. {{payment_link}}")
    result = ComplianceGate().evaluate(inv, script.full, channel=Channel.VOICE, voice=ctx)
    assert "VOICE_OPTED_OUT" in result.codes


# --- idempotency: never double-dial --------------------------------------------


def test_ledger_refuses_a_second_dial_same_day(monkeypatch):
    calls = _fake_request(monkeypatch)
    ledger = DialLedger()
    sender = _sender(ledger=ledger)
    from tests.test_voice import _invoice as voice_invoice

    inv = voice_invoice()
    out = sender.send(inv, _script().full, PASS, Channel.VOICE)
    assert out.sent is True and len(calls) == 1
    with pytest.raises(AlreadyDialed):
        sender.send(inv, _script().full, PASS, Channel.VOICE)
    assert len(calls) == 1  # the second dial never reached Retell


# --- the companion SMS leg ------------------------------------------------------


def test_sms_followup_delivers_the_resolved_link():
    inv = _aged_invoice()
    script = build_call_script(business_name="Loop Co", reminder="Invoice due. {{payment_link}}")
    out = send_sms_followup(inv, script, PASS, sender=MockSender())
    assert out is not None and out.sent is True
    assert "via=sms" in out.detail
    assert "buy.stripe.com" in out.detail  # placeholder resolved after the gate
    assert "{{payment_link}}" not in out.detail


def test_sms_followup_refuses_on_escalate_and_skips_when_linkless():
    from tests.test_voice import BLOCK

    inv = _aged_invoice()
    script = build_call_script(business_name="Loop Co", reminder="Invoice due. {{payment_link}}")
    refused = send_sms_followup(inv, script, BLOCK, sender=MockSender())
    assert refused is not None and refused.sent is False  # GatedSender guarantee

    linkless = build_call_script(
        business_name="Loop Co", reminder="Invoice due.", include_payment_link=False
    )
    assert send_sms_followup(inv, linkless, PASS, sender=MockSender()) is None


# --- call artifact + outcome labelling ------------------------------------------


@pytest.mark.parametrize(
    "transcript, status, reason, expected",
    [
        ("I dispute this charge, we never received it.", "ended", "user_hangup", "dispute"),
        ("Stop calling me. Remove this number.", "ended", "user_hangup", "opted_out"),
        ("Sure, I'll pay today - text me the link.", "ended", "agent_hangup", "pay_intent"),
        ("Can we set up a payment plan instead?", "ended", "user_hangup", "escalated"),
        ("", "not_connected", "dial_no_answer", "no_answer"),
        ("", "ended", "voicemail_reached", "voicemail"),
        ("Uh, who is this? OK bye.", "ended", "user_hangup", "escalated"),  # unclear → human
    ],
)
def test_outcomes_are_labelled_deterministically(transcript, status, reason, expected):
    assert classify_outcome(transcript, call_status=status, disconnection_reason=reason) == expected


def test_pull_call_artifact_logs_and_honors_opt_out(monkeypatch):
    payload = {
        "call_id": "call_loop", "call_status": "ended", "to_number": PHONE,
        "transcript": "Agent: Hi...\nUser: stop calling me.",
        "recording_url": "https://retell.example/rec.wav",
        "duration_ms": 42000, "start_timestamp": 1760000000000,
        "disconnection_reason": "user_hangup",
    }
    monkeypatch.setattr(
        "settl.voice.artifact._get", lambda url, headers: (200, json.dumps(payload).encode())
    )
    log, dnc = ExecutionLog(), DoNotCallRegistry()
    artifact = pull_call_artifact(
        "call_loop", invoice_id="INV-LOOP", tenant_id=TENANT,
        log=log, do_not_call=dnc, api_key="key_test",
    )
    assert artifact.outcome == "opted_out"
    assert artifact.duration_secs == 42.0
    assert dnc.contains(TENANT, PHONE)  # "stop calling" took effect immediately
    entry = log.for_invoice("INV-LOOP")[0]
    assert entry.agent == "voice_artifact" and entry.decision == "opted_out"
    assert "stop calling" in entry.details["transcript"]


# --- strategy picks the voice channel (§9.4) -------------------------------------


def test_strategy_escalates_to_voice_when_written_touches_failed():
    d = decide_strategy(_aged_invoice(days_overdue=35, touches=2), voice_enabled=True)
    assert d.channel is Channel.VOICE
    assert "voice call" in d.reasoning


@pytest.mark.parametrize(
    "kwargs, invoice_kwargs",
    [
        ({"voice_enabled": False}, {}),  # tenant didn't opt in
        ({"voice_enabled": True}, {"days_overdue": 20}),  # not overdue enough
        ({"voice_enabled": True}, {"touches": 1}),  # written touches not exhausted
        ({"voice_enabled": True}, {"phone": None}),  # no phone on file
    ],
)
def test_strategy_never_picks_voice_when_ineligible(kwargs, invoice_kwargs):
    d = decide_strategy(_aged_invoice(**invoice_kwargs), **kwargs)
    assert d.channel is not Channel.VOICE


def test_a_repeat_call_must_requalify_not_inherit():
    inv = _aged_invoice(days_overdue=35, touches=2)
    prior = list(inv.prior_contacts) + [
        PriorContact(
            occurred_on=date.today() - timedelta(days=4),
            direction=ContactDirection.OUTBOUND, channel=Channel.VOICE, summary="called",
        )
    ]
    inv = inv.model_copy(update={"prior_contacts": prior})
    d = decide_strategy(inv, voice_enabled=False)  # voice since switched off
    assert d.channel is not Channel.VOICE  # last-touch VOICE is not inherited


# --- the orchestrator fails safe end-to-end --------------------------------------


def test_pipeline_voice_chase_fails_safe_without_consent_records():
    """Config turns voice on → strategy picks VOICE → the gate escalates on
    VOICE_NO_CONSENT (no per-debtor consent wired into the orchestrator yet) → the
    call is never 'sent'. Voice cannot leak out of a mis-wired pipeline."""
    log = ExecutionLog()
    config = TenantConfig(tenant_id=TENANT, audio=audio_with(enabled=True))
    orch = Orchestrator(log=log, config=config)
    result = orch.run_one(_aged_invoice(days_overdue=35, touches=2))
    assert result.channel == "voice"  # strategy did escalate to a call
    assert result.terminal_state is TerminalState.ESCALATED
    gate_steps = [s for s in result.steps if s.agent == "compliance_gate"]
    assert any("consent" in s.reasoning.lower() for s in gate_steps)
