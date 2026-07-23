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
from settl.payments.currency import from_minor_units, to_minor_units
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

    def mint(
        self,
        invoice: Invoice,
        *,
        installment_index: int | None = None,
        amount: Decimal | None = None,
    ) -> str | None:
        """Mint a link for the invoice total, or - when ``installment_index`` is
        given (SCHEMA.md §8) - for one PaymentPlan installment's own ``amount``,
        cached and idempotency-keyed separately per installment so reconcile can
        tell which installment a payment settled without attribution guesswork."""
        if not self._api_key:
            return None
        # Non-custodial guard: never mint on a LIVE key without a connected account -
        # that would route real money through the platform.
        if self._api_key.startswith("sk_live_") and not self._connection_ref:
            return None
        amt = Decimal(amount) if amount is not None else Decimal(invoice.amount_due)
        if amt <= 0:
            return None
        cache_key = self._cache_key(invoice.invoice_id, installment_index)
        if cache_key in self._cache:
            return self._cache[cache_key]

        key = f"{invoice.tenant_id}-{invoice.invoice_id}"
        product_name = f"Invoice {invoice.invoice_id} - {invoice.debtor_name}"
        metadata = {"settl_invoice_id": invoice.invoice_id, "settl_tenant_id": invoice.tenant_id}
        if installment_index is not None:
            key = f"{key}-inst{installment_index}"
            product_name += f" (installment {installment_index + 1})"
            metadata["settl_installment_index"] = str(installment_index)
        base: dict = {"stripe_account": self._connection_ref} if self._connection_ref else {}
        try:
            client = self._get_client()
            price = client.v1.prices.create(
                {
                    "currency": invoice.currency.lower(),
                    # Smallest currency unit - correct for zero-decimal currencies too.
                    "unit_amount": to_minor_units(amt, invoice.currency),
                    "product_data": {"name": product_name},
                },
                {**base, "idempotency_key": f"settl-price-{key}"},
            )
            link = client.v1.payment_links.create(
                {
                    "line_items": [{"price": price.id, "quantity": 1}],
                    # Correlation tags so a webhook can route the payment/refund/dispute
                    # back to this invoice (SCHEMA.md §7).
                    "metadata": metadata,
                },
                {**base, "idempotency_key": f"settl-link-{key}"},
            )
            self._cache[cache_key] = link.url
            self._link_ids[cache_key] = link.id  # remembered for payment polling
            return link.url
        except Exception:
            return None  # fail-safe: caller falls back to the invoice link / hard-fails

    def link_id(self, invoice_id: str, *, installment_index: int | None = None) -> str | None:
        """The payment link id minted for this invoice (or one of its
        installments), None if not minted."""
        return self._link_ids.get(self._cache_key(invoice_id, installment_index))

    @staticmethod
    def _cache_key(invoice_id: str, installment_index: int | None) -> str:
        return invoice_id if installment_index is None else f"{invoice_id}:{installment_index}"

    def paid_sessions(self, link_id: str, currency: str = "usd") -> list[tuple[str, Decimal]]:
        """Every *paid* checkout session for a link as ``(reference, amount)`` in the
        major unit. ``reference`` is the session's payment_intent (falling back to the
        session id) - the SAME key a webhook uses - so the poll and the webhook never
        double-count the same payment. Paginated (no fixed cap); currency-correct;
        fail-safe (returns [] on any error)."""
        if not self._api_key or not link_id:
            return []
        opts = {"stripe_account": self._connection_ref} if self._connection_ref else None
        try:
            client = self._get_client()
            page = client.v1.checkout.sessions.list(
                {"payment_link": link_id, "limit": 100}, opts
            )
            out: list[tuple[str, Decimal]] = []
            for s in self._iter_all(page):
                if getattr(s, "payment_status", None) != "paid":
                    continue
                ref = getattr(s, "payment_intent", None) or getattr(s, "id", "") or link_id
                out.append((str(ref), from_minor_units(getattr(s, "amount_total", 0), currency)))
            return out
        except Exception:
            return []

    def paid_total(self, link_id: str, currency: str = "usd") -> Decimal | None:
        """Net paid across all sessions for a link, in the major unit, or None if
        nothing is paid / unavailable. Thin sum over :meth:`paid_sessions`."""
        total = sum((amt for _, amt in self.paid_sessions(link_id, currency)), Decimal(0))
        return total if total > 0 else None

    @staticmethod
    def _iter_all(page):
        """Iterate every item across all pages: prefer the SDK's auto-pager, else fall
        back to the single page's ``.data`` (keeps the fake test client working)."""
        auto = getattr(page, "auto_paging_iter", None)
        if callable(auto):
            return auto()
        return getattr(page, "data", [])
