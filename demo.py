"""Dry run: drive every synthetic invoice through the real orchestrator and show
exactly how each one was handled - the decision-trace table, the unpaid-loop plan,
and a full JSON-Lines audit log written to ``runs/`` as the record of the run.

Usage:
    PYTHONPATH=src .venv/bin/python demo.py            # table + write audit log
    PYTHONPATH=src .venv/bin/python demo.py --log      # also print the log JSON

Synthetic data only - never for revenue or customer evidence (CLAUDE.md).
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

from settl.audit import ExecutionLog
from settl.data import load_synthetic_invoices
from settl.orchestrator import Orchestrator
from settl.orchestrator.trace import format_loop_plan, format_summary, format_trace_table

RUNS_DIR = Path(__file__).with_name("runs")


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

    print(format_trace_table(invoices, results))
    print()
    print(format_summary(results))
    print()
    print(format_loop_plan(results))

    print(f"\nAudit-log entries recorded: {len(log.entries)}")
    print(f"Audit log written to: {log_path.relative_to(Path.cwd()) if log_path.is_relative_to(Path.cwd()) else log_path}")
    if dump_log:
        print("\n--- execution log (JSON) ---")
        print(log.to_json())


if __name__ == "__main__":
    main(sys.argv[1:])
