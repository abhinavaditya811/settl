"""Operator notification when an invoice is recovered.

This is an **operator-facing** update (to the vendor using Settl), NOT debtor outreach -
so it deliberately does NOT go through the compliance gate or the GatedSender (those
exist for messages to debtors). It always writes an activity-log entry, and optionally
emails the operator when live email is armed - to the account that sent the outreach
(SETTL_SMTP_USER), not the debtor-redirect address. With real per-tenant Gmail this
becomes the tenant's own From address; when Stripe drives detection, the payment notice
still lands with whoever sent the reminder.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Callable

from settl.agents.reconcile.fee import FeeRecord
from settl.audit.execution_log import ExecutionLog
from settl.config import load_dotenv
from settl.schema.invoice import Invoice

# (to, subject, body) -> None
EmailFn = Callable[[str, str, str], None]

GMAIL_SMTP_HOST = "smtp.gmail.com"
GMAIL_SMTP_SSL_PORT = 465


class OperatorNotifier:
    """Records (and optionally emails) a 'recovered' notice for the operator."""

    def __init__(self, log: ExecutionLog | None = None, *, email_fn: EmailFn | None = None) -> None:
        load_dotenv()
        self._log = log
        self._email_fn = email_fn  # injectable for tests; default built from env

    def notify_paid(self, invoice: Invoice, fee: FeeRecord) -> str:
        summary = (
            f"{invoice.invoice_id} ({invoice.debtor_name}) paid in full - "
            f"{fee.recovered_amount} {invoice.currency} recovered; success fee "
            f"{fee.fee_amount} {fee.currency} recorded (not collected)."
        )
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="reconcile_notify",
                decision="operator_notified",
                reasoning=summary,
                recovered_amount=str(fee.recovered_amount),
                fee_amount=str(fee.fee_amount),
            )
        fn = self._email_fn or _default_email_fn()
        if fn is not None:
            try:
                fn(_recipient(), f"[Settl] Recovered - {invoice.invoice_id}", summary)
            except Exception:
                pass  # the notification email is best-effort; the log entry is the record
        return summary


def _recipient() -> str | None:
    # The operator notification goes to the account that SENT the outreach - the
    # operator's own mailbox (SETTL_SMTP_USER) - NOT the debtor-redirect address.
    # With real per-tenant Gmail this becomes the tenant's own From address.
    return os.environ.get("SETTL_SMTP_USER")


def _default_email_fn() -> EmailFn | None:
    """Build an SMTP sender only when live email is armed and creds exist; else None."""
    if os.environ.get("SETTL_LIVE_SEND") != "1":
        return None
    user = os.environ.get("SETTL_SMTP_USER")
    password = os.environ.get("SETTL_SMTP_APP_PASSWORD")
    if not (user and password):
        return None

    def _send(to: str, subject: str, body: str) -> None:
        msg = EmailMessage()
        msg["From"] = user
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)
        with smtplib.SMTP_SSL(GMAIL_SMTP_HOST, GMAIL_SMTP_SSL_PORT) as smtp:
            smtp.login(user, password)
            smtp.send_message(msg)

    return _send
