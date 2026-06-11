"""Decision-core demo: run every synthetic invoice through the pipeline and print
the strategy + compliance + send decision for each, plus the full audit log.

Usage:
    PYTHONPATH=src .venv/bin/python demo.py            # the decision table
    PYTHONPATH=src .venv/bin/python demo.py --log       # also dump the JSON audit log

Synthetic data only — never for revenue or customer evidence (CLAUDE.md).
"""

from __future__ import annotations

import sys

from settl.agents.strategy import Action, StrategyAgent
from settl.audit import ExecutionLog
from settl.compliance import ComplianceGate
from settl.data import load_synthetic_invoices
from settl.schema import partition_invoices
from settl.sending import MockSender

DRAFT = (
    "Hi {name} — a friendly reminder that invoice {ref} is past due. "
    "Here is your secure payment link to settle it. Thank you!"
)


def main(dump_log: bool) -> None:
    log = ExecutionLog()
    strategy = StrategyAgent(log=log)
    gate = ComplianceGate(log=log)
    sender = MockSender(log=log)

    invoices = load_synthetic_invoices()
    actionable, quarantined = partition_invoices(invoices)
    quarantined_ids = {inv.invoice_id for inv, _ in quarantined}

    header = f"{'ID':8} {'b2b':5} {'ovd':>4} {'status':9} {'strategy':8} {'gate':9} {'sent':6} detail"
    print(header)
    print("-" * len(header) + "-" * 20)

    for inv in invoices:
        if inv.invoice_id in quarantined_ids:
            print(f"{inv.invoice_id:8} {'-':5} {'':>4} {'':9} {'QUARANT':8} {'-':9} {'-':6} "
                "flagged to human: incomplete invoice")
            continue

        decision = strategy.decide(inv)
        gate_dec, sent, detail = "-", "-", decision.reasoning[:52]

        if decision.action is Action.CHASE:
            msg = DRAFT.format(name=inv.debtor_name, ref=inv.invoice_id)
            result = gate.evaluate(inv, msg)
            gate_dec = result.decision.value
            sent = sender.send(inv, msg, result, decision.channel).sent
            detail = ",".join(result.codes) or "clean -> would send"
        elif decision.action is Action.REVIEW:
            result = gate.evaluate(inv)
            gate_dec = result.decision.value
            detail = ",".join(result.codes)

        print(f"{inv.invoice_id:8} {str(inv.is_b2b):5} {inv.days_overdue:>4} "
            f"{inv.status.value:9} {decision.action.value:8} {str(gate_dec):9} "
            f"{str(sent):6} {detail}")

    print(f"\nAudit-log entries recorded: {len(log.entries)}")
    if dump_log:
        print("\n--- execution log (JSON) ---")
        print(log.to_json())


if __name__ == "__main__":
    main(dump_log="--log" in sys.argv)
