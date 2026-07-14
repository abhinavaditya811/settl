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

# Third-party deps only (matches pyproject base + [api] extras). We do not
# install the local package, so settl is imported from /app/src.
RUN pip install --no-cache-dir \
    "pydantic>=2.6" \
    "fastapi>=0.110" \
    "uvicorn[standard]>=0.29" \
    "psycopg[binary]>=3.1"

COPY src ./src

# Cloud Run sets $PORT (default 8080). Bind 0.0.0.0 so the container is reachable.
EXPOSE 8080
CMD ["sh", "-c", "uvicorn settl.api.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
