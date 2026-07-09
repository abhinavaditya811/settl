"""Money + aging aggregates for the dashboard overview.

Pure projection over the engine's per-invoice results - no state, no side effects. Kept
out of ``state.py`` so ``BoardState`` stays focused on running the engine and holding
results; this is just the read-model the overview cockpit renders.

Totals are computed on the **primary** currency (the one most invoices use) so figures
are never summed across currencies; any other currencies are listed for context.
"""

from __future__ import annotations

from settl.orchestrator import TerminalState
from settl.orchestrator.result import PipelineResult
from settl.schema.invoice import Invoice

_IN_FLIGHT_STATES = {
    TerminalState.SENT, TerminalState.AWAITING_APPROVAL, TerminalState.HELD,
}


def compute_metrics(rows: list[tuple[Invoice, PipelineResult]]) -> dict:
    """Aggregate (invoice, result) rows into the overview metrics contract."""
    ccy_counts: dict[str, int] = {}
    for inv, _ in rows:
        ccy_counts[inv.currency] = ccy_counts.get(inv.currency, 0) + 1
    primary = max(ccy_counts, key=ccy_counts.get) if ccy_counts else "USD"
    others = sorted(c for c in ccy_counts if c != primary)

    outstanding = in_flight = recovered = awaiting_amount = 0.0
    awaiting_count = 0
    buckets = {"0-30 days": [0, 0.0], "31-60 days": [0, 0.0], "61+ days": [0, 0.0]}
    for inv, res in rows:
        if inv.currency != primary:
            continue
        amt = float(inv.amount_due)
        # Recovered = paid at ingestion OR reconciled to RECOVERED by the engine.
        is_recovered = (
            inv.status.value == "paid" or res.terminal_state is TerminalState.RECOVERED
        )
        if is_recovered:
            recovered += amt
        else:
            outstanding += amt
        if not is_recovered and res.terminal_state in _IN_FLIGHT_STATES:
            in_flight += amt
        if res.terminal_state is TerminalState.AWAITING_APPROVAL:
            awaiting_count += 1
            awaiting_amount += amt
        if not is_recovered and inv.days_overdue > 0:
            key = "0-30 days" if inv.days_overdue <= 30 else (
                "31-60 days" if inv.days_overdue <= 60 else "61+ days"
            )
            buckets[key][0] += 1
            buckets[key][1] += amt

    return {
        "currency": primary,
        "other_currencies": others,
        "outstanding": round(outstanding, 2),
        "in_flight": round(in_flight, 2),
        "recovered": round(recovered, 2),
        "awaiting_count": awaiting_count,
        "awaiting_amount": round(awaiting_amount, 2),
        "aging": [
            {"bucket": k, "count": v[0], "amount": round(v[1], 2)}
            for k, v in buckets.items()
        ],
    }
