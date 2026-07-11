"""Place ONE real, consented self-test call: ``python -m settl.voice.live_call``.

The Phase 3 counterpart of ``demo.py``: the exact same pipeline (build script →
compliance gate with the voice rules → sender), but the sender is the live
``RetellVoiceSender``, so a phone actually rings. It is a dev self-test tool, not
production dialing:

  * ``--to`` is REQUIRED and is who rings (you / your cofounder) - the synthetic
    invoice's fake debtor number is never used for a live call.
  * ``--consented`` is REQUIRED: you assert the person at --to agreed to receive
    this AI test call. No flag, no dial - the gate escalates on VOICE_NO_CONSENT.
  * Costs real Retell credit (~$0.11-0.15/min) and needs RETELL_API_KEY,
    RETELL_FROM_NUMBER, RETELL_AGENT_ID in the gitignored .env.

Everything the gate enforces offline is enforced here too - same rules, same code.
"""

from __future__ import annotations

import argparse
from datetime import datetime

from settl.compliance import ComplianceGate
from settl.schema.invoice import Channel
from settl.tenancy.config import Audio
from settl.voice import build_call_script, voice_context_for
from settl.voice.demo import _sample_invoice
from settl.voice.retell_sender import RetellVoiceSender


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Settl live voice self-test (Retell)")
    parser.add_argument("--to", required=True,
                        help="E.164 number to ring, e.g. +14155551234 - who consented")
    parser.add_argument("--consented", action="store_true",
                        help="assert the person at --to agreed to this AI test call")
    # Demo-only: whose name the agent speaks for. In production this is ALWAYS the
    # tenant's own business name (first-party outreach - never "Settl", never a
    # third-party-collector framing; that's the B2B/FDCPA scope line).
    parser.add_argument("--business", default="Settl",
                        help='business name the agent calls on behalf of (default: "Settl")')
    args = parser.parse_args(argv)

    invoice = _sample_invoice()
    audio = Audio()  # default professional voice (chosen on the Retell agent)
    if args.consented:
        # A consented SELF-test: the person at --to agreed to be rung right now, so
        # their consent covers the timing too - the call-hours window is a debtor
        # protection, and production dialing enforces it with the debtor-local time.
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
    script = build_call_script(business_name=args.business, reminder=reminder)

    # Same gate, same voice rules as offline. --consented is the per-debtor call
    # consent for this self-test; without it the gate escalates and nothing dials.
    ctx = voice_context_for(audio, call_consent=args.consented, now_local=now_local)
    result = ComplianceGate().evaluate(invoice, script.full, channel=Channel.VOICE, voice=ctx)

    print("\n=== Settl voice agent — LIVE self-test call ===")
    print(f"to       : {args.to}")
    print(f"spoken   : {script.spoken}")
    print(f"gate     : {result.decision.value.upper()}  {result.reasoning}")
    if not result.passed:
        print("\nGate escalated — NOT dialing. (Pass --consented, and call in-hours.)")
        return 1

    sender = RetellVoiceSender(force_recipient=args.to)
    if not sender.configured:
        print("\nMissing Retell config. Put in the gitignored .env:")
        print("  RETELL_API_KEY=key_...\n  RETELL_FROM_NUMBER=+1...\n  RETELL_AGENT_ID=agent_...")
        return 1

    outcome = sender.send(invoice, script.full, result, Channel.VOICE)
    print(f"\nsender   : {'DIALED' if outcome.sent else 'WITHHELD'}\n  {outcome.detail}")
    return 0 if outcome.sent else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
