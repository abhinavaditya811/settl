"""InboundMailBoard (api/inbound_mail_board.py) - correlation, lane routing,
PaymentPlan negotiation, and the poll loop. `db.*` calls are monkeypatched
directly on the module object (not via env vars - this dev environment has
real Supabase credentials that load_dotenv() would silently restore if we
just deleted the env var, see test_oauth_google.py's note) so nothing here
ever touches a real database. fetch/send are injected fakes - the one piece
NOT covered here is the real MCP subprocess round trip (gmail/mcp_client.py),
deliberately deferred to manual verification per that module's docstring."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from settl.agents.payment_plan.models import Installment, PaymentPlan, PaymentPlanStatus
from settl.api import inbound_mail_board as imb
from settl.gmail.messages import GmailMessage
from settl.orchestrator import Orchestrator, TerminalState
from settl.schema.invoice import (
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)


@pytest.fixture(autouse=True)
def _no_real_supabase(monkeypatch):
    monkeypatch.setattr(imb.db, "supabase_enabled", lambda: False)


def _repeat_payer(invoice_id="INV-005", tenant_id="t_demo") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=invoice_id, tenant_id=tenant_id, source=Source.STRIPE, source_ref="x",
        amount_due=Decimal("900.00"), currency="USD",
        issue_date=today - timedelta(days=50), due_date=today - timedelta(days=20),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="ap@acme.test",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
        payment_link="https://buy.stripe.com/test_x",
        prior_contacts=[
            PriorContact(
                occurred_on=today - timedelta(days=10), direction=ContactDirection.OUTBOUND,
                channel=Channel.EMAIL, summary="reminder",
                provider_message_id="<orig-001@settl>",
            )
        ],
    )


def _new_debtor(invoice_id="INV-777", tenant_id="t_demo") -> Invoice:
    today = date.today()
    return Invoice(
        invoice_id=invoice_id, tenant_id=tenant_id, source=Source.STRIPE, source_ref="x",
        amount_due=Decimal("500.00"), currency="USD",
        issue_date=today - timedelta(days=50), due_date=today - timedelta(days=20),
        status=InvoiceStatus.OPEN, debtor_name="NewCo", debtor_email="ap@newco.test",
        is_b2b=True, late_fee_allowed=True, as_of_date=today,
        payment_link="https://buy.stripe.com/test_y",
        prior_contacts=[],  # first contact - no prior outbound touches
    )


def _msg(**overrides) -> GmailMessage:
    defaults = dict(
        message_id="<reply-001@gmail>", thread_id="t1", in_reply_to="<orig-001@settl>",
        references="<orig-001@settl>", subject="Re: [Settl] Invoice reminder - INV-005",
        from_address="Acme AP <ap@acme.test>", body_text="Thanks, will pay this week",
        occurred_at=datetime.now(timezone.utc),
    )
    defaults.update(overrides)
    return GmailMessage(**defaults)


def _board() -> imb.InboundMailBoard:
    return imb.InboundMailBoard(orchestrator=Orchestrator())


# --- invoice_id_from_subject -----------------------------------------------------


def test_invoice_id_from_subject_matches_the_email_senders_format():
    assert imb.invoice_id_from_subject("Re: [Settl] Invoice reminder - INV-018") == "INV-018"


def test_invoice_id_from_subject_none_when_no_trailing_id():
    assert imb.invoice_id_from_subject("just a random subject") is None


# --- correlate ---------------------------------------------------------------


def test_correlate_via_message_id_threading(monkeypatch):
    monkeypatch.setattr(imb.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(imb.db, "find_by_message_id", lambda mid: ("t_demo", "INV-005"))
    inv = _repeat_payer()
    board = _board()
    assert board.correlate(_msg(), {inv.invoice_id: inv}) == "INV-005"


def test_correlate_falls_back_to_subject_id_when_no_thread_match():
    inv = _repeat_payer()
    board = _board()
    msg = _msg(in_reply_to=None)
    assert board.correlate(msg, {inv.invoice_id: inv}) == "INV-005"


def test_correlate_returns_none_when_nothing_matches():
    board = _board()
    msg = _msg(in_reply_to=None, subject="no id here")
    assert board.correlate(msg, {}) is None


def test_correlate_never_guesses_an_invoice_not_on_the_board():
    board = _board()
    msg = _msg(subject="Re: [Settl] Invoice reminder - INV-999")
    assert board.correlate(msg, {"INV-005": _repeat_payer()}) is None


# --- already_processed ---------------------------------------------------------


def test_already_processed_false_when_supabase_off():
    assert _board().already_processed(_msg()) is False


def test_already_processed_true_when_message_id_already_recorded(monkeypatch):
    monkeypatch.setattr(imb.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(imb.db, "find_by_message_id", lambda mid: ("t_demo", "INV-005"))
    assert _board().already_processed(_msg()) is True


# --- handle_message: normal lane vs. plan negotiation ---------------------------


def test_handle_message_routes_to_orchestrator_when_no_plan_in_flight():
    inv = _repeat_payer()
    board = _board()
    result, _ = board.handle_message(inv, _msg(), plan=None)
    # A benign reply from a repeat payer (is_new_debtor False) auto-sends,
    # same as test_orchestrator.py's handle_inbound coverage.
    assert result.terminal_state is TerminalState.SENT


def test_handle_message_routes_to_negotiation_when_plan_is_proposed():
    inv = _repeat_payer()
    plan = PaymentPlan(
        id="pp-1", tenant_id="t_demo", invoice_id="INV-005",
        status=PaymentPlanStatus.PROPOSED,
        installments=(Installment(index=0, amount=Decimal("300"), due_date=date.today()),),
    )
    board = _board()
    result, _ = board.handle_message(inv, _msg(body_text="that works for me"), plan=plan)
    # Never auto-sends - the vendor's existing approve/reject flow still owns
    # anything reaching the debtor.
    assert result.terminal_state is TerminalState.HELD
    assert result.message is None


def test_handle_message_ignores_a_completed_plan():
    inv = _repeat_payer()
    plan = PaymentPlan(id="pp-1", tenant_id="t_demo", invoice_id="INV-005", status=PaymentPlanStatus.COMPLETED)
    board = _board()
    result, _ = board.handle_message(inv, _msg(), plan=plan)
    # A completed plan is no longer "in flight" - back to the generic lanes.
    assert result.terminal_state is TerminalState.SENT


def test_handle_message_returns_invoice_with_the_new_inbound_contact_appended(monkeypatch):
    # Regression: poll() must see the appended contact on the NEXT message, or
    # rule_contact_frequency evaluates every reply against a stale snapshot
    # forever and can never trip - the actual cause of an observed mail loop.
    monkeypatch.setattr(imb.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(imb.db, "write_contact", lambda *a, **k: None)
    inv = _repeat_payer()
    starting = len(inv.prior_contacts)
    board = _board()
    _, updated = board.handle_message(inv, _msg(), plan=None)
    assert len(updated.prior_contacts) == starting + 1
    assert updated.prior_contacts[-1].direction is ContactDirection.INBOUND


# --- poll ----------------------------------------------------------------------


def _raw(msg: GmailMessage) -> dict:
    return {
        "message_id": msg.message_id, "thread_id": msg.thread_id,
        "in_reply_to": msg.in_reply_to, "references": msg.references,
        "subject": msg.subject, "from_address": msg.from_address,
        "body_text": msg.body_text, "occurred_at": msg.occurred_at.isoformat(),
    }


def test_poll_correlates_and_processes_new_messages():
    inv = _repeat_payer()
    sent = {}

    def fake_send(tenant_id, **kwargs):
        sent.update(kwargs)
        return "<sent-001@gmail>"

    board = _board()
    changed = board.poll(
        "t_demo", {inv.invoice_id: inv}, {},
        fetch=lambda tenant_id: [_raw(_msg())],
        send=fake_send,
    )
    assert changed == [("INV-005", changed[0][1])]
    assert changed[0][1].terminal_state is TerminalState.SENT
    assert sent["thread_id"] == "t1"
    assert sent["to"] == "ap@acme.test"  # parsed out of "Acme AP <ap@acme.test>"


def test_poll_skips_uncorrelated_messages_without_raising():
    board = _board()
    changed = board.poll(
        "t_demo", {}, {}, fetch=lambda tenant_id: [_raw(_msg())], send=lambda *a, **k: None
    )
    assert changed == []


def test_poll_is_fail_safe_when_fetch_raises():
    board = _board()

    def boom(tenant_id):
        raise RuntimeError("no credentials")

    assert board.poll("t_demo", {}, {}, fetch=boom, send=lambda *a, **k: None) == []


def test_poll_does_not_replace_a_pending_approval_with_a_new_one():
    # Regression: a new-debtor invoice sitting AWAITING_APPROVAL (never actioned,
    # so is_new_debtor is still True) got a SECOND benign reply before the human
    # approved the first - the poller drafted and held a totally different
    # message, silently overwriting the pending one in the board's results dict.
    inv = _new_debtor()
    invoices = {inv.invoice_id: inv}
    board = _board()
    subject = f"Re: [Settl] Invoice reminder - {inv.invoice_id}"

    first = board.poll(
        "t_demo", invoices, {},
        fetch=lambda tenant_id: [_raw(_msg(message_id="<reply-1@gmail>", subject=subject))],
        send=lambda *a, **k: "<sent@gmail>",
    )
    assert first[0][1].terminal_state is TerminalState.AWAITING_APPROVAL
    first_message = first[0][1].message
    results = {inv.invoice_id: first[0][1]}

    second = board.poll(
        "t_demo", invoices, {}, results,
        fetch=lambda tenant_id: [
            _raw(_msg(message_id="<reply-2@gmail>", body_text="just checking in", subject=subject))
        ],
        send=lambda *a, **k: "<sent@gmail>",
    )

    assert second == []  # suppressed - not reported as a board change
    assert results[inv.invoice_id].message == first_message  # pending draft untouched


def test_poll_stops_auto_replying_once_contact_frequency_limit_trips():
    # Regression: an observed real mail loop - poll() used to hand rule_contact_
    # frequency the SAME stale invoice snapshot every cycle (fixed to reuse the
    # `invoices` dict exactly as BoardState.poll_inbound_mail does across real
    # poll cycles), so it never saw its own prior auto-replies and never tripped.
    # FREQUENCY_MAX_TOUCHES defaults to 3 within a 7-day window.
    inv = _repeat_payer()  # 1 prior contact, but 10 days old - outside the window
    invoices = {inv.invoice_id: inv}
    board = _board()
    terminal_states = []
    for i in range(5):
        changed = board.poll(
            "t_demo", invoices, {},
            fetch=lambda tenant_id, i=i: [_raw(_msg(message_id=f"<reply-{i}@gmail>"))],
            send=lambda *a, **k: "<sent@gmail>",
        )
        terminal_states.append(changed[0][1].terminal_state)

    assert terminal_states.count(TerminalState.SENT) == 3
    assert terminal_states[3] is TerminalState.ESCALATED
    assert terminal_states[4] is TerminalState.ESCALATED


def test_poll_does_not_send_for_a_held_negotiation_result():
    inv = _repeat_payer()
    plan = PaymentPlan(
        id="pp-1", tenant_id="t_demo", invoice_id="INV-005", status=PaymentPlanStatus.PROPOSED,
        installments=(Installment(index=0, amount=Decimal("300"), due_date=date.today()),),
    )
    send_calls = []
    board = _board()
    changed = board.poll(
        "t_demo", {inv.invoice_id: inv}, {"INV-005": plan},
        fetch=lambda tenant_id: [_raw(_msg())],
        send=lambda *a, **k: send_calls.append((a, k)) or "<x@gmail>",
    )
    assert changed[0][1].terminal_state is TerminalState.HELD
    assert send_calls == []
