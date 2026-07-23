"""GmailMessage - the normalized shape client.py returns, and the raw-JSON
parsing to build one. Split from client.py to keep the HTTP-calling code and
the payload-parsing code separately testable and under CLAUDE.md's line cap.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class GmailMessage:
    """One inbound message, already flattened to what the rest of the pipeline
    needs (agents/inbound, contacts_store.write_contact - SCHEMA.md §7)."""

    message_id: str  # RFC822 Message-ID header - the provider_message_id
    thread_id: str  # Gmail's thread id - thread_ref
    in_reply_to: str | None  # RFC822 In-Reply-To header, if present
    references: str | None  # RFC822 References header, if present
    subject: str
    from_address: str
    body_text: str
    occurred_at: datetime


def _header(headers: list[dict], name: str) -> str | None:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value")
    return None


def _decode_b64url(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")


def _find_text_plain(payload: dict) -> str | None:
    """Recursively search a Gmail payload tree (multipart/alternative,
    multipart/mixed, ...) for the first text/plain part. None means "not found
    anywhere in this subtree" - distinct from "" (found, but empty), so the
    caller's fallback only fires when truly nothing text/plain exists."""
    if payload.get("mimeType") == "text/plain":
        data = payload.get("body", {}).get("data")
        return _decode_b64url(data) if data else ""
    for part in payload.get("parts") or []:
        text = _find_text_plain(part)
        if text is not None:
            return text
    return None


def _extract_text(payload: dict) -> str:
    """The plain-text body, never HTML, for classification/drafting. Falls back
    to whatever the top-level body carries only when no text/plain part exists
    anywhere in the tree (e.g. HTML-only mail) - never picks an HTML part."""
    found = _find_text_plain(payload)
    if found is not None:
        return found
    data = payload.get("body", {}).get("data")
    return _decode_b64url(data) if data else ""


def parse_message(raw: dict) -> GmailMessage:
    """A raw `users.messages.get` (format=full) JSON body -> GmailMessage."""
    headers = raw.get("payload", {}).get("headers", [])
    internal_date_ms = int(raw.get("internalDate", 0))
    return GmailMessage(
        message_id=_header(headers, "Message-ID") or raw["id"],
        thread_id=raw["threadId"],
        in_reply_to=_header(headers, "In-Reply-To"),
        references=_header(headers, "References"),
        subject=_header(headers, "Subject") or "",
        from_address=_header(headers, "From") or "",
        body_text=_extract_text(raw.get("payload", {})),
        occurred_at=datetime.fromtimestamp(internal_date_ms / 1000, tz=timezone.utc),
    )
