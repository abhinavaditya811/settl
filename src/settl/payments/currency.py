"""Stripe currency-unit conversion - correct across zero-decimal currencies.

Stripe expresses amounts in the *smallest currency unit*. For most currencies that is
1/100 of the major unit (cents), but **zero-decimal currencies** (JPY, KRW, VND, …) have
no minor unit at all - the smallest unit *is* the major unit, so you must NOT multiply by
100. Hardcoding ``*100`` / ``/100`` would over/under-charge those currencies by 100×.

These helpers centralize the rule so both minting (major → minor) and payment detection
(minor → major) stay correct for every currency Stripe supports.
"""

from __future__ import annotations

from decimal import Decimal

# Currencies Stripe treats as zero-decimal (no minor unit). Source: Stripe docs.
ZERO_DECIMAL_CURRENCIES = frozenset(
    {
        "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
        "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
    }
)


def _factor(currency: str) -> int:
    """100 for normal currencies, 1 for zero-decimal ones."""
    return 1 if currency.lower() in ZERO_DECIMAL_CURRENCIES else 100


def to_minor_units(amount: Decimal, currency: str) -> int:
    """Major unit (e.g. dollars) → Stripe's smallest unit (e.g. cents, or whole yen)."""
    return int((Decimal(amount) * _factor(currency)).to_integral_value())


def from_minor_units(value: int | float | Decimal | None, currency: str) -> Decimal:
    """Stripe's smallest unit → major unit as a Decimal."""
    return Decimal(value or 0) / _factor(currency)
