"""Hear the voice agent end-to-end: ``python -m settl.voice.demo`` (Phase 2).

Runs the REAL pipeline on a sample B2B invoice - build script → compliance gate (with
the voice rules) → render audio → play it - so you can actually listen to the
gate-cleared reminder. On macOS it speaks via ``say`` and plays with ``afplay``; off
macOS (or without them) it falls back to the mock provider and just prints the script.

This is a dev/demo entrypoint, not production: the call consent here is supplied inline
to simulate a properly-consented, in-hours call. In production that ``VoiceContext``
comes from a real per-debtor consent record (Phase 3).
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from datetime import date, time, timedelta
from decimal import Decimal
from pathlib import Path

from settl.compliance import ComplianceGate
from settl.schema.invoice import (
    PAYMENT_LINK_PLACEHOLDER,
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)
from settl.voice import (
    MockVoiceProvider,
    MockVoiceSender,
    VoiceProviderError,
    build_call_script,
    render_script,
    voice_context_for,
)
from settl.tenancy.config import Audio

BUSINESS = "Brightline Studio"


def _sample_invoice() -> Invoice:
    today = date.today()
    prior = [
        PriorContact(
            occurred_on=today - timedelta(days=6),
            direction=ContactDirection.OUTBOUND,
            channel=Channel.EMAIL,
            summary="emailed reminder, no reply",
        )
    ]
    return Invoice(
        invoice_id="INV-DEMO", tenant_id="t_demo", source=Source.CSV, source_ref="d1",
        amount_due=Decimal("1200.00"), currency="USD",
        issue_date=today - timedelta(days=45), due_date=today - timedelta(days=15),
        status=InvoiceStatus.OPEN, debtor_name="Acme Supply Co",
        debtor_email="ap@acme.test", debtor_phone="+15551234567",
        is_b2b=True, late_fee_allowed=True, prior_contacts=prior,
        payment_link="https://buy.stripe.com/test_demo_link", as_of_date=today,
    )


def _pick_provider():
    """Best voice available → (provider, is_audio, file suffix). ElevenLabs when a
    key is in .env (premium TTS), else macOS ``say`` (free, local), else the mock."""
    import os

    from settl.config import load_dotenv

    load_dotenv()
    if os.environ.get("ELEVENLABS_API_KEY"):
        from settl.voice.elevenlabs_provider import ElevenLabsProvider

        return ElevenLabsProvider(), True, ".mp3"
    if sys.platform == "darwin" and shutil.which("say"):
        from settl.voice.system_provider import SystemVoiceProvider

        return SystemVoiceProvider(), True, ".aiff"
    return MockVoiceProvider(), False, ".txt"


def main() -> int:
    invoice = _sample_invoice()
    audio = Audio()  # default professional voice
    reminder = (
        f"This is a friendly reminder that invoice {invoice.invoice_id} for "
        f"twelve hundred dollars is fifteen days past due. "
        f"Please settle it at your earliest convenience. {PAYMENT_LINK_PLACEHOLDER}"
    )
    script = build_call_script(business_name=BUSINESS, reminder=reminder)

    # The compliance gate is the authority - render/dial only if it clears the script.
    ctx = voice_context_for(audio, call_consent=True, now_local=time(10, 30))
    result = ComplianceGate().evaluate(
        invoice, script.full, channel=Channel.VOICE, voice=ctx
    )

    print("\n=== Settl voice agent — demo ===")
    print(f"business : {BUSINESS}")
    print(f"debtor   : {invoice.debtor_name}  ({invoice.debtor_phone})")
    print(f"voice_id : {audio.active_voice_id}")
    print(f"\nspoken script:\n  {script.spoken}")
    print(f"\ncompanion SMS:\n  {script.sms_followup}")
    print(f"\ngate     : {result.decision.value.upper()}  {result.reasoning}")

    if not result.passed:
        print("\nGate escalated — nothing rendered or dialed. (This is the safe path.)")
        return 1

    # The mock sender shows exactly what a real call+text would do (link resolved).
    outcome = MockVoiceSender().send(invoice, script.full, result, Channel.VOICE)
    print(f"\nsender   : {'SENT' if outcome.sent else 'WITHHELD'}\n  {outcome.detail}")

    provider, is_audio, suffix = _pick_provider()
    print(f"\nprovider : {provider.name}")
    out = Path(tempfile.gettempdir()) / f"settl_voice_demo{suffix}"
    try:
        clip = render_script(script, provider=provider, voice_id=audio.active_voice_id,
                             out_path=out if is_audio else None)
    except VoiceProviderError as exc:
        # A live backend failing (bad key, offline) must not kill the demo - fall
        # back to the local voice, mirroring the spec's cloned→default fallback.
        print(f"  {provider.name} failed ({exc}); falling back to the local voice.")
        if sys.platform == "darwin" and shutil.which("say"):
            from settl.voice.system_provider import SystemVoiceProvider

            provider, is_audio, out = SystemVoiceProvider(), True, out.with_suffix(".aiff")
        else:
            provider, is_audio = MockVoiceProvider(), False
        clip = render_script(script, provider=provider, voice_id="default",
                             out_path=out if is_audio else None)
    if not is_audio:
        print("  (no macOS `say` here — printed the script instead of speaking it)")
        return 0

    print(f"  rendered {len(clip.audio):,} bytes → {out}")
    if shutil.which("afplay"):
        print("  playing…")
        subprocess.run(["afplay", str(out)], check=False)
    else:
        print(f"  play it with:  afplay {out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
