"""🔌 Gmail REST API client (SCHEMA.md §7) - decision core + fail-safe skeleton.

Calls the Gmail REST API directly (not google-api-python-client - lean, matches
this codebase's existing minimalism, e.g. the dependency-free .env loader)
using a refreshed OAuth access token. Fail-safe throughout: any error returns
an empty/None result rather than raising into the poller, same pattern as
StripeLinkMinter/GeminiDraftModel. Injectable `session` for tests - no real
network, no real Google call.

🔌 Verify field names/response shapes against current Gmail API docs before a
real end-to-end run - built from the well-documented, long-stable Gmail REST
API v1 shape, but confirm before wiring against a live mailbox per CLAUDE.md's
SDK-verification rule.
"""

from __future__ import annotations

import base64
from email.message import EmailMessage
from typing import Any

from settl.gmail.messages import GmailMessage, parse_message

GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"
TOKEN_URI = "https://oauth2.googleapis.com/token"


class GmailClient:
    def __init__(
        self,
        *,
        refresh_token: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        session: Any = None,
        credentials: Any = None,
    ) -> None:
        self._refresh_token = refresh_token
        self._client_id = client_id
        self._client_secret = client_secret
        self._session = session  # injectable requests.Session-like object, for tests
        # Injectable directly for tests - a duck-typed object with .valid/.token
        # bypasses the real Credentials/Request refresh machinery entirely, so
        # tests exercise THIS module's request/response handling, not Google's
        # own (separately, already-tested) OAuth refresh library.
        self._credentials = credentials

    def _creds(self):
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials

        if self._credentials is None:
            self._credentials = Credentials(
                token=None,
                refresh_token=self._refresh_token,
                token_uri=TOKEN_URI,
                client_id=self._client_id,
                client_secret=self._client_secret,
            )
        if not self._credentials.valid:
            self._credentials.refresh(Request(session=self._session))
        return self._credentials

    def _request(self, method: str, path: str, **kwargs) -> dict | None:
        import requests

        session = self._session or requests
        try:
            creds = self._creds()
            resp = getattr(session, method)(
                f"{GMAIL_API_BASE}{path}",
                headers={"Authorization": f"Bearer {creds.token}"},
                timeout=10,
                **kwargs,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def list_new_threads(
        self, *, query: str = "is:unread", max_results: int = 20
    ) -> list[GmailMessage]:
        """New inbound messages matching ``query`` (default: unread). Fail-safe
        - [] on any error (no key, expired refresh token, network failure)."""
        listing = self._request(
            "get", "/users/me/messages", params={"q": query, "maxResults": max_results}
        )
        if not listing or not listing.get("messages"):
            return []
        out: list[GmailMessage] = []
        for ref in listing["messages"]:
            raw = self._request(
                "get", f"/users/me/messages/{ref['id']}", params={"format": "full"}
            )
            if raw:
                out.append(parse_message(raw))
        return out

    def send_reply(
        self,
        *,
        thread_id: str,
        in_reply_to_message_id: str,
        to: str,
        from_address: str,
        subject: str,
        body_text: str,
    ) -> str | None:
        """Send a reply threaded onto an existing conversation. Returns the new
        Message-ID, or None if the send failed (fail-safe - caller decides what
        to do next, same shape as GatedSender's outcome.sent=False)."""
        msg = EmailMessage()
        msg["To"] = to
        msg["From"] = from_address
        msg["Subject"] = subject if subject.lower().startswith("re:") else f"Re: {subject}"
        msg["In-Reply-To"] = in_reply_to_message_id
        msg["References"] = in_reply_to_message_id
        msg.set_content(body_text)
        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")

        result = self._request(
            "post", "/users/me/messages/send", json={"raw": raw, "threadId": thread_id}
        )
        if result is None:
            return None
        # The send response doesn't echo the Message-ID header - fetch it once,
        # same as list_new_threads does for inbound messages.
        sent = self._request(
            "get", f"/users/me/messages/{result['id']}", params={"format": "metadata"}
        )
        if not sent:
            return None
        for h in sent.get("payload", {}).get("headers", []):
            if h.get("name", "").lower() == "message-id":
                return h.get("value")
        return None
