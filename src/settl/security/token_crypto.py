"""Encrypt-at-rest for OAuth refresh tokens (SCHEMA.md §4).

The `oauth_tokens.encrypted_refresh_token` column has existed since Phase 0 of
this codebase with no implementation behind it - this is that implementation.
Symmetric, authenticated encryption (Fernet, from `cryptography` - already a
transitive dependency of this project, now declared directly) keyed by a single
app-wide key. "App-key encrypted at rest (env now, KMS later)" per the
migration's own comment - this module is the seam a future KMS-backed key
lookup would replace, without touching any caller.

Same opt-in-guard shape as `stripe_enabled()`/`gemini_enabled`: a caller must
check `token_encryption_enabled()` before calling `encrypt`/`decrypt` - this
never silently falls back to storing a token in plaintext.
"""

from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken

from settl.config import load_dotenv


def token_encryption_enabled() -> bool:
    """True only when a key is configured. Callers must check this first -
    encrypt()/decrypt() raise rather than silently no-op on a missing key, so a
    misconfiguration can never result in a plaintext token reaching storage."""
    load_dotenv()
    return bool(os.environ.get("SETTL_TOKEN_ENCRYPTION_KEY"))


def _fernet() -> Fernet:
    load_dotenv()
    key = os.environ.get("SETTL_TOKEN_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError(
            "SETTL_TOKEN_ENCRYPTION_KEY is not set - generate one with "
            "`python -c \"from cryptography.fernet import Fernet; "
            'print(Fernet.generate_key().decode())"` and put it in .env. '
            "Never commit it or log it."
        )
    return Fernet(key.encode())


def encrypt(plaintext: str) -> str:
    """A refresh token -> ciphertext safe to store in `encrypted_refresh_token`."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str, *, ttl_seconds: int | None = None) -> str:
    """The stored ciphertext -> the real plaintext. Raises ValueError on a
    corrupted/tampered value, a key mismatch, or (when ``ttl_seconds`` is given)
    an expired ciphertext - Fernet is authenticated, so this detects tampering
    rather than silently returning garbage. ``ttl_seconds`` is for short-lived
    values like an OAuth CSRF state token, not the long-lived refresh token."""
    try:
        return _fernet().decrypt(ciphertext.encode(), ttl=ttl_seconds).decode()
    except InvalidToken as exc:
        raise ValueError(
            "token ciphertext is invalid, expired, or was encrypted with a different key"
        ) from exc
