"""Synthetic dataset for building/testing the decision core ONLY.

Per CLAUDE.md: synthetic data is never used for revenue or customer evidence.
"""

from settl.data.loader import load_synthetic_invoices, reference_date
from settl.data.tenants import config_for, load_synthetic_tenants

__all__ = [
    "load_synthetic_invoices",
    "reference_date",
    "config_for",
    "load_synthetic_tenants",
]
