"""Gmail client + message parsing (settl.gmail) - the Gmail REST API is faked
throughout (no network, no real Google call), same fake-client pattern as
test_stripe_links.py. Credential refresh is bypassed via an injected fake
credentials object (see GmailClient.__init__'s docstring) - Google's own OAuth
refresh library is trusted, not re-tested here."""

import base64

from settl.gmail import GmailClient
from settl.gmail.messages import parse_message


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode()


def _raw_message(
    *,
    msg_id="18abc",
    thread_id="18xyz",
    message_id_header="<reply123@mail.gmail.com>",
    in_reply_to="<orig456@settl>",
    subject="Re: [Settl] Invoice reminder - INV-018",
    from_address="debtor@acme.test",
    body="Thanks, will pay by Friday",
) -> dict:
    headers = [
        {"name": "Subject", "value": subject},
        {"name": "From", "value": from_address},
    ]
    if message_id_header:
        headers.append({"name": "Message-ID", "value": message_id_header})
    if in_reply_to:
        headers.append({"name": "In-Reply-To", "value": in_reply_to})
        headers.append({"name": "References", "value": in_reply_to})
    return {
        "id": msg_id,
        "threadId": thread_id,
        "internalDate": "1750000000000",
        "payload": {
            "mimeType": "text/plain",
            "headers": headers,
            "body": {"data": _b64(body)},
        },
    }


# --- message parsing -----------------------------------------------------------


def test_parse_message_extracts_threading_and_body():
    msg = parse_message(_raw_message())
    assert msg.message_id == "<reply123@mail.gmail.com>"
    assert msg.thread_id == "18xyz"
    assert msg.in_reply_to == "<orig456@settl>"
    assert msg.subject == "Re: [Settl] Invoice reminder - INV-018"
    assert msg.body_text == "Thanks, will pay by Friday"


def test_parse_message_falls_back_to_gmail_id_when_no_message_id_header():
    msg = parse_message(_raw_message(message_id_header=None))
    assert msg.message_id == "18abc"


def test_parse_message_walks_multipart_for_text_plain():
    raw = _raw_message()
    raw["payload"] = {
        "mimeType": "multipart/alternative",
        "headers": raw["payload"]["headers"],
        "parts": [
            {"mimeType": "text/html", "body": {"data": _b64("<p>hi</p>")}},
            {"mimeType": "text/plain", "body": {"data": _b64("plain text body")}},
        ],
    }
    msg = parse_message(raw)
    assert msg.body_text == "plain text body"


def test_parse_message_no_reply_to_is_none():
    msg = parse_message(_raw_message(in_reply_to=None))
    assert msg.in_reply_to is None


# --- GmailClient -----------------------------------------------------------------


class _FakeCreds:
    valid = True
    token = "fake-access-token"


class _FakeResponse:
    def __init__(self, json_body, status=200):
        self._json = json_body
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._json


class _FakeSession:
    def __init__(self, get_responses=None, post_responses=None):
        self._get_responses = list(get_responses or [])
        self._post_responses = list(post_responses or [])
        self.get_calls: list[tuple] = []
        self.post_calls: list[tuple] = []

    def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        return self._get_responses.pop(0)

    def post(self, url, **kwargs):
        self.post_calls.append((url, kwargs))
        return self._post_responses.pop(0)


def test_list_new_threads_returns_parsed_messages():
    session = _FakeSession(
        get_responses=[
            _FakeResponse({"messages": [{"id": "18abc"}]}),
            _FakeResponse(_raw_message()),
        ]
    )
    client = GmailClient(session=session, credentials=_FakeCreds())
    threads = client.list_new_threads()
    assert len(threads) == 1
    assert threads[0].message_id == "<reply123@mail.gmail.com>"
    # Auth header carries the (fake) access token on every call.
    assert session.get_calls[0][1]["headers"]["Authorization"] == "Bearer fake-access-token"


def test_list_new_threads_empty_when_nothing_matches():
    session = _FakeSession(get_responses=[_FakeResponse({})])
    client = GmailClient(session=session, credentials=_FakeCreds())
    assert client.list_new_threads() == []


def test_list_new_threads_fail_safe_on_error():
    class _Boom(_FakeSession):
        def get(self, url, **kwargs):
            raise ConnectionError("network down")

    client = GmailClient(session=_Boom(), credentials=_FakeCreds())
    assert client.list_new_threads() == []


def test_send_reply_threads_correctly_and_returns_the_new_message_id():
    session = _FakeSession(
        get_responses=[
            _FakeResponse(
                {"payload": {"headers": [{"name": "Message-ID", "value": "<sent789@gmail>"}]}}
            )
        ],
        post_responses=[_FakeResponse({"id": "18sent"})],
    )
    client = GmailClient(session=session, credentials=_FakeCreds())
    result = client.send_reply(
        thread_id="18xyz",
        in_reply_to_message_id="<orig456@settl>",
        to="debtor@acme.test",
        from_address="ar@vendor.test",
        subject="[Settl] Invoice reminder - INV-018",
        body_text="Thanks for confirming!",
    )
    assert result == "<sent789@gmail>"
    sent_body = session.post_calls[0][1]["json"]
    assert sent_body["threadId"] == "18xyz"
    # The raw MIME payload carries In-Reply-To/References for real threading.
    decoded = base64.urlsafe_b64decode(sent_body["raw"] + "==").decode()
    assert "In-Reply-To: <orig456@settl>" in decoded
    assert "Subject: Re: [Settl] Invoice reminder - INV-018" in decoded


def test_send_reply_does_not_double_prefix_a_subject_already_starting_with_re():
    session = _FakeSession(
        get_responses=[_FakeResponse({"payload": {"headers": []}})],
        post_responses=[_FakeResponse({"id": "18sent"})],
    )
    client = GmailClient(session=session, credentials=_FakeCreds())
    client.send_reply(
        thread_id="t", in_reply_to_message_id="<m@x>", to="a@b.com",
        from_address="c@d.com", subject="Re: already prefixed", body_text="hi",
    )
    decoded = base64.urlsafe_b64decode(session.post_calls[0][1]["json"]["raw"] + "==").decode()
    assert "Subject: Re: already prefixed" in decoded
    assert "Subject: Re: Re:" not in decoded


def test_send_reply_fail_safe_returns_none_on_send_error():
    class _Boom(_FakeSession):
        def post(self, url, **kwargs):
            raise ConnectionError("network down")

    client = GmailClient(session=_Boom(), credentials=_FakeCreds())
    result = client.send_reply(
        thread_id="t", in_reply_to_message_id="<m@x>", to="a@b.com",
        from_address="c@d.com", subject="hi", body_text="hi",
    )
    assert result is None
