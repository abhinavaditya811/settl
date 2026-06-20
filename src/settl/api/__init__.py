"""Settl engine API - the FastAPI HTTP layer the dashboard talks to.

Run locally:  uvicorn settl.api.main:app --reload --port 8000
"""

from settl.api.main import app

__all__ = ["app"]
