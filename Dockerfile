# Container image for the Settl engine API (FastAPI), for Cloud Run.
# The Next.js dashboard (web/) deploys separately to Vercel and is NOT in here.
#
# We run from source on PYTHONPATH rather than pip-installing the package, so the
# package stays under /app (a writable path) and the execution-log runs/ dir
# resolves to a writable location. SETTL_RUNS_DIR can override it regardless.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/src \
    SETTL_RUNS_DIR=/tmp/runs

WORKDIR /app

# Third-party deps only (matches pyproject base + [api]/[gemini]/[stripe]/[db]
# extras). We do not install the local package, so settl is imported from
# /app/src.
#
# cryptography is required at import time (settl.security.token_crypto uses
# cryptography.fernet at module load, pulled in via oauth_routes -> oauth_google).
# google-auth-oauthlib is ALSO required at import time via that same chain
# (oauth_google.py's Google OAuth Flow) - unlike stripe/google-genai below,
# missing it is NOT caught anywhere and 500s the /oauth/google/authorize route
# outright (observed live: ModuleNotFoundError: No module named
# 'google_auth_oauthlib'). requests is used by the Gmail REST client
# (settl.gmail) for inbound-reply reading.
# stripe/google-genai are lazy-imported (engine_factories.make_minter/make_drafter)
# and BOTH fail silently when missing (StripeLinkMinter.mint's except Exception:
# return None, and the Gemini path's own fallback) - so a missing package here
# never crashes the process, it just silently withholds sends / falls back to
# template drafting with no error surfaced. Verified live: SETTL_USE_STRIPE=1 +
# STRIPE_SECRET_KEY alone produced "no Stripe mint" in prod until this was added.
RUN pip install --no-cache-dir \
    "pydantic>=2.6" \
    "fastapi>=0.110" \
    "uvicorn[standard]>=0.29" \
    "psycopg[binary]>=3.1" \
    "cryptography>=42.0" \
    "google-auth>=2.30" \
    "google-auth-oauthlib>=1.2" \
    "requests>=2.31" \
    "stripe>=9.0" \
    "google-genai>=1.0"

COPY src ./src

# Cloud Run sets $PORT (default 8080). Bind 0.0.0.0 so the container is reachable.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn settl.api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
