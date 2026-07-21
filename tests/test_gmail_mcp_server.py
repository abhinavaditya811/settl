"""The MCP server's tool logic (gmail/mcp_server.py) - tested as plain
functions, no MCP transport/stdio subprocess involved (see the module's own
docstring for why _read_threads/_send_reply take the client as an argument
rather than closing over it)."""

from datetime import datetime, timezone

import pytest
from cryptography.fernet import Fernet

from settl.gmail import mcp_server
from settl.gmail.messages import GmailMessage


class _FakeClient:
    def __init__(self, threads=None, send_result="<new@gmail>"):
        self._threads = threads or []
        self._send_result = send_result
        self.list_calls = []
        self.send_calls = []

    def list_new_threads(self, *, query, max_results):
        self.list_calls.append((query, max_results))
        return self._threads

    def send_reply(self, **kwargs):
        self.send_calls.append(kwargs)
        return self._send_result


def _msg(**overrides):
    defaults = dict(
        message_id="<m1@gmail>", thread_id="t1", in_reply_to="<orig@settl>",
        references="<orig@settl>", subject="Re: [Settl] Invoice reminder - INV-018",
        from_address="debtor@acme.test", body_text="thanks!",
        occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    defaults.update(overrides)
    return GmailMessage(**defaults)


def test_read_threads_serializes_messages_to_plain_dicts():
    client = _FakeClient(threads=[_msg()])
    result = mcp_server._read_threads(client, query="is:unread", max_results=5)
    assert client.list_calls == [("is:unread", 5)]
    assert result == [
        {
            "message_id": "<m1@gmail>", "thread_id": "t1", "in_reply_to": "<orig@settl>",
            "references": "<orig@settl>", "subject": "Re: [Settl] Invoice reminder - INV-018",
            "from_address": "debtor@acme.test", "body_text": "thanks!",
            "occurred_at": "2026-01-01T00:00:00+00:00",
        }
    ]


def test_read_threads_empty_when_no_new_messages():
    assert mcp_server._read_threads(_FakeClient(threads=[])) == []


def test_send_reply_reports_success():
    client = _FakeClient(send_result="<new@gmail>")
    result = mcp_server._send_reply(
        client, thread_id="t1", in_reply_to_message_id="<orig@settl>",
        to="debtor@acme.test", from_address="ar@vendor.test",
        subject="[Settl] Invoice reminder - INV-018", body_text="Thanks!",
    )
    assert result == {"sent": True, "message_id": "<new@gmail>"}
    assert client.send_calls[0]["thread_id"] == "t1"


def test_send_reply_reports_failure_without_raising():
    client = _FakeClient(send_result=None)
    result = mcp_server._send_reply(
        client, thread_id="t1", in_reply_to_message_id="<orig@settl>",
        to="d@a.com", from_address="ar@v.com", subject="hi", body_text="hi",
    )
    assert result == {"sent": False, "message_id": None}


def test_build_server_registers_both_tools():
    mcp = mcp_server.build_server(_FakeClient())
    tool_names = {t.name for t in mcp._tool_manager.list_tools()}
    assert tool_names == {"read_threads", "send_reply"}


# --- client_for_tenant -----------------------------------------------------------


def test_client_for_tenant_raises_when_supabase_not_armed(monkeypatch):
    import settl.data.supabase as db

    monkeypatch.setattr(db, "supabase_enabled", lambda: False)
    with pytest.raises(RuntimeError, match="SETTL_USE_SUPABASE"):
        mcp_server.client_for_tenant("t_demo")


def test_client_for_tenant_raises_when_tenant_never_connected(monkeypatch):
    import settl.data.supabase as db

    monkeypatch.setattr(db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(db, "load_token", lambda tenant_id, provider: None)
    with pytest.raises(RuntimeError, match="no Google OAuth token"):
        mcp_server.client_for_tenant("t_demo")


def test_client_for_tenant_decrypts_the_stored_token(monkeypatch):
    import settl.data.supabase as db
    from settl.security import token_crypto

    monkeypatch.setenv("SETTL_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    encrypted = token_crypto.encrypt("1//real-refresh-token")
    monkeypatch.setattr(db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(db, "load_token", lambda tenant_id, provider: (encrypted, ["gmail.readonly"]))

    client = mcp_server.client_for_tenant("t_demo")
    assert client._refresh_token == "1//real-refresh-token"
