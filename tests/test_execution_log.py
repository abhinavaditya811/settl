"""deduped_entries + the durable full-lifetime trace path.

The per-invoice timeline reads the FULL durable history (Postgres, append-only,
survives every refresh) rather than the in-memory log that clear()s each run -
deduped to one line per distinct step so re-orchestration noise doesn't pile up.
"""

from settl.audit import LogEntry, deduped_entries


def _e(agent, decision, reasoning="r", ts="2026-07-22T00:00:00Z") -> LogEntry:
    return LogEntry(timestamp=ts, invoice_id="INV-1", agent=agent, decision=decision, reasoning=reasoning)


def test_dedup_collapses_state_re_derivations_however_far_apart():
    # The main case: every restart/refresh re-runs run_batch and re-logs the same
    # ingestion/strategy for an unchanged invoice. These STATE steps alternate, so
    # they're never adjacent - a global (not consecutive) dedup is what removes them.
    entries = [
        _e("ingestion", "accepted", "complete", ts="t1"),
        _e("strategy", "hold", "too soon", ts="t2"),
        _e("ingestion", "accepted", "complete", ts="t3"),   # restart #2 - not adjacent
        _e("strategy", "hold", "too soon", ts="t4"),
        _e("ingestion", "accepted", "complete", ts="t5"),   # restart #3
        _e("strategy", "hold", "too soon", ts="t6"),
    ]
    out = deduped_entries(entries)
    assert [(e.agent, e.decision) for e in out] == [("ingestion", "accepted"), ("strategy", "hold")]
    assert out[0].timestamp == "t1"  # kept the FIRST occurrence


def test_dedup_never_collapses_a_real_event_even_if_identical():
    # Regression, found live: two genuinely SEPARATE real sends (the original chase,
    # then a payment-plan confirmation hours later) produced byte-identical reasoning
    # ("emailed INV-x via Gmail SMTP" - no date/content) - a plain triple-dedup once
    # silently hid the second, real send. A "sent" is an EVENT, never deduped.
    entries = [
        _e("email_sender", "sent", "emailed INV-1 via Gmail SMTP", ts="t1"),
        _e("compliance_gate", "escalate", "blocked", ts="t2"),
        _e("email_sender", "withheld", "blocked, not sent", ts="t3"),
        _e("compliance_gate", "pass", "cleared", ts="t4"),
        _e("email_sender", "sent", "emailed INV-1 via Gmail SMTP", ts="t5"),  # a second, real send
    ]
    out = deduped_entries(entries)
    kept = [(e.agent, e.decision, e.timestamp) for e in out]
    assert ("email_sender", "sent", "t1") in kept and ("email_sender", "sent", "t5") in kept  # both sends


def test_dedup_collapses_repeated_withholds_but_keeps_sends():
    # A withhold is a re-derivable state (the gate keeps escalating on each retry),
    # so identical ones collapse; a "sent" is a real event and is always kept.
    entries = [
        _e("email_sender", "withheld", "compliance escalated (PAYMENT_PLAN_REQUEST)", ts="t1"),
        _e("email_sender", "withheld", "compliance escalated (PAYMENT_PLAN_REQUEST)", ts="t2"),
        _e("email_sender", "withheld", "compliance escalated (PAYMENT_PLAN_REQUEST)", ts="t3"),
        _e("email_sender", "sent", "emailed INV-1 via Gmail SMTP", ts="t4"),
    ]
    out = deduped_entries(entries)
    assert [(e.agent, e.decision) for e in out] == [
        ("email_sender", "withheld"),  # 3 identical withholds -> 1
        ("email_sender", "sent"),      # the real send, kept
    ]


def test_dedup_keeps_two_genuine_sends_with_different_reasoning():
    entries = [
        _e("email_sender", "sent", "first reminder", ts="t1"),
        _e("email_sender", "sent", "second reminder", ts="t2"),
    ]
    out = deduped_entries(entries)
    assert len(out) == 2  # different reasoning -> both are real, distinct sends


def test_dedup_keeps_every_inbound_classification_event():
    # Classifications are events (what the debtor said, when) - even two identical
    # ones are kept; the debtor really did say it twice.
    entries = [
        _e("inbound_classifier", "opt_out", "asked to stop", ts="t1"),
        _e("strategy", "hold", "too soon", ts="t2"),
        _e("inbound_classifier", "opt_out", "asked to stop", ts="t3"),
    ]
    out = deduped_entries(entries)
    assert sum(1 for e in out if e.agent == "inbound_classifier") == 2


def test_dedup_empty_is_empty():
    assert deduped_entries([]) == []


def test_trace_reads_durable_deduped_history_when_supabase_on(monkeypatch):
    # BoardState.trace() should read the durable log (deduped) when Supabase is on,
    # so the timeline is the invoice's whole story, not just the current run.
    from settl.api import state as state_mod

    durable = [
        _e("strategy", "hold", "too soon", ts="t1"),
        _e("strategy", "hold", "too soon", ts="t2"),  # a re-derivation from a re-run
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
        ("strategy", "hold"),
        ("inbound_classifier", "opt_out"),
    ]  # the duplicate state re-derivation collapsed; the event kept
