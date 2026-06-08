"""Synthetic dataset for building/testing the decision core ONLY.

Per CLAUDE.md: synthetic data is never used for revenue or customer evidence.
"""

from settl.data.loader import load_synthetic_invoices, reference_date

__all__ = ["load_synthetic_invoices", "reference_date"]
