"""API contract tests over the engine, using FastAPI's TestClient (no network).

Proves the board, detail, trace, and the approval action behave - and that the
approval path mirrors the engine guarantees (first-contact clears to sent; a
non-approvable invoice is refused with 409)."""

from fastapi.testclient import TestClient

from settl.api.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "live_send" in body
    assert body["drafting"] in ("gemini", "template")  # which drafter is active


def test_detail_surfaces_payment_link():
    r = client.get("/invoices/INV-018")  # stripe source → carries a pay link, gets sent
    assert r.status_code == 200
    body = r.json()
    assert "stripe.com" in (body["payment_link"] or "")
    # The editable draft keeps the placeholder; the read-only preview resolves it.
    assert "{{payment_link}}" in body["message"]
    assert "{{payment_link}}" not in body["message_preview"]
    assert body["payment_link"] in body["message_preview"]


def test_check_payments_is_noop_without_stripe():
    # No Stripe armed → nothing to reconcile, deterministic.
    assert client.post("/check-payments").json() == {"recovered": []}


def test_check_payments_auto_reconciles_a_paid_link():
    from decimal import Decimal

    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()  # fresh, offline (no Stripe / live send)
    sent = [i for i, r in board._results.items() if r.terminal_state is TerminalState.SENT]
    assert sent
    target = sent[0]

    class _FakeMinter:  # stands in for a Stripe-armed minter reporting one paid link
        def link_id(self, iid):
            return f"plink_{iid}" if iid == target else None

        def paid_sessions(self, link_id, currency="usd"):
            return [("pi_test", Decimal("1000000"))]  # >= any invoice amount → PAID

    board._minter = _FakeMinter()
    assert board.check_payments() == [target]
    assert board._results[target].terminal_state is TerminalState.RECOVERED
    assert board.check_payments() == []  # idempotent: already recovered


def _sent_target(board):
    from settl.orchestrator import TerminalState
    for iid, r in board._results.items():
        if r.terminal_state is TerminalState.SENT and board._invoices[iid].currency == "USD":
            return iid
    raise AssertionError("no USD SENT invoice in the synthetic set")


def _stub_verify(monkeypatch, event):
    """Skip signature crypto: feed a raw event straight into the real parse_event path."""
    from settl.api import state as state_mod
    monkeypatch.setattr(state_mod, "verify_event", lambda payload, sig, secret: event)


def test_webhook_recovers_an_invoice_with_no_tab_open(monkeypatch):
    from decimal import Decimal

    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()
    target = _sent_target(board)
    minor = int(Decimal(board._invoices[target].amount_due) * 100)
    _stub_verify(monkeypatch, {"type": "checkout.session.completed", "data": {"object": {
        "payment_status": "paid", "amount_total": minor, "currency": "usd",
        "payment_intent": "pi_wh", "metadata": {"settl_invoice_id": target},
    }}})

    changed = board.ingest_webhook(b"{}", "sig")
    assert changed == [target]
    assert board._results[target].terminal_state is TerminalState.RECOVERED
    # Idempotent: replaying the same event changes nothing (deduped by reference).
    assert board.ingest_webhook(b"{}", "sig") == []


def test_webhook_dispute_escalates(monkeypatch):
    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()
    target = _sent_target(board)
    _stub_verify(monkeypatch, {"type": "charge.dispute.created", "data": {"object": {
        "amount": 12000, "currency": "usd", "id": "dp_1",
        "metadata": {"settl_invoice_id": target},
    }}})

    changed = board.ingest_webhook(b"{}", "sig")
    assert changed == [target]
    assert board._results[target].terminal_state is TerminalState.ESCALATED


def test_webhook_unresolved_event_is_a_safe_noop(monkeypatch):
    from settl.api.state import BoardState

    board = BoardState()
    _stub_verify(monkeypatch, {"type": "checkout.session.completed", "data": {"object": {
        "payment_status": "paid", "amount_total": 100, "currency": "usd",
        "payment_intent": "pi_unknown",  # no metadata, no known link → uncorrelatable
    }}})
    assert board.ingest_webhook(b"{}", "sig") == []


def test_board_lists_all_invoices_with_summary():
    r = client.get("/invoices")
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["total"] == len(body["invoices"]) == 25
    # Summary counts add up to the total.
    assert sum(body["summary"]["counts"].values()) == 25
    # Every card carries a terminal state and the approve flag.
    for card in body["invoices"]:
        assert card["terminal_state"]
        assert "can_approve" in card


def test_invoice_detail_includes_draft_and_steps():
    r = client.get("/invoices/INV-018")  # repeat clean B2B → sent, has a draft
    assert r.status_code == 200
    body = r.json()
    assert body["terminal_state"] == "sent"
    assert body["message"]  # a draft was produced
    agents = [s["agent"] for s in body["steps"]]
    assert "compliance_gate" in agents and "sender" in agents


def test_unknown_invoice_is_404():
    assert client.get("/invoices/NOPE").status_code == 404
    assert client.get("/invoices/NOPE/trace").status_code == 404


def test_trace_returns_the_audit_timeline():
    r = client.get("/invoices/INV-001/trace")
    assert r.status_code == 200
    entries = r.json()
    assert entries and entries[0]["agent"] == "ingestion"
    assert any(e["agent"] == "strategy" for e in entries)


def test_approve_first_contact_sends_then_is_no_longer_approvable():
    # INV-001 is a first-time client → awaiting approval.
    detail = client.get("/invoices/INV-001").json()
    assert detail["can_approve"] is True

    r = client.post("/invoices/INV-001/approve")
    assert r.status_code == 200
    body = r.json()
    assert body["terminal_state"] == "sent" and body["sent"] is True

    # After approval the board reflects SENT and it can't be approved again.
    again = client.post("/invoices/INV-001/approve")
    assert again.status_code == 409


def test_approve_non_approvable_invoice_is_409():
    # INV-003 is consumer debt → escalated, never approvable.
    r = client.post("/invoices/INV-003/approve")
    assert r.status_code == 409


def test_metrics_shape():
    m = client.get("/metrics").json()
    assert isinstance(m["currency"], str) and m["currency"]
    for key in ("outstanding", "in_flight", "recovered", "awaiting_amount"):
        assert isinstance(m[key], (int, float))
    assert len(m["aging"]) == 3
    assert sum(b["count"] for b in m["aging"]) >= 0


def test_activity_feed_is_recent_first_and_complete():
    entries = client.get("/activity?limit=8").json()
    assert 0 < len(entries) <= 8
    needed = {"timestamp", "invoice_id", "agent", "decision", "reasoning"}
    assert all(needed <= set(e) for e in entries)


def _an_awaiting_id() -> str:
    board = client.get("/invoices").json()
    awaiting = [c["invoice_id"] for c in board["invoices"] if c["can_approve"]]
    assert awaiting, "expected at least one approvable invoice"
    return awaiting[0]


def test_editable_approve_sends_a_clean_edited_message():
    r = client.post(
        f"/invoices/{_an_awaiting_id()}/approve",
        json={"message": "Hi - a quick reminder, here is your payment link. Thanks!"},
    )
    assert r.status_code == 200 and r.json()["sent"] is True


def test_editable_approve_rejects_an_edited_message_that_breaks_a_rule():
    # The human edit is re-run through the gate - a threat cannot be approved.
    r = client.post(
        f"/invoices/{_an_awaiting_id()}/approve",
        json={"message": "Pay now or we will sue you and report you to collections."},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sent"] is False and body["terminal_state"] == "escalated"


# --- flag → guardrail → re-orchestrate --------------------------------------


def test_flag_strategy_force_skip_reorchestrates_to_skipped():
    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()
    target = _sent_target(board)
    out = board.flag_decision(
        target, scope="strategy", directive="force_skip", reason="never chase this debtor",
    )
    assert out["applied"] is True and out["rule_id"]
    assert board._results[target].terminal_state is TerminalState.SKIPPED
    assert len(board.guardrails()) == 1


def test_flag_always_escalate_reorchestrates_to_escalated():
    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()
    target = _sent_target(board)
    out = board.flag_decision(
        target, scope="compliance", directive="always_escalate", reason="review these",
    )
    assert out["applied"] is True
    assert board._results[target].terminal_state is TerminalState.ESCALATED


def test_flag_waiving_a_legal_code_is_refused():
    from settl.api.state import BoardState
    from settl.orchestrator import TerminalState

    board = BoardState()
    # INV-003 is consumer (non-B2B) → escalated on B2B_ONLY.
    assert board._results["INV-003"].terminal_state is TerminalState.ESCALATED
    out = board.flag_decision(
        "INV-003", scope="compliance", directive="waive", waive_code="B2B_ONLY",
        reason="operator thinks it's fine",
    )
    assert out["applied"] is False and "not waivable" in out["note"]
    # Still escalated - a legal/consumer rule can never be waived.
    assert board._results["INV-003"].terminal_state is TerminalState.ESCALATED
    assert board.guardrails() == []  # nothing stored for a refused waiver


def test_flag_unknown_invoice_is_404():
    r = client.post("/invoices/NOPE/flag", json={"scope": "compliance", "directive": "always_escalate"})
    assert r.status_code == 404


def test_guardrails_route_returns_a_list():
    r = client.get("/guardrails")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
