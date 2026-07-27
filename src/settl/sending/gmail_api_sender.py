"""Per-tenant Gmail API sender (SCHEMA.md §7) - sends through the TENANT'S OWN
connected Gmail account instead of one shared SMTP identity, so a debtor sees
mail genuinely coming from their vendor rather than from Settl's own inbox.

Reuses the same OAuth token storage the "Connect Gmail" flow already writes
to (data/supabase/oauth_tokens_store.py) and the same Gmail API client already
built for inbound-reply sending (gmail/client.py) - this was previously wired
for reads/auto-replies only, never for the main approval-send path.

Fail-safe like every other sender here: no connected token (or no gmail.send
scope on it) raises DeliveryFailed, which GatedSender.send() reports as
withheld rather than crashing - see engine_factories.make_sender for the
fallback to the shared SMTP sender when a tenant hasn't connected Gmail yet.
"""

from __future__ import annotations

import os

from settl.data.supabase import oauth_tokens_store as tokens
from settl.gmail.client import GmailClient
from settl.schema.invoice import Channel, Invoice
from settl.security import token_crypto
from settl.sending.base import DeliveryFailed, GatedSender

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"


class GmailApiSender(GatedSender):
    """Delivers cleared messages via the Gmail API, authenticated as the
    invoice's own tenant (not a fixed shared account)."""

    agent_name = "gmail_api_sender"

    def __init__(
        self,
        log=None,
        *,
        client_id: str | None = None,
        client_secret: str | None = None,
        subject_prefix: str = "[Settl] Invoice reminder",
    ) -> None:
        super().__init__(log=log)
        self._client_id = client_id or os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
        self._client_secret = client_secret or os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
        self._subject_prefix = subject_prefix

    def token_for(self, tenant_id: str) -> str | None:
        """This tenant's decrypted Gmail refresh token, or None if they haven't
        connected Gmail, connected it without the send scope, or the stored
        ciphertext no longer decrypts (key rotated, tampered row)."""
        if not token_crypto.token_encryption_enabled():
            return None
        stored = tokens.load_token(tenant_id, "google")
        if stored is None:
            return None
        encrypted, scopes = stored
        if GMAIL_SEND_SCOPE not in scopes:
            return None
        try:
            return token_crypto.decrypt(encrypted)
        except ValueError:
            return None

    def _deliver(self, invoice: Invoice, message: str, _channel: Channel | None) -> str:
        refresh_token = self.token_for(invoice.tenant_id)
        if refresh_token is None:
            raise DeliveryFailed(f"no connected Gmail (send scope) for tenant {invoice.tenant_id}")
        client = GmailClient(
            refresh_token=refresh_token,
            client_id=self._client_id,
            client_secret=self._client_secret,
        )
        message_id = client.send_new(
            to=invoice.debtor_email,
            from_address="me",  # Gmail API sends as the token's own account regardless
            subject=f"{self._subject_prefix} - {invoice.invoice_id}",
            body_text=message,
        )
        if message_id is None:
            raise DeliveryFailed(f"Gmail API send failed for {invoice.invoice_id}")
        return f"emailed {invoice.invoice_id} to {invoice.debtor_email} via the tenant's own Gmail"
