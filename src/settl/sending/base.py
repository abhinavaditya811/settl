"""The sending seam shared by every sender — mock and real alike.

One guarantee lives here so no sender can forget it: **a sender never acts on a
message the compliance gate did not clear.** ``GatedSender.send`` performs the
refusal + logging centrally and delegates only the actual delivery to subclasses'
``_deliver``. The mock sender's "would send …" and the real Gmail sender both
inherit the refusal for free — the gate stays the single authority, and a
mis-wired pipeline still cannot push an escalated message out.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from settl.audit.execution_log import ExecutionLog
from settl.compliance.gate import ComplianceResult
from settl.schema.invoice import Channel, Invoice


@dataclass(frozen=True)
class SendOutcome:
    sent: bool  # delivered/simulated (True) vs. withheld (False)
    detail: str


@runtime_checkable
class Sender(Protocol):
    def send(
        self,
        invoice: Invoice,
        message: str,
        compliance: ComplianceResult,
        channel: Channel | None = None,
    ) -> SendOutcome:
        ...


class GatedSender:
    """Base sender: enforces the compliance refusal + logging once for everyone.

    Subclasses implement ``_deliver`` (the only place that touches a real channel)
    and ``agent_name`` (how the hop is labelled in the audit log)."""

    agent_name = "sender"

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
            outcome = SendOutcome(sent=True, detail=self._deliver(invoice, message, channel))

        if self._log is not None:
            self._log.record(
                invoice_id=invoice.invoice_id,
                agent=self.agent_name,
                decision="sent" if outcome.sent else "withheld",
                reasoning=outcome.detail,
                channel=(channel.value if channel else None),
            )
        return outcome

    def _deliver(self, invoice: Invoice, message: str, channel: Channel | None) -> str:
        """Perform (or simulate) delivery; return the audit-log detail. Only reached
        when compliance has PASSED."""
        raise NotImplementedError
