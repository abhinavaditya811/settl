"""🔌 MCP server: the token-contained edge for Gmail (SCHEMA.md §7).

Two tools, not the three originally sketched in SCHEMA.md's first draft -
drafting a reply doesn't touch the Gmail token at all (it's classification and
composition, already built as agents/inbound + agents/drafting/reply_*), so it
stays in the main orchestrator process instead of being smuggled through this
narrow boundary. Only the two things that actually need the token live here:
reading Gmail, and sending through it. SCHEMA.md §7 updated to match.

Run as its own process per tenant (`python -m settl.gmail.mcp_server <tenant_id>`,
stdio transport) - decrypts and holds that tenant's Gmail token for its own
process lifetime, never handing the raw token to the orchestrator process.

The tool logic (`_read_threads`/`_send_reply`) takes the client as a plain
argument rather than closing over it, so tests call them directly - no MCP
transport, no decorator internals - while `build_server` wires the same
functions up as real `@mcp.tool()`s for the live stdio server.

🔌 mcp.server.fastmcp's API verified against the actually-installed mcp==1.28.1
(pinned below its breaking 2.0 rewrite in pyproject.toml) - reconfirm if that
pin is ever bumped, per CLAUDE.md's SDK-verification rule.
"""

from __future__ import annotations

import dataclasses
import os
from typing import Any

from settl.gmail.client import GmailClient
from settl.gmail.messages import GmailMessage


def _serialize_message(msg: GmailMessage) -> dict[str, Any]:
    data = dataclasses.asdict(msg)
    data["occurred_at"] = msg.occurred_at.isoformat()
    return data


def _read_threads(
    client: GmailClient, *, query: str = "in:inbox newer_than:30d", max_results: int = 20
) -> list[dict[str, Any]]:
    return [
        _serialize_message(m)
        for m in client.list_new_threads(query=query, max_results=max_results)
    ]


def _send_reply(
    client: GmailClient,
    *,
    thread_id: str,
    in_reply_to_message_id: str,
    to: str,
    from_address: str,
    subject: str,
    body_text: str,
) -> dict[str, Any]:
    message_id = client.send_reply(
        thread_id=thread_id,
        in_reply_to_message_id=in_reply_to_message_id,
        to=to,
        from_address=from_address,
        subject=subject,
        body_text=body_text,
    )
    return {"sent": message_id is not None, "message_id": message_id}


def build_server(client: GmailClient):
    """The live server, wiring the two tools above to the real MCP transport.
    A fresh import of mcp.server.fastmcp per call - keeps the mcp package an
    optional/lazy dependency, same convention as every other 🔌 SDK import."""
    from mcp.server.fastmcp import FastMCP

    mcp = FastMCP("settl-gmail")

    @mcp.tool()
    def read_threads(
        query: str = "in:inbox newer_than:30d", max_results: int = 20
    ) -> list[dict[str, Any]]:
        """Inbound Gmail messages matching ``query`` (default: inbox only, last
        30 days - see GmailClient.list_new_threads for why ``in:inbox`` matters).
        Not ``is:unread`` - a vendor who reads a reply in their own Gmail client
        before the next poll would otherwise make it invisible here;
        ``already_processed()`` (Supabase message-id dedup) is what actually
        guards against reprocessing, not the read/unread flag."""
        return _read_threads(client, query=query, max_results=max_results)

    @mcp.tool()
    def send_reply(
        thread_id: str,
        in_reply_to_message_id: str,
        to: str,
        from_address: str,
        subject: str,
        body_text: str,
    ) -> dict[str, Any]:
        """Send a reply threaded onto an existing Gmail conversation."""
        return _send_reply(
            client,
            thread_id=thread_id,
            in_reply_to_message_id=in_reply_to_message_id,
            to=to,
            from_address=from_address,
            subject=subject,
            body_text=body_text,
        )

    return mcp


def client_for_tenant(tenant_id: str) -> GmailClient:
    """Decrypt this tenant's stored Google refresh token and build a client for
    it. Raises RuntimeError (never guesses) if Supabase isn't armed or the
    tenant never connected - the same fail-loud posture token_crypto uses."""
    from settl.data import supabase as db
    from settl.security import token_crypto

    if not db.supabase_enabled():
        raise RuntimeError(
            "SETTL_USE_SUPABASE must be armed - the MCP server reads the "
            "tenant's stored OAuth token from Postgres"
        )
    token = db.load_token(tenant_id, "google")
    if token is None:
        raise RuntimeError(f"no Google OAuth token stored for tenant {tenant_id}")
    encrypted_refresh_token, _scopes = token
    return GmailClient(
        refresh_token=token_crypto.decrypt(encrypted_refresh_token),
        client_id=os.environ.get("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret=os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET"),
    )


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="settl Gmail MCP server (stdio)")
    parser.add_argument("tenant_id")
    args = parser.parse_args()
    build_server(client_for_tenant(args.tenant_id)).run(transport="stdio")


if __name__ == "__main__":
    main()
