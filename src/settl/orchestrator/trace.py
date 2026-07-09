"""Reusable decision-trace formatting (Week 6).

One source of truth for turning a run into the "AI knows when *not* to act" narrative:
the outcome table, the outcome summary, and the unpaid-loop plan. Pulled out of
``demo.py`` so the demo, the full-stack demo, and any report share the exact same
rendering. Also exposes ``describe_details`` - the humanized view of a log entry's
structured reasoning ("thought process"), so the dashboard drill-down and the CLI agree.

Pure formatting: takes invoices / results / log entries, returns strings or plain data.
"""

from __future__ import annotations

from collections import Counter
from typing import Iterable

from settl.orchestrator.loop import next_touch
from settl.orchestrator.result import PipelineResult, TerminalState
from settl.schema.invoice import Invoice

# How each terminal state reads in the trace - the "knows when NOT to act" story.
STATE_LABEL = {
    TerminalState.QUARANTINED: "QUARANTINE  → human (couldn't read it)",
    TerminalState.SKIPPED: "SKIP        → paid / not yet due",
    TerminalState.HELD: "HOLD        → cooldown, re-queue later",
    TerminalState.ESCALATED: "ESCALATE    → human review",
    TerminalState.AWAITING_APPROVAL: "AWAIT OK    → first-contact approval",
    TerminalState.SENT: "SENT        → cleared the gate, went out",
    TerminalState.RECOVERED: "RECOVERED   → paid, loop closed",
}

# Human labels for the structured `details` a log entry carries (the "why").
_DETAIL_LABELS = {
    "factors": "factors",
    "violation_codes": "gate codes",
    "waived_codes": "operator-waived",
    "tone": "tone",
    "channel": "channel",
    "include_late_fee": "late fee",
    "escalation_hint": "escalation hint",
}


def format_trace_table(invoices: Iterable[Invoice], results: list[PipelineResult]) -> str:
    """The per-invoice outcome table (ID, b2b, overdue, status, outcome + escalation why)."""
    by_id = {inv.invoice_id: inv for inv in invoices}
    lines = [f"{'ID':9} {'b2b':5} {'ovd':>4} {'status':9} {'outcome'}", "-" * 78]
    for res in results:
        inv = by_id[res.invoice_id]
        lines.append(
            f"{inv.invoice_id:9} {str(inv.is_b2b):5} {inv.days_overdue:>4} "
            f"{inv.status.value:9} {STATE_LABEL.get(res.terminal_state, res.terminal_state.value)}"
        )
        if res.detail and res.terminal_state in (
            TerminalState.ESCALATED, TerminalState.QUARANTINED
        ):
            lines.append(f"{'':30}↳ {res.detail}")
    return "\n".join(lines)


def format_summary(results: list[PipelineResult]) -> str:
    """Outcome counts by terminal state."""
    counts = Counter(res.terminal_state for res in results)
    lines = ["Outcome summary:"]
    for state in TerminalState:
        if counts[state]:
            lines.append(f"  {state.value:18} {counts[state]}")
    return "\n".join(lines)


def format_loop_plan(results: list[PipelineResult]) -> str:
    """Which invoices re-queue for the unpaid loop, and when."""
    requeue = [r for r in results if r.should_requeue]
    lines = [f"Unpaid loop - {len(requeue)} invoice(s) re-queue:"]
    for res in requeue:
        lines.append(f"  {res.invoice_id:9} {next_touch(res).reason}")
    return "\n".join(lines)


def describe_details(details: dict) -> list[tuple[str, str]]:
    """Humanize a log entry's structured reasoning into (label, value) pairs, skipping
    empty ones. Shared by the CLI trace and the dashboard drill-down so they never drift."""
    out: list[tuple[str, str]] = []
    for key, value in details.items():
        if value in (None, "", [], {}):
            continue
        label = _DETAIL_LABELS.get(key, key.replace("_", " "))
        if isinstance(value, dict):
            value = ", ".join(f"{k}={v}" for k, v in value.items())
        elif isinstance(value, (list, tuple)):
            value = ", ".join(str(v) for v in value)
        out.append((label, str(value)))
    return out
