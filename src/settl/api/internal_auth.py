"""Shared-secret gate for the Next.js proxy -> engine identity boundary (Phase 1).

FastAPI is publicly reachable directly (not just through the Next.js proxy), so a
forwarded "this is Google account X" header is forgeable on its own - anyone could
set X-Settl-Google-Sub against the public Cloud Run URL. This secret is the only
thing that makes the engine willing to trust that header. Constant-time compare so
timing can't leak the secret a byte at a time; an unset env var never trusts a
request - fail closed, the same posture as every SETTL_USE_* flag in this codebase.
"""

from __future__ import annotations

import hmac
import os


def verify_internal_secret(provided: str | None) -> bool:
    expected = os.environ.get("SETTL_INTERNAL_SECRET")
    if not expected or not provided:
        return False
    return hmac.compare_digest(provided, expected)
