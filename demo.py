"""Dry run: drive every synthetic invoice through the real orchestrator and show
exactly how each one was handled — the decision-trace table, the unpaid-loop plan,
and a full JSON-Lines audit log written to ``runs/`` as the record of the run.

Usage:
    PYTHONPATH=src .venv/bin/python demo.py            # table + write audit log
    PYTHONPATH=src .venv/bin/python demo.py --log      # also print the log JSON

Synthetic data only — never for revenue or customer evidence (CLAUDE.md).
"""

from __future__ import annotations

import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from settl.audit import ExecutionLog
from settl.data import load_synthetic_invoices
from settl.orchestrator import Orchestrator, TerminalState, next_touch

RUNS_DIR = Path(__file__).with_name("runs")

# How each terminal state reads in the trace — the "knows when NOT to act" story.
_STATE_LABEL = {
    TerminalState.QUARANTINED: "QUARANTINE  → human (couldn't read it)",
    TerminalState.SKIPPED: "SKIP        → paid / not yet due",
    TerminalState.HELD: "HOLD        → cooldown, re-queue later",
    TerminalState.ESCALATED: "ESCALATE    → human review",
    TerminalState.AWAITING_APPROVAL: "AWAIT OK    → first-contact approval",
    TerminalState.SENT: "SENT        → cleared the gate, went out",
}


def _run_path() -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return RUNS_DIR / f"dry_run_{stamp}.jsonl"


def main(argv: list[str]) -> None:
    dump_log = "--log" in argv

    RUNS_DIR.mkdir(exist_ok=True)
    log_path = _run_path()
    log = ExecutionLog(jsonl_path=log_path)
    orch = Orchestrator(log=log)

    invoices = load_synthetic_invoices()
    results = orch.run_batch(invoices)

    header = f"{'ID':9} {'b2b':5} {'ovd':>4} {'status':9} {'outcome'}"
    print(header)
    print("-" * 78)
    by_id = {inv.invoice_id: inv for inv in invoices}
    for res in results:
        inv = by_id[res.invoice_id]
        print(
            f"{inv.invoice_id:9} {str(inv.is_b2b):5} {inv.days_overdue:>4} "
            f"{inv.status.value:9} {_STATE_LABEL[res.terminal_state]}"
        )
        if res.detail and res.terminal_state in (
            TerminalState.ESCALATED, TerminalState.QUARANTINED
        ):
            print(f"{'':30}↳ {res.detail}")

    # Summary by terminal state.
    counts = Counter(res.terminal_state for res in results)
    print("\nOutcome summary:")
    for state in TerminalState:
        if counts[state]:
            print(f"  {state.value:18} {counts[state]}")
    sent_or_held = [r for r in results if r.should_requeue]
    print(f"\nUnpaid loop — {len(sent_or_held)} invoice(s) re-queue:")
    for res in sent_or_held:
        loop = next_touch(res)
        print(f"  {res.invoice_id:9} {loop.reason}")

    print(f"\nAudit-log entries recorded: {len(log.entries)}")
    print(f"Audit log written to: {log_path.relative_to(Path.cwd()) if log_path.is_relative_to(Path.cwd()) else log_path}")
    if dump_log:
        print("\n--- execution log (JSON) ---")
        print(log.to_json())


if __name__ == "__main__":
    main(sys.argv[1:])
