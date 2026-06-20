"""Loads the synthetic dataset into canonical Invoices.

This loader plays the role a real source adapter will play later: it takes raw
records and emits the canonical Invoice shape - nothing downstream knows or cares
that the source was a fixture file. Crucially it sets ``as_of_date`` so the engine
computes ``days_overdue`` itself; the fixture never carries that field.
"""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

from settl.schema.invoice import Invoice

_DATASET = Path(__file__).with_name("synthetic_invoices.json")


@lru_cache(maxsize=1)
def _raw() -> dict:
    return json.loads(_DATASET.read_text())


def reference_date() -> date:
    """The fixed 'today' the synthetic set is anchored to, for reproducible tests."""
    return date.fromisoformat(_raw()["reference_date"])


def load_synthetic_invoices() -> list[Invoice]:
    data = _raw()
    as_of = date.fromisoformat(data["reference_date"])
    invoices: list[Invoice] = []
    for record in data["invoices"]:
        # Defensive: a source must never assert days_overdue - we compute it.
        record = {k: v for k, v in record.items() if k != "days_overdue"}
        invoices.append(Invoice(as_of_date=as_of, **record))
    return invoices
