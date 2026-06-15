"""API contract tests over the engine, using FastAPI's TestClient (no network).

Proves the board, detail, trace, and the approval action behave — and that the
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
        json={"message": "Hi — a quick reminder, here is your payment link. Thanks!"},
    )
    assert r.status_code == 200 and r.json()["sent"] is True


def test_editable_approve_rejects_an_edited_message_that_breaks_a_rule():
    # The human edit is re-run through the gate — a threat cannot be approved.
    r = client.post(
        f"/invoices/{_an_awaiting_id()}/approve",
        json={"message": "Pay now or we will sue you and report you to collections."},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["sent"] is False and body["terminal_state"] == "escalated"
