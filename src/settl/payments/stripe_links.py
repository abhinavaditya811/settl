"""🔌 Stripe payment-link minting for the dev/demo "pay" flow.

Creates a permanent hosted Payment Link (https://buy.stripe.com/...) for an invoice
amount, so a reminder email points at a real, payable page. Built against the current
stripe-python v15 ``StripeClient.v1`` API (verified against the official SDK, not coded
from memory, per CLAUDE.md).

NON-CUSTODIAL (CLAUDE.md): in production the link is minted on the vendor's CONNECTED
account (``stripe_account`` → direct charge; funds settle to the vendor, never to Settl).
A platform key is allowed ONLY in test mode for dev/demo - a **live** key with no
connected account is refused, so we can never route real money through ourselves.

Fail-safe: a missing key/SDK or any API error returns ``None``; the caller falls back to
the invoice's own link or hard-fails the send. Minted URLs are cached per invoice (and an
idempotency key is sent) so a board refresh never creates duplicate Stripe objects.
"""

from __future__ import annotations

import os
from decimal import Decimal

from settl.config import load_dotenv
from settl.schema.invoice import Invoice


def _api_key() -> str | None:
    return os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")


def stripe_enabled() -> bool:
    """Opt-in (SETTL_USE_STRIPE=1) AND a key present - mirrors SETTL_USE_GEMINI, so the
    board doesn't create Stripe objects on every run just because a key sits in .env."""
    return os.environ.get("SETTL_USE_STRIPE") == "1" and bool(_api_key())


class StripeLinkMinter:
    """Mints (and caches) a hosted Stripe Payment Link per invoice."""

    def __init__(self, *, api_key: str | None = None, connection_ref: str | None = None, client=None) -> None:
        load_dotenv()  # surface a .env key to the SDK
        self._api_key = api_key or _api_key()
        self._connection_ref = connection_ref  # vendor's connected acct (direct charge)
        self._client = client  # injectable for tests; created lazily otherwise
        self._cache: dict[str, str] = {}  # invoice_id -> hosted url
        self._link_ids: dict[str, str] = {}  # invoice_id -> payment link id (for polling)

    def _get_client(self):
        if self._client is None:
            import stripe  # lazy import: the SDK is an optional extra

            self._client = stripe.StripeClient(self._api_key)
        return self._client

    def mint(self, invoice: Invoice) -> str | None:
        if not self._api_key:
            return None
        # Non-custodial guard: never mint on a LIVE key without a connected account -
        # that would route real money through the platform.
        if self._api_key.startswith("sk_live_") and not self._connection_ref:
            return None
        amount = Decimal(invoice.amount_due)
        if amount <= 0:
            return None
        if invoice.invoice_id in self._cache:
            return self._cache[invoice.invoice_id]

        key = f"{invoice.tenant_id}-{invoice.invoice_id}"
        base: dict = {"stripe_account": self._connection_ref} if self._connection_ref else {}
        try:
            client = self._get_client()
            price = client.v1.prices.create(
                {
                    "currency": invoice.currency.lower(),
                    "unit_amount": int(amount * 100),  # smallest currency unit (cents)
                    "product_data": {
                        "name": f"Invoice {invoice.invoice_id} - {invoice.debtor_name}"
                    },
                },
                {**base, "idempotency_key": f"settl-price-{key}"},
            )
            link = client.v1.payment_links.create(
                {"line_items": [{"price": price.id, "quantity": 1}]},
                {**base, "idempotency_key": f"settl-link-{key}"},
            )
            self._cache[invoice.invoice_id] = link.url
            self._link_ids[invoice.invoice_id] = link.id  # remembered for payment polling
            return link.url
        except Exception:
            return None  # fail-safe: caller falls back to the invoice link / hard-fails

    def link_id(self, invoice_id: str) -> str | None:
        """The payment link id minted for this invoice (None if not minted)."""
        return self._link_ids.get(invoice_id)

    def paid_total(self, link_id: str) -> Decimal | None:
        """Sum of *paid* checkout sessions for a payment link, in the major unit
        (dollars), or None if nothing is paid / unavailable. This is the Stripe →
        canonical-event detection the reconcile loop polls. Fail-safe."""
        if not self._api_key or not link_id:
            return None
        opts = {"stripe_account": self._connection_ref} if self._connection_ref else None
        try:
            client = self._get_client()
            sessions = client.v1.checkout.sessions.list(
                {"payment_link": link_id, "limit": 10}, opts
            )
            total = Decimal(0)
            for s in getattr(sessions, "data", []):
                if getattr(s, "payment_status", None) == "paid":
                    total += Decimal(getattr(s, "amount_total", 0) or 0) / 100
            return total if total > 0 else None
        except Exception:
            return None
