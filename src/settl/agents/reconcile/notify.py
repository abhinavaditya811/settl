"""Operator notification when an invoice is recovered.

This is an **operator-facing** update (to the vendor using Settl), NOT debtor outreach -
so it deliberately does NOT go through the compliance gate or the GatedSender (those
exist for messages to debtors). It always writes an activity-log entry, and optionally
emails the operator when live email is armed - to the account that sent the outreach
(SETTL_SMTP_USER), not the debtor-redirect address. With real per-tenant Gmail this
becomes the tenant's own From address; when Stripe drives detection, the payment notice
still lands with whoever sent the reminder.

**Demo-tenant guard.** This is a real, separate email path from the debtor sender
(sending/email_sender.py), so it needs its OWN demo guard: an invoice belonging to a
demo/synthetic tenant (``demo_tenant_ids``, injected from api/state.py) never emails a
notification, unless ``SETTL_LIVE_SEND_DEMO=1`` opts in - and then to the demo-specific
recipient (SETTL_DEMO_SMTP_USER / SETTL_DEMO_TEST_RECIPIENT) if configured, keeping demo
reconcile notices out of the inbox used for real testing. Without this, every restart's
replay of persisted payment events re-fires a batch of "[Settl] Recovered / Needs review"
emails for the ~25 synthetic seed invoices (an observed spam source).
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

    def __init__(
        self,
        log: ExecutionLog | None = None,
        *,
        email_fn: EmailFn | None = None,
        demo_tenant_ids: frozenset[str] = frozenset(),
    ) -> None:
        load_dotenv()
        self._log = log
        self._email_fn = email_fn  # injectable for tests; default built from env
        self._demo_tenant_ids = demo_tenant_ids

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
        self._email(invoice, f"[Settl] Recovered - {invoice.invoice_id}", summary)
        return summary

    def notify_escalation(self, invoice: Invoice, reason: str) -> str:
        """Record (and optionally email) an escalation notice: a dispute, an inbound
        reply, or a data anomaly reconcile could not act on safely. Operator-facing,
        same non-gated path as ``notify_paid`` - this is not debtor outreach."""
        summary = f"{invoice.invoice_id} ({invoice.debtor_name}) needs review - {reason}"
        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="reconcile_notify",
                decision="operator_escalated",
                reasoning=summary,
            )
        self._email(invoice, f"[Settl] Needs review - {invoice.invoice_id}", summary)
        return summary

    def _email(self, invoice: Invoice, subject: str, body: str) -> None:
        demo = invoice.tenant_id in self._demo_tenant_ids
        if demo and os.environ.get("SETTL_LIVE_SEND_DEMO") != "1":
            return  # demo notification suppressed - the log entry is the record
        recipient = _recipient(demo)
        fn = self._email_fn or _default_email_fn(demo)
        if recipient and fn is not None:
            try:
                fn(recipient, subject, body)
            except Exception:
                pass  # the notification email is best-effort; the log entry is the record


def _recipient(demo: bool = False) -> str | None:
    # The operator notification goes to the account that SENT the outreach - the
    # operator's own mailbox (SETTL_SMTP_USER) - NOT the debtor-redirect address.
    # A demo notification (only reachable with SETTL_LIVE_SEND_DEMO=1) uses the
    # demo-specific inbox when configured, so it stays out of the real test inbox.
    if demo:
        return os.environ.get("SETTL_DEMO_TEST_RECIPIENT") or os.environ.get("SETTL_SMTP_USER")
    return os.environ.get("SETTL_SMTP_USER")


def _default_email_fn(demo: bool = False) -> EmailFn | None:
    """Build an SMTP sender only when live email is armed and creds exist; else None.
    A demo notification uses the demo-specific From account when configured."""
    if os.environ.get("SETTL_LIVE_SEND") != "1":
        return None
    if demo and os.environ.get("SETTL_DEMO_SMTP_USER"):
        user = os.environ.get("SETTL_DEMO_SMTP_USER")
        password = os.environ.get("SETTL_DEMO_SMTP_APP_PASSWORD")
    else:
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
