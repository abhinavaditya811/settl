"""Server-side scheduled inbound-mail polling (SCHEMA.md §7).

A background loop, started from main.py's lifespan, that polls every tenant's
Gmail on a fixed interval - independent of a dashboard tab being open. This is
the missing half of FR-5's "poll, not Gmail watch/Pub/Sub" decision: the poll
existed (``POST /check-inbound-mail``) but nothing called it unless a browser
was open and wired to it. Real push (Cloud Pub/Sub + ``users.watch``) was
considered and deliberately deferred - it needs a publicly reachable HTTPS
endpoint (no localhost) and a 7-day watch-renewal job; a scheduled poll gets
the same "board updates without a tab open" outcome with far less to run and
nothing that can silently stop delivering if a renewal is missed.

``poll_inbound_mail`` (by way of gmail/mcp_client.py) calls ``asyncio.run()``
internally to talk to the MCP subprocess, which cannot be called from inside
an already-running event loop - so each pass runs in a worker thread via
``asyncio.to_thread`` rather than being awaited directly.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator, Callable, Protocol

from settl.data import supabase as db

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL_SECONDS = 120  # 2 minutes

# Per-tenant last-poll bookkeeping (scheduled AND manual /check-inbound-mail
# calls both record here) - in-memory/per-process like BoardState, exposed via
# /health so "is the poll actually running" is answerable without reading logs.
_last_polled_at: dict[str, str] = {}
_last_error: dict[str, str] = {}


def record_poll(tenant_id: str, *, error: str | None = None) -> None:
    _last_polled_at[tenant_id] = datetime.now(timezone.utc).isoformat()
    if error is None:
        _last_error.pop(tenant_id, None)
    else:
        _last_error[tenant_id] = error


def poll_status() -> dict:
    return {
        "enabled": poll_enabled(),
        "last_polled_at": dict(_last_polled_at),
        "errors": dict(_last_error),
    }


class _PollableState(Protocol):
    def poll_inbound_mail(self, tenant_id: str) -> list[str]: ...


def poll_interval_seconds() -> int:
    return int(os.environ.get("SETTL_INBOUND_POLL_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS))


def poll_enabled() -> bool:
    """Opt-out switch (default on) - e.g. SETTL_INBOUND_POLL_ENABLED=0 while
    manually testing inbound-mail changes, so nothing fires on its own timer
    and every send is a deliberate, single POST /check-inbound-mail call."""
    return os.environ.get("SETTL_INBOUND_POLL_ENABLED", "1") != "0"


def poll_all_connected_tenants(
    state: _PollableState, *, list_tenants: Callable[[], list[str]] | None = None
) -> list[str]:
    """One polling pass across every tenant with a connected Gmail token.
    Fail-safe per tenant - one tenant's error (rate limit, revoked token,
    transient DB issue) is logged and never blocks the rest. No-op ([]) when
    Supabase isn't armed (there's nowhere to look up connected tenants)."""
    if not db.supabase_enabled():
        return []
    list_tenants = list_tenants or db.list_connected_tenants
    changed: list[str] = []
    for tenant_id in list_tenants():
        try:
            changed.extend(state.poll_inbound_mail(tenant_id))
        except Exception as exc:
            logger.exception("inbound-mail poll failed for tenant %s", tenant_id)
            record_poll(tenant_id, error=str(exc))
        else:
            record_poll(tenant_id)
    return changed


async def run_forever(
    state: _PollableState,
    *,
    interval_seconds: int | None = None,
    sleep: Callable[[float], "asyncio.Future"] = asyncio.sleep,
) -> None:
    """Poll-then-sleep, forever - a fresh server picks up any backlog
    immediately rather than waiting a full interval. Cancel the task (e.g. on
    app shutdown) to stop it; ``sleep`` is injectable so tests don't wait."""
    interval = interval_seconds if interval_seconds is not None else poll_interval_seconds()
    while True:
        await asyncio.to_thread(poll_all_connected_tenants, state)
        await sleep(interval)


def lifespan_for(state: _PollableState):
    """A FastAPI ``lifespan=`` callable bound to ``state`` - main.py just does
    ``FastAPI(lifespan=inbound_poll_scheduler.lifespan_for(state))``. Starts the
    poll loop as a background task on app startup, cancels it cleanly on shutdown."""

    @asynccontextmanager
    async def _lifespan(_app) -> AsyncIterator[None]:
        task = asyncio.create_task(run_forever(state)) if poll_enabled() else None
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    return _lifespan
