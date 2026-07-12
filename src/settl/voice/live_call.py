"""Place ONE real, consented self-test call: ``python -m settl.voice.live_call``.

The Phase 3 counterpart of ``demo.py``: the exact same pipeline (build script →
compliance gate with the voice rules → sender → SMS leg), but the sender is the live
``RetellVoiceSender``, so a phone actually rings. It is a dev self-test tool, not
production dialing:

  * ``--to`` is who rings (you / your cofounder) - the synthetic invoice's fake
    debtor number is never used for a live call.
  * ``--consented`` records a REAL call-consent record in the ``ConsentStore`` (the
    same store production uses): you assert the person at --to agreed to receive
    this AI test call, and their consent covers the timing. No flag → no record →
    the gate escalates on VOICE_NO_CONSENT and nothing dials.
  * ``--pull CALL_ID`` runs AFTER the call ends: fetches the transcript from Retell,
    labels the outcome, and (if the person said "stop calling") registers the
    do-not-call - the full audit loop, live.
  * Costs real Retell credit (~$0.11-0.15/min) and needs RETELL_API_KEY,
    RETELL_FROM_NUMBER, RETELL_AGENT_ID in the gitignored .env.

Everything the gate enforces offline is enforced here too - same rules, same code.
"""

from __future__ import annotations

import argparse
from datetime import datetime

from settl.compliance import ComplianceGate
from settl.schema.invoice import Channel
from settl.sending.mock_sender import MockSender
from settl.tenancy.config import Audio
from settl.voice import (
    build_call_script,
    pull_call_artifact,
    send_sms_followup,
)
from settl.voice.demo import BUSINESS, _sample_invoice
from settl.voice.registry import (
    ConsentStore,
    DialLedger,
    DoNotCallRegistry,
    voice_context_from_records,
)
from settl.voice.retell_sender import RetellVoiceSender


def _pull(call_id: str) -> int:
    """Post-call: fetch the ended call and print the artifact (the audit view)."""
    invoice = _sample_invoice()
    dnc = DoNotCallRegistry()
    artifact = pull_call_artifact(
        call_id, invoice_id=invoice.invoice_id, tenant_id=invoice.tenant_id,
        do_not_call=dnc,
    )
    print("\n=== Call artifact ===")
    print(f"call     : {artifact.call_id}  ({artifact.duration_secs}s)")
    print(f"outcome  : {artifact.outcome.upper()}")
    if artifact.recording_ref:
        print(f"recording: {artifact.recording_ref}")
    if dnc.contains(invoice.tenant_id, artifact.called_number):
        print("do-not-call: REGISTERED (they asked us to stop - never dialed again)")
    print(f"\ntranscript:\n{artifact.transcript or '(empty)'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Settl live voice self-test (Retell)")
    parser.add_argument("--to", help="E.164 number to ring, e.g. +14155551234 - who consented")
    parser.add_argument("--consented", action="store_true",
                        help="assert the person at --to agreed to this AI test call")
    parser.add_argument("--pull", metavar="CALL_ID",
                        help="fetch a finished call's transcript/outcome instead of dialing")
    args = parser.parse_args(argv)

    if args.pull:
        return _pull(args.pull)
    if not args.to:
        parser.error("--to is required to dial (or use --pull CALL_ID)")

    invoice = _sample_invoice()
    audio = Audio()  # default professional voice (chosen on the Retell agent)

    # The REAL safety records, not bools: consent goes into the store, the gate reads
    # it back out, and the ledger refuses a second dial of the same invoice today.
    consents, dnc, ledger = ConsentStore(), DoNotCallRegistry(), DialLedger()
    if args.consented:
        consents.grant(
            invoice.tenant_id, invoice.debtor_phone or "", kind="call",
            granted_by="self-test", method="oral_on_call",
            evidence_ref=f"cli --consented for {args.to}",
        )
        # A consented SELF-test covers the timing too; production dialing enforces
        # the 08:00-21:00 window with the debtor-local clock.
        now_local = None
        print("note     : call-window check waived for this consented self-test "
              "(production dialing enforces 08:00-21:00 debtor-local).")
    else:
        now_local = datetime.now().time()

    reminder = (
        f"This is a friendly reminder that invoice {invoice.invoice_id} for "
        "twelve hundred dollars is fifteen days past due. "
        "Please settle it at your earliest convenience. {{payment_link}}"
    )
    script = build_call_script(business_name=BUSINESS, reminder=reminder)

    ctx = voice_context_from_records(
        audio, invoice, consents=consents, do_not_call=dnc, now_local=now_local
    )
    result = ComplianceGate().evaluate(invoice, script.full, channel=Channel.VOICE, voice=ctx)

    print("\n=== Settl voice agent — LIVE self-test call ===")
    print(f"to       : {args.to}")
    print(f"spoken   : {script.spoken}")
    print(f"gate     : {result.decision.value.upper()}  {result.reasoning}")
    if not result.passed:
        print("\nGate escalated — NOT dialing. (Pass --consented, and call in-hours.)")
        return 1

    sender = RetellVoiceSender(
        force_recipient=args.to, ledger=ledger, business_name=BUSINESS,
        business_facts="Invoices are payable by card via the secure link we text.",
    )
    if not sender.configured:
        print("\nMissing Retell config. Put in the gitignored .env:")
        print("  RETELL_API_KEY=key_...\n  RETELL_FROM_NUMBER=+1...\n  RETELL_AGENT_ID=agent_...")
        return 1

    outcome = sender.send(invoice, script.full, result, Channel.VOICE)
    print(f"\nsender   : {'DIALED' if outcome.sent else 'WITHHELD'}\n  {outcome.detail}")
    if not outcome.sent:
        return 1

    # The companion SMS leg (mock-first: logs "would send" until an SMS provider is
    # wired behind the same seam). This is where the payment link actually travels.
    sms = send_sms_followup(invoice, script, result, sender=MockSender())
    if sms is not None:
        print(f"sms leg  : {sms.detail}")

    print("\nafter you hang up (give it ~1 min), pull the audit artifact with:")
    print("  python -m settl.voice.live_call --pull <call_id from the line above>")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
