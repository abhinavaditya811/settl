"""Durable contact log (Invoice.prior_contacts, SCHEMA.md §2/§7).

Nothing wrote to `contacts` before this - `invoices.py` only ever read it to
hydrate `prior_contacts`. This is the write side: every outbound send and every
inbound reply becomes a row here, which is what lets the inbound classifier
(agents/inbound/classifier.py) read real thread history instead of only the
synthetic fixture.

Plain insert, no dedup key - unlike payment_events (deduped on a processor
reference), a `contact` row records an event that happened, not a fact to be
reconciled; a retried write is a caller bug, not something this layer should
paper over. Real inbound-mail idempotency (a webhook/poll redelivering the same
Message-ID) is Phase 6's concern, once there's a real mailbox to redeliver from.
"""

from __future__ import annotations

from settl.data.supabase.connection import connect
from settl.schema.invoice import PriorContact

_INSERT_SQL = """
    insert into contacts (
        tenant_id, invoice_id, direction, channel, occurred_at, summary,
        provider_message_id, in_reply_to, thread_ref, classification, audit_ref
    )
    values (
        %(tenant_id)s, %(invoice_id)s, %(direction)s, %(channel)s, %(occurred_at)s,
        %(summary)s, %(provider_message_id)s, %(in_reply_to)s, %(thread_ref)s,
        %(classification)s, %(audit_ref)s
    )
"""

_FIND_BY_MESSAGE_ID_SQL = """
    select tenant_id, invoice_id
    from contacts
    where provider_message_id = %(message_id)s
    limit 1
"""


def write_contact(tenant_id: str, invoice_id: str, contact: PriorContact) -> None:
    """Persist one touch (ours or the debtor's). Caller checks
    ``connection.supabase_enabled()`` first, same as every other store here."""
    params = {
        "tenant_id": tenant_id,
        "invoice_id": invoice_id,
        "direction": contact.direction.value,
        "channel": contact.channel.value,
        "occurred_at": contact.occurred_on,
        "summary": contact.summary,
        "provider_message_id": contact.provider_message_id,
        "in_reply_to": contact.in_reply_to,
        "thread_ref": contact.thread_ref,
        "classification": contact.classification,
        "audit_ref": contact.audit_ref,
    }
    with connect() as conn:
        conn.execute(_INSERT_SQL, params)


def find_by_message_id(message_id: str) -> tuple[str, str] | None:
    """(tenant_id, invoice_id) of the contact row carrying this Message-ID, or
    None. Serves two callers: correlating a reply's In-Reply-To back to the
    invoice it's threaded to, and - reusing the same lookup - the inbound-mail
    poll's idempotency check (a message already recorded here was already
    processed, so a redelivered poll result is a no-op, not a duplicate)."""
    with connect() as conn:
        row = conn.execute(_FIND_BY_MESSAGE_ID_SQL, {"message_id": message_id}).fetchone()
    return (row["tenant_id"], row["invoice_id"]) if row else None
