"""deduped_entries + the durable full-lifetime trace path.

The per-invoice timeline reads the FULL durable history (Postgres, append-only,
survives every refresh) rather than the in-memory log that clear()s each run -
deduped to one line per distinct step so re-orchestration noise doesn't pile up.
"""

from settl.audit import LogEntry, deduped_entries


def _e(agent, decision, reasoning="r", ts="2026-07-22T00:00:00Z") -> LogEntry:
    return LogEntry(timestamp=ts, invoice_id="INV-1", agent=agent, decision=decision, reasoning=reasoning)


def test_dedup_collapses_exact_repeats_keeping_first_and_order():
    entries = [
        _e("ingestion", "accepted", "complete", ts="t1"),
        _e("strategy", "chase", "170d overdue", ts="t2"),
        _e("sender", "sent", "emailed", ts="t3"),
        _e("ingestion", "accepted", "complete", ts="t4"),   # re-run dup
        _e("strategy", "hold", "too soon", ts="t5"),         # new step (chase -> hold)
        _e("ingestion", "accepted", "complete", ts="t6"),   # re-run dup again
    ]
    out = deduped_entries(entries)
    assert [(e.agent, e.decision) for e in out] == [
        ("ingestion", "accepted"),
        ("strategy", "chase"),
        ("sender", "sent"),
        ("strategy", "hold"),
    ]
    assert out[0].timestamp == "t1"  # kept the FIRST occurrence


def test_dedup_keeps_two_genuine_sends_with_different_reasoning():
    entries = [
        _e("email_sender", "sent", "first reminder", ts="t1"),
        _e("email_sender", "sent", "second reminder", ts="t2"),
    ]
    out = deduped_entries(entries)
    assert len(out) == 2  # different reasoning -> both are real, distinct sends


def test_dedup_empty_is_empty():
    assert deduped_entries([]) == []


def test_trace_reads_durable_deduped_history_when_supabase_on(monkeypatch):
    # BoardState.trace() should read the durable log (deduped) when Supabase is on,
    # so the timeline is the invoice's whole story, not just the current run.
    from settl.api import state as state_mod

    durable = [
        _e("sender", "sent", "emailed", ts="t1"),
        _e("sender", "sent", "emailed", ts="t2"),  # a duplicate from a re-run
        _e("inbound_classifier", "opt_out", "asked to stop", ts="t3"),
    ]
    captured = {}

    class _FakeState:
        _tenant_of = staticmethod(lambda iid: "t_demo")

    monkeypatch.setattr(state_mod.db, "supabase_enabled", lambda: True)

    def fake_load(tenant_id, invoice_id):
        captured["args"] = (tenant_id, invoice_id)
        return durable

    monkeypatch.setattr(state_mod.db, "load_execution_log", fake_load)

    # Call the unbound method against a minimal fake carrying the two collaborators
    # trace() touches (db is module-level, _tenant_of is on self).
    result = state_mod.BoardState.trace(_FakeState(), "INV-1")
    assert captured["args"] == ("t_demo", "INV-1")
    assert [(e.agent, e.decision) for e in result] == [
        ("sender", "sent"),
        ("inbound_classifier", "opt_out"),
    ]  # the duplicate send collapsed
