"""🔌 Real-send self-test: run ONE invoice through the real pipeline and actually
email the result to your own inbox via Gmail SMTP.

This is a controlled self-test, not customer outreach: it builds a single invoice
addressed to YOU and exercises the full path - strategy → draft → compliance gate →
first-contact human approval → real send - writing every hop to a JSONL audit log.

Setup - put your credentials in a local `.env` (gitignored):
    cp .env.example .env      # then fill in the three SETTL_SMTP_* values
or export them in the shell (an exported value overrides the file):
    export SETTL_SMTP_USER="you@gmail.com"
    export SETTL_SMTP_APP_PASSWORD="xxxx xxxx xxxx xxxx"   # Gmail *app password*
    export SETTL_TEST_RECIPIENT="you@gmail.com"            # where the test lands

Run:
    PYTHONPATH=src .venv/bin/python send_live.py            # asks before sending
    PYTHONPATH=src .venv/bin/python send_live.py --yes      # skip the prompt

Refuses to do anything if the SMTP env vars are missing.
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from settl.audit import ExecutionLog
from settl.config import load_dotenv
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import Invoice, InvoiceStatus, Source
from settl.sending import GmailSmtpSender

RUNS_DIR = Path(__file__).with_name("runs")


def _self_test_invoice(recipient: str) -> Invoice:
    """A single, realistic B2B invoice addressed to you - first contact, so it
    exercises the one-tap approval before anything sends."""
    today = date.today()
    return Invoice(
        invoice_id="LIVE-001",
        tenant_id="t_selftest",
        source=Source.CSV,
        source_ref="self-test",
        amount_due=Decimal("1450.00"),
        currency="USD",
        issue_date=today - timedelta(days=45),
        due_date=today - timedelta(days=15),
        status=InvoiceStatus.OPEN,
        debtor_name="Acme Co (self-test)",
        debtor_email=recipient,
        is_b2b=True,
        late_fee_allowed=True,
        payment_link="https://buy.stripe.com/test_live_001",  # so the placeholder resolves
        prior_contacts=[],  # first contact → must clear human approval
        as_of_date=today,
        raw={"note": "live self-test invoice - synthetic, addressed to the operator"},
    )


def main(argv: list[str]) -> int:
    auto_yes = "--yes" in argv
    load_dotenv()  # pull SETTL_SMTP_* from .env if present (shell exports win)

    user = os.environ.get("SETTL_SMTP_USER")
    password = os.environ.get("SETTL_SMTP_APP_PASSWORD")
    recipient = os.environ.get("SETTL_TEST_RECIPIENT") or user
    if not (user and password):
        print(
            "Missing credentials. Set SETTL_SMTP_USER and SETTL_SMTP_APP_PASSWORD "
            "(a Gmail app password) before running. See the module docstring."
        )
        return 1

    RUNS_DIR.mkdir(exist_ok=True)
    log = ExecutionLog(jsonl_path=RUNS_DIR / "live_self_test.jsonl")
    sender = GmailSmtpSender(log=log, force_recipient=recipient)
    orch = Orchestrator(log=log, sender=sender)

    invoice = _self_test_invoice(recipient)
    print(f"Running LIVE-001 through the real pipeline (recipient: {recipient})\n")
    result = orch.run_one(invoice)

    print(f"Pipeline outcome: {result.terminal_state.value.upper()}")
    if result.detail:
        print(f"  {result.detail}")

    if result.terminal_state is not TerminalState.AWAITING_APPROVAL:
        # SENT (would only happen for a repeat contact), ESCALATED, etc.
        print("\nNothing to approve - the pipeline did not stop for first-contact sign-off.")
        return 0

    print("\n--- draft awaiting your approval (first contact, pilot-mode HITL) ---")
    print(result.message)
    print("-" * 64)

    if not auto_yes:
        reply = input("Approve and SEND this real email? [y/N] ").strip().lower()
        if reply != "y":
            print("Not approved - nothing sent. (Logged as held.)")
            return 0

    approved = orch.approve_and_send(invoice, result.message, invoice_channel(invoice))
    print(f"\n{approved.terminal_state.value.upper()}: {approved.detail}")
    print(f"Audit log: {(RUNS_DIR / 'live_self_test.jsonl')}")
    return 0


def invoice_channel(invoice: Invoice):
    from settl.agents.strategy import decide_strategy

    return decide_strategy(invoice).channel


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
