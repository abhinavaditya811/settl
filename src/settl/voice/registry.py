"""Per-tenant voice-safety records: call consent, do-not-call, and the dial ledger.

The stateful side of voice compliance (VOICE_AGENT_SPEC §3a.2, §3a.8, §3b.17), kept
in one place and injected where needed - the gate itself stays pure and reads only a
``VoiceContext``. In-memory for the offline/synthetic phase, exactly like the audit
log; a durable store swaps in behind the same methods when a pilot signs. Every key
is tenant-scoped (tenant_id first), per the isolation rules in SCHEMA.md §6.

  * ``ConsentStore``      - per-debtor ``ConsentRecord``s (call/recording), revocable
  * ``DoNotCallRegistry`` - "stop calling" is immediate and permanent
  * ``DialLedger``        - one dial per invoice per day, so a re-run never re-rings
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime, time, timezone

from settl.compliance.rules import VoiceContext
from settl.schema.invoice import Invoice
from settl.tenancy.config import Audio, ConsentRecord

__all__ = ["ConsentStore", "DoNotCallRegistry", "DialLedger", "voice_context_from_records"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ConsentStore:
    """Per-debtor consent records, keyed (tenant_id, phone, kind). The newest record
    wins; revoking marks it revoked (history is kept - consent is an audit artifact,
    never silently deleted)."""

    def __init__(self) -> None:
        self._records: dict[tuple[str, str, str], list[ConsentRecord]] = {}

    def grant(
        self,
        tenant_id: str,
        phone: str,
        *,
        kind: str = "call",
        granted_by: str,
        method: str = "checkbox",
        evidence_ref: str | None = None,
    ) -> ConsentRecord:
        record = ConsentRecord(
            kind=kind, granted_by=granted_by, granted_at=_now_iso(),
            method=method, evidence_ref=evidence_ref,
        )
        self._records.setdefault((tenant_id, phone, kind), []).append(record)
        return record

    def revoke(self, tenant_id: str, phone: str, *, kind: str = "call") -> None:
        """Revoke the active record, if any. Idempotent - revoking twice is fine."""
        history = self._records.get((tenant_id, phone, kind), [])
        for i, rec in enumerate(history):
            if rec.active:
                history[i] = replace(rec, revoked_at=_now_iso())

    def active(self, tenant_id: str, phone: str, *, kind: str = "call") -> ConsentRecord | None:
        for rec in reversed(self._records.get((tenant_id, phone, kind), [])):
            if rec.active:
                return rec
        return None

    def has_active(self, tenant_id: str, phone: str, *, kind: str = "call") -> bool:
        return self.active(tenant_id, phone, kind=kind) is not None


class DoNotCallRegistry:
    """Numbers we must never dial again. Registration is permanent by design - there
    is deliberately no ``remove``; a debtor who opts back in grants a fresh consent,
    which is a human decision, not an agent one."""

    def __init__(self) -> None:
        self._registered: dict[tuple[str, str], str] = {}  # (tenant, phone) → when

    def register(self, tenant_id: str, phone: str) -> None:
        self._registered.setdefault((tenant_id, phone), _now_iso())

    def contains(self, tenant_id: str, phone: str) -> bool:
        return (tenant_id, phone) in self._registered

    def registered_at(self, tenant_id: str, phone: str) -> str | None:
        return self._registered.get((tenant_id, phone))


class DialLedger:
    """Idempotency for dialing: at most one call per invoice per day (§3b.17). The
    live sender consults it before dialing and marks it after Retell accepts."""

    def __init__(self) -> None:
        self._dialed: set[tuple[str, str, str]] = set()

    @staticmethod
    def _key(invoice: Invoice) -> tuple[str, str, str]:
        return (invoice.tenant_id, invoice.invoice_id, invoice.as_of_date.isoformat())

    def already_dialed(self, invoice: Invoice) -> bool:
        return self._key(invoice) in self._dialed

    def mark(self, invoice: Invoice) -> None:
        self._dialed.add(self._key(invoice))


def voice_context_from_records(
    audio: Audio,
    invoice: Invoice,
    *,
    consents: ConsentStore,
    do_not_call: DoNotCallRegistry,
    now_local: time | None = None,
) -> VoiceContext:
    """Build the gate's ``VoiceContext`` from the real records for THIS debtor.

    The record-backed sibling of ``consent.voice_context_for`` (which takes consent as
    a bare bool for tests/callers that manage their own state): consent and opt-out
    are looked up by the debtor's phone under the invoice's tenant, so the gate sees
    exactly what is on file - nothing asserted, nothing assumed."""
    phone = invoice.debtor_phone or ""
    return VoiceContext(
        call_consent=consents.has_active(invoice.tenant_id, phone, kind="call"),
        now_local=now_local,
        window_start=audio.call_window.start_local,
        window_end=audio.call_window.end_local,
        opted_out=do_not_call.contains(invoice.tenant_id, phone),
    )
