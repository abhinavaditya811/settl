"""Minimal, dependency-free `.env` loader.

Reads simple ``KEY=VALUE`` lines from a local ``.env`` into ``os.environ`` so the
real-send self-test (and later the dashboard) can pick up credentials without a
third-party package. Existing environment variables always win - an exported value
overrides the file - so this never clobbers what you set in the shell.

The ``.env`` file is gitignored; secrets never enter source control.
"""

from __future__ import annotations

import os
from pathlib import Path

_DEFAULT_ENV = Path(__file__).resolve().parents[2] / ".env"

# Default Gemini model id shared by every LLM agent (strategy judgment, drafting).
# The plain "gemini-3-pro" id does not exist; the real current id is the preview one.
# Free-tier keys often lack quota for it (429) - set GEMINI_MODEL to a free-tier model
# (e.g. gemini-2.5-flash) to override. The agents are fail-safe either way.
DEFAULT_GEMINI_MODEL = "gemini-3-pro-preview"


def gemini_model_name(override: str | None = None) -> str:
    """Resolve the model id: explicit override → GEMINI_MODEL env → shared default."""
    return override or os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)


def load_dotenv(path: str | Path | None = None) -> dict[str, str]:
    """Load KEY=VALUE pairs from ``path`` (default: repo-root ``.env``).

    Returns the keys that were applied. Lines that are blank, comments (``#``), or
    have an empty value are skipped. Surrounding quotes on values are stripped.
    """
    env_path = Path(path) if path else _DEFAULT_ENV
    applied: dict[str, str] = {}
    if not env_path.is_file():
        return applied

    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if not key or not value:
            continue
        os.environ.setdefault(key, value)  # shell-exported values take precedence
        applied[key] = value
    return applied
