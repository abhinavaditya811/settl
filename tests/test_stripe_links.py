"""Stripe payment-link minting - fail-safe, cached, and non-custodial.

The Stripe SDK is faked (no network, no key): we assert the minter creates a Price
then a Payment Link, caches per invoice, and - the safety property - never mints on a
LIVE key without a connected account (which would route real money through Settl).
"""

from datetime import date
from decimal import Decimal

from settl.payments.stripe_links import StripeLinkMinter, stripe_enabled
from settl.schema.invoice import Invoice, InvoiceStatus, Source


class _Price:
    id = "price_123"


class _Link:
    url = "https://buy.stripe.com/test_abc"


class _Resource:
    def __init__(self, calls, kind, result):
        self._calls, self._kind, self._result = calls, kind, result

    def create(self, params, options=None):
        self._calls.append((self._kind, params, options or {}))
        return self._result


class _V1:
    def __init__(self, calls):
        self.prices = _Resource(calls, "price", _Price())
        self.payment_links = _Resource(calls, "link", _Link())


class _FakeClient:
    def __init__(self):
        self.calls: list = []
        self.v1 = _V1(self.calls)


def _inv(amount="100.00", currency="USD", iid="INV-X") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=iid, tenant_id="t_demo", source=Source.CSV, source_ref="x",
        amount_due=Decimal(amount), currency=currency, issue_date=today, due_date=today,
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="a@b.co",
        is_b2b=True, late_fee_allowed=False, as_of_date=today,
    )


def test_mint_creates_price_then_link(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    url = StripeLinkMinter(client=fc).mint(_inv(amount="120.00"))
    assert url == "https://buy.stripe.com/test_abc"
    assert [c[0] for c in fc.calls] == ["price", "link"]  # order: price, then link
    assert fc.calls[0][1]["unit_amount"] == 12000  # dollars -> cents
    assert fc.calls[1][1]["line_items"][0]["price"] == "price_123"


def test_mint_is_cached_per_invoice(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    m = StripeLinkMinter(client=fc)
    inv = _inv()
    m.mint(inv)
    m.mint(inv)
    assert sum(1 for c in fc.calls if c[0] == "price") == 1  # minted once, then cached


def test_mint_refuses_live_key_without_connection(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_x")
    fc = _FakeClient()
    assert StripeLinkMinter(client=fc).mint(_inv()) is None
    assert fc.calls == []  # never called out - non-custodial guard


def test_mint_allows_live_key_with_connected_account(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_x")
    fc = _FakeClient()
    url = StripeLinkMinter(client=fc, connection_ref="acct_real").mint(_inv())
    assert url == "https://buy.stripe.com/test_abc"
    assert fc.calls[0][2]["stripe_account"] == "acct_real"  # direct charge on the vendor


def test_mint_without_key_returns_none(monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    monkeypatch.delenv("STRIPE_API_KEY", raising=False)
    monkeypatch.setattr("settl.payments.stripe_links.load_dotenv", lambda *a, **k: {})
    assert StripeLinkMinter(client=_FakeClient()).mint(_inv()) is None


def test_mint_skips_nonpositive_amount(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    assert StripeLinkMinter(client=_FakeClient()).mint(_inv(amount="0")) is None


def test_stripe_enabled_requires_flag_and_key(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    monkeypatch.delenv("SETTL_USE_STRIPE", raising=False)
    assert stripe_enabled() is False
    monkeypatch.setenv("SETTL_USE_STRIPE", "1")
    assert stripe_enabled() is True
