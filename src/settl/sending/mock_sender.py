"""Mock sender — the only 'sending' that exists in task 1.

It never contacts a real channel. It logs exactly what it *would* send, and it
refuses to act on anything the compliance gate did not clear. That refusal is a
defensive backstop: the gate is the authority, but the sender will not send on an
ESCALATE result even if a caller wires the pipeline up wrong.
"""

from __future__ import annotations

from dataclasses import dataclass

from settl.audit.execution_log import ExecutionLog
from settl.compliance.gate import ComplianceResult
from settl.schema.invoice import Channel, Invoice


@dataclass(frozen=True)
class SendOutcome:
    sent: bool  # simulated send (True) vs. withheld (False)
    detail: str


class MockSender:
    def __init__(self, log: ExecutionLog | None = None) -> None:
        self._log = log

    def send(
        self,
        invoice: Invoice,
        message: str,
        compliance: ComplianceResult,
        channel: Channel | None = None,
    ) -> SendOutcome:
        if not compliance.passed:
            outcome = SendOutcome(
                sent=False,
                detail=(
                    f"WITHHELD {invoice.invoice_id}: compliance escalated "
                    f"({', '.join(compliance.codes)}) — routed to human, not sent."
                ),
            )
        else:
            via = (channel.value if channel else "email")
            outcome = SendOutcome(
                sent=True,
                detail=(
                    f"would send: to={invoice.debtor_contact} via={via} :: {message}"
                ),
            )

        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent="sender",
                decision="would_send" if outcome.sent else "withheld",
                reasoning=outcome.detail,
                channel=(channel.value if channel else None),
            )
        return outcome
