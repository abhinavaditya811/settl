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
    id = "plink_123"
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


def test_mint_tracks_the_link_id_for_polling(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    inv = _inv(iid="INV-Z")
    m = StripeLinkMinter(client=_FakeClient())
    m.mint(inv)
    assert m.link_id("INV-Z") == "plink_123"
    assert m.link_id("INV-NONE") is None


# --- per-installment minting (SCHEMA.md §8) -------------------------------------


def test_mint_per_installment_uses_the_installment_amount_not_invoice_total(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    inv = _inv(amount="300.00")  # invoice total - NOT what should be minted
    StripeLinkMinter(client=fc).mint(inv, installment_index=0, amount=Decimal("100.00"))
    assert fc.calls[0][1]["unit_amount"] == 10000  # the installment's own amount


def test_mint_per_installment_is_cached_separately_from_the_invoice_link(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    m = StripeLinkMinter(client=fc)
    inv = _inv(amount="300.00")
    m.mint(inv)  # whole-invoice link
    m.mint(inv, installment_index=0, amount=Decimal("100.00"))
    m.mint(inv, installment_index=1, amount=Decimal("100.00"))
    # Three distinct links minted - none of them reused another's cache slot.
    assert sum(1 for c in fc.calls if c[0] == "price") == 3
    # Re-minting the same three keys hits the cache - still only 3 total.
    m.mint(inv)
    m.mint(inv, installment_index=0, amount=Decimal("100.00"))
    assert sum(1 for c in fc.calls if c[0] == "price") == 3
    assert m.link_id(inv.invoice_id, installment_index=0) is not None
    assert m.link_id("nonexistent", installment_index=0) is None


def test_mint_per_installment_tags_metadata_with_the_index(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    inv = _inv()
    StripeLinkMinter(client=fc).mint(inv, installment_index=2, amount=Decimal("50.00"))
    link_call = next(c for c in fc.calls if c[0] == "link")
    assert link_call[1]["metadata"]["settl_installment_index"] == "2"


# --- payment detection (Stripe -> canonical event) ----------------------------


class _Sess:
    def __init__(self, payment_status, amount_total):
        self.payment_status = payment_status
        self.amount_total = amount_total


class _SessList:
    def __init__(self, data):
        self.data = data


class _SessionsRes:
    def __init__(self, data):
        self._data = data

    def list(self, params, options=None):
        return _SessList(self._data)


class _CheckoutClient:
    def __init__(self, sessions):
        self.v1 = type("V1", (), {"checkout": type("C", (), {"sessions": _SessionsRes(sessions)})()})()


def test_paid_total_sums_paid_sessions(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _CheckoutClient([_Sess("paid", 12000), _Sess("unpaid", 9900)])
    assert StripeLinkMinter(client=fc).paid_total("plink_1") == Decimal("120.00")


def test_paid_total_none_when_nothing_paid(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _CheckoutClient([_Sess("unpaid", 9900)])
    assert StripeLinkMinter(client=fc).paid_total("plink_1") is None


# --- money math: zero-decimal currencies + pagination -------------------------


def test_mint_zero_decimal_currency_does_not_multiply_by_100(monkeypatch):
    # JPY has no minor unit: 5000 yen must be sent as 5000, not 500000.
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _FakeClient()
    StripeLinkMinter(client=fc).mint(_inv(amount="5000", currency="JPY"))
    assert fc.calls[0][1]["unit_amount"] == 5000  # whole yen, not 500000


def test_paid_total_reads_zero_decimal_currency_as_whole_units(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    fc = _CheckoutClient([_Sess("paid", 5000)])  # 5000 yen
    assert StripeLinkMinter(client=fc).paid_total("plink_1", "jpy") == Decimal("5000")


class _PagedSessList:
    """A list result that only pages via auto_paging_iter (no .data), like the SDK."""

    def __init__(self, data):
        self._data = data

    def auto_paging_iter(self):
        return iter(self._data)


def test_paid_total_paginates_past_the_old_10_session_cap(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_x")
    # 25 paid sessions of $1 each - the old limit=10/no-pagination would undercount.
    sessions = [_Sess("paid", 100) for _ in range(25)]

    class _PagedCheckout:
        def __init__(self, data):
            res = type("R", (), {"list": lambda self, p, o=None: _PagedSessList(data)})()
            self.v1 = type("V1", (), {"checkout": type("C", (), {"sessions": res})()})()

    assert StripeLinkMinter(client=_PagedCheckout(sessions)).paid_total("plink_1") == Decimal("25.00")


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
