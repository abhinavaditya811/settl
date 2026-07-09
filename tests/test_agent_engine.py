"""Week 5: the LogSink seam, the Agent Engine sink, and evidence export.

The Agent Engine sink is a deferred 🔌 seam, so we exercise it against a FAKE Cloud
Logging client (no network, no creds): entries route through it, and any client error is
swallowed (fail-safe). We also assert the local JSONL path still works unchanged, and that
the evidence export round-trips.
"""

import json
from datetime import date
from decimal import Decimal

from settl.audit import (
    AgentEngineSink,
    ExecutionLog,
    JsonlSink,
    LogSink,
    agent_engine_enabled,
    evidence_bundle,
    load_evidence,
    write_evidence,
)


# --- fakes --------------------------------------------------------------------


class _FakeLogger:
    def __init__(self):
        self.structs = []

    def log_struct(self, info, severity=None, labels=None):
        self.structs.append((info, severity, labels))


class _FakeClient:
    def __init__(self):
        self.logger_obj = _FakeLogger()
        self.names = []

    def logger(self, name):
        self.names.append(name)
        return self.logger_obj


class _BoomLogger:
    def log_struct(self, *a, **k):
        raise RuntimeError("cloud logging down")


class _BoomClient:
    def logger(self, name):
        return _BoomLogger()


def _log_with(*sinks):
    log = ExecutionLog(sinks=list(sinks))
    log.record(invoice_id="INV-1", agent="strategy", decision="chase", reasoning="overdue")
    log.record(invoice_id="INV-1", agent="sender", decision="sent", reasoning="clean")
    log.record(invoice_id="INV-2", agent="strategy", decision="skip", reasoning="paid")
    return log


# --- the sink seam ------------------------------------------------------------


def test_agent_engine_sink_is_a_logsink():
    assert isinstance(AgentEngineSink(client=_FakeClient()), LogSink)


def test_entries_are_mirrored_to_the_agent_engine_sink():
    fake = _FakeClient()
    _log_with(AgentEngineSink(client=fake))
    assert fake.names == ["settl-execution-log"]
    assert len(fake.logger_obj.structs) == 3
    info, severity, labels = fake.logger_obj.structs[0]
    assert info["invoice_id"] == "INV-1" and info["agent"] == "strategy"
    assert severity == "INFO"
    assert labels["invoice_id"] == "INV-1" and labels["agent"] == "strategy"


def test_sink_failure_never_breaks_recording():
    # A dead cloud client must not stop the in-memory (source-of-truth) log.
    log = _log_with(AgentEngineSink(client=_BoomClient()))
    assert len(log.entries) == 3


def test_agent_engine_is_opt_in(monkeypatch):
    monkeypatch.delenv("SETTL_USE_AGENT_ENGINE", raising=False)
    assert agent_engine_enabled() is False
    monkeypatch.setenv("SETTL_USE_AGENT_ENGINE", "1")
    assert agent_engine_enabled() is True


# --- local JSONL still works (no behavior change) -----------------------------


def test_jsonl_sink_still_writes_offline(tmp_path):
    path = tmp_path / "log.jsonl"
    _log_with(JsonlSink(path))
    lines = path.read_text().strip().splitlines()
    assert len(lines) == 3
    assert json.loads(lines[0])["invoice_id"] == "INV-1"


def test_jsonl_path_constructor_is_unchanged(tmp_path):
    path = tmp_path / "log.jsonl"
    log = ExecutionLog(jsonl_path=path)  # the legacy call every agent uses
    log.record(invoice_id="INV-9", agent="gate", decision="pass", reasoning="ok")
    assert len(log.entries) == 1
    assert path.read_text().count("INV-9") == 1


# --- evidence export round-trips ----------------------------------------------


def test_evidence_bundle_summarizes_and_groups():
    log = _log_with()
    bundle = evidence_bundle(log.entries, generated_at="2026-07-06T00:00:00+00:00")
    assert bundle["entry_count"] == 3
    assert bundle["invoice_count"] == 2
    assert bundle["agents"] == {"strategy": 2, "sender": 1}
    assert bundle["decisions"]["chase"] == 1
    assert len(bundle["by_invoice"]["INV-1"]) == 2


def test_evidence_export_round_trips(tmp_path):
    log = _log_with()
    stamp = "2026-07-06T00:00:00+00:00"
    path = write_evidence(log.entries, tmp_path / "evidence.json", generated_at=stamp)
    assert load_evidence(path) == evidence_bundle(log.entries, generated_at=stamp)
