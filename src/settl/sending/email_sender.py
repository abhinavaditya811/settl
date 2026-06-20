"""🔌 Real email sender over Gmail SMTP.

Sends a gate-cleared message as an email. It inherits the compliance refusal from
``GatedSender`` - it can only ever be reached for a PASS result - and reads all
credentials from the environment so nothing sensitive is ever hardcoded or
committed:

    SETTL_SMTP_USER          your Gmail address (the authenticated sender)
    SETTL_SMTP_APP_PASSWORD  a Gmail *app password* (not your login password)
    SETTL_TEST_RECIPIENT     (optional) force every email to this address - a
                             safety belt for self-tests so a synthetic debtor
                             address can never be emailed by accident.

Build order note: this is the contingent real-sending track (CLAUDE.md). It exists
for a controlled self-test to your own inbox; it is not wired into the default
offline pipeline, which keeps using the mock sender.
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage

from settl.audit.execution_log import ExecutionLog
from settl.schema.invoice import Channel, Invoice
from settl.sending.base import GatedSender

GMAIL_SMTP_HOST = "smtp.gmail.com"
GMAIL_SMTP_SSL_PORT = 465


class MissingCredentials(RuntimeError):
    """Raised when the SMTP env vars needed to send are not set."""


class GmailSmtpSender(GatedSender):
    """Delivers cleared messages via Gmail SMTP over SSL."""

    agent_name = "email_sender"

    def __init__(
        self,
        log: ExecutionLog | None = None,
        *,
        user: str | None = None,
        app_password: str | None = None,
        force_recipient: str | None = None,
        subject_prefix: str = "[Settl] Invoice reminder",
    ) -> None:
        super().__init__(log=log)
        self._user = user or os.environ.get("SETTL_SMTP_USER")
        self._password = app_password or os.environ.get("SETTL_SMTP_APP_PASSWORD")
        # force_recipient lets a self-test redirect every email to a known inbox.
        self._force_recipient = force_recipient or os.environ.get("SETTL_TEST_RECIPIENT")
        self._subject_prefix = subject_prefix

    @property
    def configured(self) -> bool:
        return bool(self._user and self._password)

    def _deliver(self, invoice: Invoice, message: str, channel: Channel | None) -> str:
        if not self.configured:
            raise MissingCredentials(
                "Set SETTL_SMTP_USER and SETTL_SMTP_APP_PASSWORD to send email."
            )
        recipient = self._force_recipient or invoice.debtor_contact

        email = EmailMessage()
        email["From"] = self._user
        email["To"] = recipient
        email["Subject"] = f"{self._subject_prefix} - {invoice.invoice_id}"
        email.set_content(message)

        with smtplib.SMTP_SSL(GMAIL_SMTP_HOST, GMAIL_SMTP_SSL_PORT) as smtp:
            smtp.login(self._user, self._password)
            smtp.send_message(email)

        redirected = " (redirected from %s)" % invoice.debtor_contact if (
            self._force_recipient and self._force_recipient != invoice.debtor_contact
        ) else ""
        return f"emailed {invoice.invoice_id} to {recipient}{redirected} via Gmail SMTP"
