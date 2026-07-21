"""Encrypt-at-rest for OAuth refresh tokens (security/token_crypto.py)."""

import time

import pytest
from cryptography.fernet import Fernet

from settl.security import token_crypto


@pytest.fixture(autouse=True)
def _key(monkeypatch):
    monkeypatch.setenv("SETTL_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())


def test_token_encryption_enabled_reflects_the_env_var(monkeypatch):
    assert token_crypto.token_encryption_enabled() is True
    monkeypatch.delenv("SETTL_TOKEN_ENCRYPTION_KEY", raising=False)
    assert token_crypto.token_encryption_enabled() is False


def test_encrypt_decrypt_round_trips():
    ciphertext = token_crypto.encrypt("1//refresh-token-secret")
    assert ciphertext != "1//refresh-token-secret"  # never plaintext at rest
    assert token_crypto.decrypt(ciphertext) == "1//refresh-token-secret"


def test_decrypt_rejects_tampered_ciphertext():
    ciphertext = token_crypto.encrypt("secret")
    tampered = ciphertext[:-4] + "abcd"
    with pytest.raises(ValueError):
        token_crypto.decrypt(tampered)


def test_decrypt_rejects_a_different_keys_ciphertext(monkeypatch):
    ciphertext = token_crypto.encrypt("secret")
    monkeypatch.setenv("SETTL_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    with pytest.raises(ValueError):
        token_crypto.decrypt(ciphertext)


def test_decrypt_enforces_ttl_for_short_lived_values():
    ciphertext = token_crypto.encrypt("csrf-state")
    assert token_crypto.decrypt(ciphertext, ttl_seconds=60) == "csrf-state"
    # Fernet's ttl clock is integer-second-truncated, so a margin past a single
    # second boundary can still land inside the window - sleep past two.
    time.sleep(2.1)
    with pytest.raises(ValueError):
        token_crypto.decrypt(ciphertext, ttl_seconds=1)


def test_encrypt_raises_without_a_key_configured(monkeypatch):
    monkeypatch.delenv("SETTL_TOKEN_ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError):
        token_crypto.encrypt("secret")
