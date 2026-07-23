"""Scheduled inbound-mail polling (api/inbound_poll_scheduler.py) - a background
loop standing in for a browser tab that's never open, per SCHEMA.md §7."""

import asyncio

import pytest

from settl.api import inbound_poll_scheduler as scheduler


@pytest.fixture(autouse=True)
def _clear_poll_status():
    scheduler._last_polled_at.clear()
    scheduler._last_error.clear()


class _FakeState:
    def __init__(self, results: dict[str, list[str]] | None = None, *, explode_for: str | None = None):
        self._results = results or {}
        self._explode_for = explode_for
        self.polled: list[str] = []

    def poll_inbound_mail(self, tenant_id: str) -> list[str]:
        self.polled.append(tenant_id)
        if tenant_id == self._explode_for:
            raise RuntimeError("simulated Gmail/DB failure")
        return self._results.get(tenant_id, [])


def test_poll_all_connected_tenants_noop_without_supabase(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: False)
    state = _FakeState({"t_1": ["INV-1"]})
    assert scheduler.poll_all_connected_tenants(state, list_tenants=lambda: ["t_1"]) == []
    assert state.polled == []  # never even looked up tenants


def test_poll_all_connected_tenants_polls_every_connected_tenant(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: True)
    state = _FakeState({"t_1": ["INV-1"], "t_2": ["INV-2", "INV-3"]})
    changed = scheduler.poll_all_connected_tenants(state, list_tenants=lambda: ["t_1", "t_2"])
    assert state.polled == ["t_1", "t_2"]
    assert changed == ["INV-1", "INV-2", "INV-3"]


def test_poll_all_connected_tenants_one_tenant_failure_does_not_block_the_rest(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: True)
    state = _FakeState({"t_2": ["INV-2"]}, explode_for="t_1")
    changed = scheduler.poll_all_connected_tenants(state, list_tenants=lambda: ["t_1", "t_2"])
    assert state.polled == ["t_1", "t_2"]  # t_2 still attempted after t_1 raised
    assert changed == ["INV-2"]


def test_run_forever_polls_then_sleeps_each_cycle(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: True)
    monkeypatch.setattr(scheduler, "poll_all_connected_tenants", lambda state, **_: state.polled.append("cycle") or [])
    state = _FakeState()
    sleep_calls = []

    async def fake_sleep(seconds):
        sleep_calls.append(seconds)
        if len(sleep_calls) >= 3:
            raise asyncio.CancelledError  # stop the otherwise-infinite loop

    import contextlib
    with contextlib.suppress(asyncio.CancelledError):
        asyncio.run(scheduler.run_forever(state, interval_seconds=5, sleep=fake_sleep))

    assert state.polled == ["cycle", "cycle", "cycle"]
    assert sleep_calls == [5, 5, 5]


def test_poll_interval_seconds_defaults_to_two_minutes(monkeypatch):
    monkeypatch.delenv("SETTL_INBOUND_POLL_INTERVAL_SECONDS", raising=False)
    assert scheduler.poll_interval_seconds() == 120


def test_poll_interval_seconds_reads_env_override(monkeypatch):
    monkeypatch.setenv("SETTL_INBOUND_POLL_INTERVAL_SECONDS", "45")
    assert scheduler.poll_interval_seconds() == 45


def test_poll_enabled_defaults_to_true(monkeypatch):
    monkeypatch.delenv("SETTL_INBOUND_POLL_ENABLED", raising=False)
    assert scheduler.poll_enabled() is True


def test_poll_enabled_false_when_explicitly_disabled(monkeypatch):
    monkeypatch.setenv("SETTL_INBOUND_POLL_ENABLED", "0")
    assert scheduler.poll_enabled() is False


def test_poll_all_connected_tenants_records_last_polled_at(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: True)
    state = _FakeState({"t_1": []})
    scheduler.poll_all_connected_tenants(state, list_tenants=lambda: ["t_1"])
    status = scheduler.poll_status()
    assert "t_1" in status["last_polled_at"]
    assert status["errors"] == {}


def test_poll_all_connected_tenants_records_error_for_a_failed_tenant(monkeypatch):
    monkeypatch.setattr(scheduler.db, "supabase_enabled", lambda: True)
    state = _FakeState(explode_for="t_1")
    scheduler.poll_all_connected_tenants(state, list_tenants=lambda: ["t_1"])
    status = scheduler.poll_status()
    assert "t_1" in status["last_polled_at"]  # attempted, timestamp still recorded
    assert "simulated Gmail/DB failure" in status["errors"]["t_1"]


def test_record_poll_clears_a_prior_error_on_the_next_success():
    scheduler.record_poll("t_1", error="boom")
    assert scheduler.poll_status()["errors"] == {"t_1": "boom"}
    scheduler.record_poll("t_1")
    assert scheduler.poll_status()["errors"] == {}


def test_lifespan_for_does_not_start_a_task_when_disabled(monkeypatch):
    monkeypatch.setenv("SETTL_INBOUND_POLL_ENABLED", "0")
    started = []
    monkeypatch.setattr(scheduler.asyncio, "create_task", lambda coro: started.append(coro) or coro.close())

    async def _run():
        async with scheduler.lifespan_for(_FakeState())(None):
            pass

    asyncio.run(_run())
    assert started == []
