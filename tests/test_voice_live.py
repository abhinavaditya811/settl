"""Voice Phase 3 - the live Retell sender, fully hermetic (HTTP monkeypatched).

The live dialer must uphold every guarantee the mock one does: refuse an escalated
script without touching the network, hard-fail an unresolved link, keep the payment
link OUT of the voice provider's hands, and redirect self-test dials to a known
number. Same discipline as test_senders.py plays with smtplib.
"""

import json

import pytest

from settl.compliance.gate import ComplianceResult, GateDecision
from settl.compliance.rules import RuleViolation
from settl.schema.invoice import Channel
from settl.voice import MissingTelephonyConfig, RetellVoiceSender, build_call_script
from tests.test_voice import _invoice  # shared canonical fixture

PASS = ComplianceResult(GateDecision.PASS, [], "clear")
BLOCK = ComplianceResult(
    GateDecision.ESCALATE, [RuleViolation("VOICE_NO_CONSENT", "no consent")], "blocked"
)


def _script():
    return build_call_script(
        business_name="Brightline",
        reminder="Invoice T-1 for one hundred dollars is ten days past due. {{payment_link}}",
    )


def _fake_request(monkeypatch, status=201, body=None):
    calls = []
    payload = body if body is not None else json.dumps({"call_id": "call_xyz"}).encode()

    def fake(url, *, headers, data):
        calls.append({"url": url, "headers": headers, "data": json.loads(data)})
        return status, payload

    monkeypatch.setattr("settl.voice.retell_sender._request", fake)
    return calls


def _sender(**kw):
    kw.setdefault("api_key", "key_test")
    kw.setdefault("from_number", "+15550001111")
    kw.setdefault("agent_id", "agent_test")
    return RetellVoiceSender(**kw)


def test_live_sender_refuses_on_escalate_without_touching_the_network(monkeypatch):
    calls = _fake_request(monkeypatch)
    out = _sender().send(_invoice(), _script().full, BLOCK, Channel.VOICE)
    assert out.sent is False and "WITHHELD" in out.detail
    assert calls == []  # an escalated call never reaches Retell


def test_live_sender_hard_fails_unresolved_link_before_dialing(monkeypatch):
    calls = _fake_request(monkeypatch)
    inv = _invoice(payment_link=None)  # no link anywhere → resolution fails
    out = _sender().send(inv, _script().full, PASS, Channel.VOICE)
    assert out.sent is False and "unresolved payment link" in out.detail
    assert calls == []


def test_live_sender_dials_and_keeps_the_link_away_from_retell(monkeypatch):
    calls = _fake_request(monkeypatch)
    out = _sender().send(_invoice(), _script().full, PASS, Channel.VOICE)
    assert out.sent is True and "call_xyz" in out.detail

    sent = calls[0]["data"]
    assert sent["to_number"] == "+15551234567"  # the invoice's debtor phone
    assert sent["override_agent_id"] == "agent_test"
    assert calls[0]["headers"]["Authorization"] == "Bearer key_test"
    # Non-custodial on the wire: the spoken script goes to Retell, the resolved
    # payment link does NOT - it stays on the SMS leg in our own audit detail.
    spoken_sent = sent["retell_llm_dynamic_variables"]["script"]
    assert "AI assistant" in spoken_sent
    assert "http" not in spoken_sent
    assert "http" not in json.dumps(sent)
    assert "buy.stripe.com" in out.detail  # ...but the SMS leg did resolve it


def test_live_sender_redirects_self_test_dials(monkeypatch):
    calls = _fake_request(monkeypatch)
    out = _sender(force_recipient="+19998887777").send(
        _invoice(), _script().full, PASS, Channel.VOICE
    )
    assert calls[0]["data"]["to_number"] == "+19998887777"
    assert "redirected" in out.detail


def test_live_sender_requires_config_on_pass(monkeypatch):
    monkeypatch.setattr("settl.voice.retell_sender.load_dotenv", lambda: {})
    for var in ("RETELL_API_KEY", "RETELL_FROM_NUMBER", "RETELL_AGENT_ID"):
        monkeypatch.delenv(var, raising=False)
    sender = RetellVoiceSender()
    assert sender.configured is False
    with pytest.raises(MissingTelephonyConfig):
        sender.send(_invoice(), _script().full, PASS, Channel.VOICE)


def test_live_sender_surfaces_a_retell_rejection(monkeypatch):
    from settl.voice import CallFailed

    _fake_request(monkeypatch, status=402, body=b'{"error": "out of credit"}')
    with pytest.raises(CallFailed, match="402"):
        _sender().send(_invoice(), _script().full, PASS, Channel.VOICE)
