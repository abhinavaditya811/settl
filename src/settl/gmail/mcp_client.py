"""The orchestrator-process side of the MCP boundary: spawn the tenant's Gmail
MCP server as a subprocess and call its two tools over stdio (SCHEMA.md §7).

This is deliberately the one piece of Phase 6 NOT unit-tested - a real
subprocess round trip needs a real Python process and (transitively) real
Gmail credentials to mean anything. `api/inbound_mail_board.py` takes these as
injectable `fetch`/`send` callables specifically so its own logic (correlation,
lane routing, PaymentPlan negotiation) stays fully unit-testable against fakes;
this module is exercised in Phase 6e's manual verification instead.

Verified against the actually-installed mcp==1.28.1: `call_tool` returns a
`CallToolResult` whose `.structuredContent["result"]` carries the tool
function's real Python return value (confirmed by a local round-trip, not
assumed from docs) - per CLAUDE.md's SDK-verification rule.
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any


async def _call_tool(tenant_id: str, tool_name: str, arguments: dict[str, Any]) -> Any:
    from mcp import ClientSession
    from mcp.client.stdio import StdioServerParameters, stdio_client

    params = StdioServerParameters(
        command=sys.executable, args=["-m", "settl.gmail.mcp_server", tenant_id]
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments)
            if result.isError:
                text = " ".join(getattr(c, "text", "") for c in result.content)
                raise RuntimeError(f"{tool_name} failed: {text}")
            return (result.structuredContent or {}).get("result")


def fetch_new_messages(tenant_id: str) -> list[dict[str, Any]]:
    """Sync wrapper - the default `fetch` for InboundMailBoard.poll."""
    return asyncio.run(_call_tool(tenant_id, "read_threads", {})) or []


def send_reply(tenant_id: str, **kwargs: Any) -> str | None:
    """Sync wrapper - the default `send` for InboundMailBoard.poll."""
    result = asyncio.run(_call_tool(tenant_id, "send_reply", kwargs))
    return (result or {}).get("message_id")
