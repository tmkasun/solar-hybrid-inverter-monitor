import sqlite3
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module
from app.alarms import decode_alarms, retain_confirmed_alarms
from app.cli import main
from app.driver import InverterError, SimulatorInverter
from app.monitoring import read_snapshot
from app.storage import Storage


LINE_CAPTURE = "00000001000000000000000000000000"
BATTERY_CAPTURE = "00000101000010000000000000000000"


def bits(*positions):
    return "".join("1" if index in positions else "0" for index in range(32))


@pytest.mark.parametrize("raw,mode,keys", [
    (LINE_CAPTURE, "L", ["output_voltage_low"]),
    (BATTERY_CAPTURE, "B", ["line_fail", "output_voltage_low", "battery_low"]),
])
def test_captured_alarm_replies(raw, mode, keys):
    alarms = decode_alarms(raw, mode)
    assert alarms["available"]
    assert alarms["severity"] == "fault"
    assert [item["key"] for item in alarms["active"]] == keys
    assert alarms["mapping"] == "pi30_standard"


@pytest.mark.parametrize("position", [9, 10, 11, 16])
def test_conditional_severity(position):
    assert decode_alarms(bits(position), "L")["severity"] == "warning"
    assert decode_alarms(bits(1, position), "L")["severity"] == "fault"
    assert decode_alarms(bits(position), "F")["severity"] == "fault"


@pytest.mark.parametrize("raw", [None, "NAK", "101", "x" * 32, "0" * 36])
def test_unavailable_replies_and_fault_mode(raw):
    assert decode_alarms(raw, "L")["severity"] == "unknown"
    alarms = decode_alarms(raw, "F")
    assert not alarms["available"]
    assert alarms["severity"] == "fault"
    assert alarms["active"][0]["key"] == "fault_mode"


def test_unknown_bits_and_protocol_are_never_silently_healthy():
    alarms = decode_alarms(bits(30), "L")
    assert alarms["active"][0]["key"] == "unknown_bit_30"
    assert alarms["severity"] == "warning"
    alarms = decode_alarms(bits(7), "L", "PI41")
    assert not alarms["available"]
    assert alarms["active"][0]["key"] == "unknown_bit_7"
    assert decode_alarms(bits(), "L")["severity"] == "ok"


@pytest.mark.asyncio
@pytest.mark.parametrize("reply", ["NAK", "bad-reply", InverterError("USB timeout")])
async def test_failed_warning_query_preserves_telemetry(reply):
    class Inverter(SimulatorInverter):
        async def command(self, command):
            if command == "QPIWS":
                if isinstance(reply, Exception):
                    raise reply
                return reply
            return await super().command(command)

    snapshot = await read_snapshot(Inverter("fault"))
    assert snapshot["connected"]
    assert snapshot["status"]["output_voltage"] == 230
    assert snapshot["alarms"]["severity"] == "fault"
    assert not snapshot["alarms"]["available"]
    assert snapshot["alarms"]["error"]


@pytest.mark.parametrize("scenario,raw,mode,temperature", [("captured_line", LINE_CAPTURE, "L", 47.1), ("captured_battery", BATTERY_CAPTURE, "B", 45.9)])
def test_cli_capture_scenarios(scenario, raw, mode, temperature, capsys):
    import json
    assert main(["--mode", "simulator", "--simulate-alarm", scenario, "status", "--json"]) == 0
    snapshot = json.loads(capsys.readouterr().out)
    assert snapshot["warnings"] == raw
    assert snapshot["mode"] == mode
    assert snapshot["status"]["battery_voltage"] < 26
    assert snapshot["status"]["inverter_temperature_c"] == temperature
    assert snapshot["alarms"]["severity"] == "fault"


def observation(raw=bits(), *, mode="L", connected=True, previous=None, timestamp=None):
    captured = timestamp or datetime.now(timezone.utc).isoformat()
    return retain_confirmed_alarms({
        "connected": connected, "captured_at": captured, "mode": mode,
        "warnings": raw, "error": None, "status": {},
        "alarms": {**decode_alarms(raw, mode), "captured_at": captured},
    }, (previous or {}).get("alarms"))


def test_history_transitions_outage_recovery_and_restart(tmp_path):
    path = str(tmp_path / "alarms.db")
    storage = Storage(path)
    alarm = observation(bits(12))
    assert storage.record_alarm_snapshot(alarm, "PI30")
    assert not storage.record_alarm_snapshot(observation(bits(12)), "PI30")
    unknown = observation(None, previous=alarm)
    assert storage.record_alarm_snapshot(unknown, "PI30")
    assert storage.latest_alarm_event()["cleared"] == []
    assert not storage.record_alarm_snapshot(observation("NAK", previous=unknown), "PI30")
    storage.close()
    storage = Storage(path)
    baseline = storage.latest_alarm_event()
    assert baseline["alarms"]["last_confirmed_active"][0]["key"] == "battery_low"
    recovered = observation(bits(12), previous=baseline)
    assert storage.record_alarm_snapshot(recovered, "PI30")
    assert storage.latest_alarm_event()["kind"] == "restored"
    assert storage.latest_alarm_event()["raised"] == []
    cleared = observation(previous=recovered)
    assert storage.record_alarm_snapshot(cleared, "PI30")
    event = storage.latest_alarm_event()
    assert event["cleared"] == ["battery_low"]
    assert event["cleared_alarms"][0]["label"] == "Low battery alarm"
    assert not storage.record_alarm_snapshot(observation(), "PI30")
    storage.compact(0)
    assert storage.connection.execute("SELECT COUNT(*) FROM inverter_alarm_events").fetchone()[0] == 4
    storage.close()


def test_severity_changes_and_disconnect_do_not_clear(tmp_path):
    storage = Storage(str(tmp_path / "alarms.db"))
    alarm = observation(bits(9))
    storage.record_alarm_snapshot(alarm, "PI30")
    fault = observation(bits(9), mode="F", previous=alarm)
    storage.record_alarm_snapshot(fault, "PI30")
    assert storage.latest_alarm_event()["severity_changed"] == ["over_temperature"]
    offline = observation(bits(9), connected=False, previous=fault)
    storage.record_alarm_snapshot(offline, "PI30")
    assert storage.latest_alarm_event()["kind"] == "unavailable"
    assert storage.latest_alarm_event()["cleared"] == []
    storage.close()


@pytest.fixture
def alarm_state(tmp_path, monkeypatch):
    monkeypatch.setattr(main_module, "settings", replace(main_module.settings, mode="simulator", bms_mode="disabled", database_path=str(tmp_path / "api.db")))
    state = main_module.State()
    monkeypatch.setattr(main_module, "state", state)
    state.diagnostics = {"QPI": "PI30"}
    yield state
    state.storage.close()


@pytest.mark.asyncio
async def test_api_status_websocket_and_history_independent_of_sample_interval(alarm_state):
    state = alarm_state
    broadcasts = []
    async def broadcast(message):
        broadcasts.append(message)
    state.broadcast = broadcast
    state.inverter.alarm = "captured_battery"
    await state.poll()
    state.inverter.alarm = "none"
    await state.poll()
    assert len(state.storage.history(24)) == 1
    assert len(broadcasts) == 2
    assert broadcasts[0]["data"]["alarms"]["severity"] == "fault"
    async with AsyncClient(transport=ASGITransport(app=main_module.app), base_url="http://test") as client:
        assert (await client.get("/api/status")).json()["alarms"]["severity"] == "ok"
        first = (await client.get("/api/alarms/history?limit=1")).json()
        assert len(first["events"]) == 1
        assert first["events"][0]["cleared"] == ["battery_low", "line_fail", "output_voltage_low"]
        second = (await client.get(f'/api/alarms/history?limit=1&before_id={first["next_before_id"]}')).json()
        assert second["events"][0]["kind"] == "initial"
        assert second["next_before_id"] is None
        for query in ["limit=0", "limit=201", "before_id=0", "hours=0", "hours=721", "start=2026-01-01", "start=2026-02-01&end=2026-01-01", "start=2026-01-01&end=2026-03-01"]:
            assert (await client.get(f"/api/alarms/history?{query}")).status_code == 422
        filtered = await client.get("/api/alarms/history?start=2020-01-01T00:00:00Z&end=2020-01-02T00:00:00Z")
        assert filtered.json()["events"] == []


@pytest.mark.asyncio
async def test_persistence_failure_does_not_advance_baseline_or_hide_live_alarms(alarm_state, monkeypatch, caplog):
    caplog.set_level("ERROR", logger="app.main")
    state = alarm_state
    await state.poll()
    original = state.storage.record_alarm_snapshot
    def fail(*args):
        raise sqlite3.OperationalError("database locked")
    monkeypatch.setattr(state.storage, "record_alarm_snapshot", fail)
    state.inverter.alarm = "low_battery"
    await state.poll()
    assert state.latest["connected"]
    assert state.latest["alarms"]["active"][0]["key"] == "battery_low"
    assert state.storage.latest_alarm_event()["alarms"]["severity"] == "ok"
    assert "live monitoring continues" in caplog.text
    monkeypatch.setattr(state.storage, "record_alarm_snapshot", original)
    await state.poll()
    assert state.storage.latest_alarm_event()["raised"] == ["battery_low"]


@pytest.mark.asyncio
async def test_usb_failure_keeps_confirmed_alarms_and_recovery_clears(alarm_state):
    state = alarm_state
    state.inverter.alarm = "low_battery"
    await state.poll()
    state.inverter.fail_next = True
    await state.poll()
    assert not state.latest["connected"]
    assert state.latest["alarms"]["last_confirmed_active"][0]["key"] == "battery_low"
    assert state.storage.latest_alarm_event()["cleared"] == []
    state.inverter.alarm = "none"
    await state.poll()
    assert state.storage.latest_alarm_event()["kind"] == "restored"
    assert state.storage.latest_alarm_event()["cleared"] == ["battery_low"]


@pytest.mark.asyncio
async def test_failed_sql_insert_rolls_back_and_live_broadcast_continues(alarm_state):
    state = alarm_state
    await state.poll()
    baseline = state.storage.latest_alarm_event()["id"]
    state.storage.connection.executescript("""
        CREATE TRIGGER reject_alarm BEFORE INSERT ON inverter_alarm_events
        BEGIN SELECT RAISE(FAIL, 'simulated write failure'); END;
    """)
    state.inverter.alarm = "low_battery"
    await state.poll()
    assert state.latest["alarms"]["severity"] == "warning"
    assert state.storage.latest_alarm_event()["id"] == baseline
    assert not state.storage.connection.in_transaction
    state.storage.connection.execute("DROP TRIGGER reject_alarm")
    await state.poll()
    assert state.storage.latest_alarm_event()["raised"] == ["battery_low"]


@pytest.mark.asyncio
async def test_full_database_failure_does_not_suppress_broadcast(alarm_state, monkeypatch):
    state = alarm_state
    messages = []
    async def broadcast(message):
        messages.append(message)
    def fail(*args):
        raise sqlite3.OperationalError("database locked")
    state.broadcast = broadcast
    monkeypatch.setattr(state.storage, "record_alarm_snapshot", fail)
    monkeypatch.setattr(state.storage, "add_sample", fail)
    state.inverter.alarm = "captured_battery"
    await state.poll()
    assert messages[0]["data"]["connected"]
    assert messages[0]["data"]["alarms"]["severity"] == "fault"
    assert state.last_stored_sample_at is None


@pytest.mark.asyncio
async def test_state_startup_restores_unconfirmed_alarms_without_duplicate_events(alarm_state):
    state = alarm_state
    state.inverter.alarm = "captured_battery"
    await state.poll()
    restored = main_module.State()
    try:
        assert not restored.latest["connected"]
        assert [alarm["key"] for alarm in restored.latest["alarms"]["last_confirmed_active"]] == ["line_fail", "output_voltage_low", "battery_low"]
        restored.diagnostics = {"QPI": "PI30"}
        restored.inverter.alarm = "captured_battery"
        await restored.poll()
        assert restored.storage.latest_alarm_event()["id"] == state.storage.latest_alarm_event()["id"]
        restored.inverter.alarm = "none"
        await restored.poll()
        assert restored.storage.latest_alarm_event()["cleared"] == ["battery_low", "line_fail", "output_voltage_low"]
    finally:
        restored.storage.close()


def test_history_time_filters(tmp_path):
    storage = Storage(str(tmp_path / "alarms.db"))
    now = datetime.now(timezone.utc)
    for index in range(3):
        storage.record_alarm_snapshot(observation(bits(12) if index % 2 else bits(), timestamp=(now + timedelta(seconds=index)).isoformat()), "PI30")
    result = storage.alarm_history((now + timedelta(seconds=1)).isoformat(), (now + timedelta(seconds=1)).isoformat())
    assert len(result["events"]) == 1
    assert result["events"][0]["alarms"]["active"][0]["key"] == "battery_low"
    storage.close()
