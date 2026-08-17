import asyncio
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

import app.main as main_module
from app.bms import BmsCell, BmsError, BmsStatus
from app.main import app, state
from app.storage import Storage


@pytest.mark.asyncio
async def test_simulator_status_and_guarded_setting_change():
    await state.discover()
    await state.poll()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        status = await client.get("/api/status")
        assert status.status_code == 200
        assert status.json()["connected"] is True
        flags = status.json()["status"]["status_flags"]
        assert flags[0]["label"] == "SBU-priority capability"
        assert flags[0]["active"] is False

        denied = await client.post("/api/settings/output_source_priority", json={"value": "sbu", "confirmation": "APPLY output_source_priority"})
        assert denied.status_code == 401

        state.sessions["test-session"] = "csrf"
        client.cookies.set("sako_session", "test-session")
        changed = await client.post("/api/settings/output_source_priority", headers={"X-CSRF-Token": "csrf"}, json={"value": "sbu", "confirmation": "APPLY output_source_priority"})
        assert changed.status_code == 200
        assert changed.json()["ok"] is True


@pytest.mark.asyncio
async def test_history_accepts_hours_and_custom_ranges(tmp_path):
    previous_storage = state.storage
    state.storage = Storage(str(tmp_path / "history.db"))
    rows = [
        ("2026-01-01T00:00:00+00:00", {"battery_voltage": 50.1}),
        ("2026-01-01T01:00:00+00:00", {"battery_voltage": 51.2}),
        ("2026-01-01T02:00:00+00:00", {"battery_voltage": 52.3}),
    ]
    for captured_at, data in rows:
        state.storage.connection.execute("INSERT INTO samples VALUES (?, ?)", (captured_at, json.dumps(data)))
    state.storage.connection.commit()
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            hours = await client.get("/api/history?hours=24")
            assert hours.status_code == 200

            ranged = await client.get("/api/history?start=2026-01-01T00:30:00%2B00:00&end=2026-01-01T01:30:00%2B00:00")
            assert ranged.status_code == 200
            assert ranged.json()["samples"] == [{"captured_at": "2026-01-01T01:00:00+00:00", "battery_voltage": 51.2}]

            missing_end = await client.get("/api/history?start=2026-01-01T00:30:00%2B00:00")
            assert missing_end.status_code == 422

            reversed_range = await client.get("/api/history?start=2026-01-01T02:00:00%2B00:00&end=2026-01-01T01:00:00%2B00:00")
            assert reversed_range.status_code == 422

            too_many_hours = await client.get("/api/history?hours=721")
            assert too_many_hours.status_code == 422

            too_wide = await client.get("/api/history?start=2026-01-01T00:00:00%2B00:00&end=2026-02-01T00:01:00%2B00:00")
            assert too_wide.status_code == 422
    finally:
        state.storage.close()
        state.storage = previous_storage


@pytest.mark.asyncio
async def test_status_uses_fresh_bms_battery_values_and_keeps_inverter_values():
    previous_inverter = state.latest_inverter
    previous_bms = state.latest_bms
    try:
        state.latest_bms = BmsStatus(
            enabled=True,
            connected=True,
            source="simulator",
            captured_at=datetime.now(timezone.utc).isoformat(),
            voltage=26.6,
            current_a=-5.5,
            capacity_percent=81,
            cells=[BmsCell(1, 3.325), BmsCell(2, 3.326)],
        )
        await state.update_latest({
            "connected": True,
            "mode": "L",
            "status": {"battery_voltage": 25.1, "battery_charge_current": 2, "battery_discharge_current": 0, "battery_capacity_percent": 66},
            "warnings": None,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
        })

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            status = await client.get("/api/status")

        payload = status.json()
        assert payload["status"]["battery_source"] == "bms"
        assert payload["status"]["battery_voltage"] == 26.6
        assert payload["status"]["battery_discharge_current"] == 5.5
        assert payload["status"]["inverter_battery_voltage"] == 25.1
        assert payload["bms"]["connected"] is True
    finally:
        state.latest_bms = previous_bms
        await state.update_latest(previous_inverter)


@pytest.mark.asyncio
async def test_bms_poll_failure_keeps_last_good_bms_reading(monkeypatch):
    class FailingBms:
        async def status(self):
            raise BmsError("jkbms getCellData timed out after 25s")

    previous_inverter = state.latest_inverter
    previous_bms = state.latest_bms
    previous_driver = state.bms
    monkeypatch.setattr(main_module, "settings", SimpleNamespace(
        bms_mode="jkbms",
        bms_bluetooth_address="AA:BB:CC:DD:EE:FF",
        bms_name="JK-BMS",
        bms_protocol="JK02",
        bms_poll_seconds=30,
        bms_timeout_seconds=25,
        poll_seconds=5,
    ))
    try:
        state.bms = FailingBms()
        state.latest_bms = BmsStatus(
            enabled=True,
            connected=True,
            source="mppsolar",
            address="AA:BB:CC:DD:EE:FF",
            protocol="JK02",
            captured_at=datetime.now(timezone.utc).isoformat(),
            voltage=26.1,
            current_a=2.0,
            capacity_percent=15,
            cells=[BmsCell(1, 3.25)],
        )
        await state.update_latest({
            "connected": True,
            "mode": "L",
            "status": {"battery_voltage": 25.1, "battery_capacity_percent": 66},
            "warnings": None,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
        })

        bms = await state.poll_bms()

        assert bms.connected is True
        assert bms.stale is True
        assert bms.error is None
        assert bms.last_error == "jkbms getCellData timed out after 25s"
        assert state.latest["status"]["battery_source"] == "bms"
        assert state.latest["status"]["battery_voltage"] == 26.1
    finally:
        state.bms = previous_driver
        state.latest_bms = previous_bms
        await state.update_latest(previous_inverter)


@pytest.mark.asyncio
async def test_broadcast_drops_slow_websocket(monkeypatch):
    class SlowSocket:
        async def send_json(self, _: dict):
            await asyncio.sleep(1)

    slow_socket = SlowSocket()
    monkeypatch.setattr(main_module, "BROADCAST_TIMEOUT_SECONDS", 0.01)
    state.sockets.add(slow_socket)
    try:
        await state.broadcast({"type": "telemetry", "data": {}})
        assert slow_socket not in state.sockets
    finally:
        state.sockets.discard(slow_socket)


def test_database_sample_interval_is_independent_from_live_poll(monkeypatch):
    monkeypatch.setattr(main_module, "settings", SimpleNamespace(db_sample_seconds=15))
    captured_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    state_stub = SimpleNamespace(last_stored_sample_at=None)

    assert main_module.State.should_store_sample(state_stub, captured_at) is True

    state_stub.last_stored_sample_at = captured_at
    assert main_module.State.should_store_sample(state_stub, captured_at.replace(second=14)) is False
    assert main_module.State.should_store_sample(state_stub, captured_at.replace(second=15)) is True


@pytest.mark.asyncio
async def test_poll_retries_discovery_after_startup_usb_miss(monkeypatch, tmp_path):
    class RecoveringInverter:
        def __init__(self):
            self.commands = []

        async def command(self, command):
            self.commands.append(command)
            replies = {
                "QPI": "PI30",
                "QID": "SAKO-RECOVERED",
                "QVFW": "VERFW:00001.00",
                "QVFW2": "VERFW2:00001.00",
                "QPIRI": "230.0 30.0 230.0 50.0 13.0 3000 2400 48.0 54.0 42.0 56.4 54.0 AGM 30 60 UPS 01 01",
                "QFLAG": "Eabjkuvxyz",
                "QPIGS": "230.0 50.0 230.0 50.0 0550 0440 22 390 51.20 012 86 31 4.2 116.0 51.10 000 01000000",
                "QMOD": "L",
                "QPIWS": "00000000000000000000000000000000",
            }
            return replies[command]

    previous_inverter = state.inverter
    previous_storage = state.storage
    previous_diagnostics = state.diagnostics
    previous_latest_inverter = state.latest_inverter
    previous_latest = state.latest
    previous_last_discovery_attempt_at = state.last_discovery_attempt_at
    recovering = RecoveringInverter()
    monkeypatch.setattr(main_module, "settings", SimpleNamespace(
        discovery_retry_seconds=60,
        db_sample_seconds=15,
        bms_poll_seconds=30,
        bms_timeout_seconds=25,
        poll_seconds=5,
    ))
    try:
        state.inverter = recovering
        state.storage = Storage(str(tmp_path / "recover.db"))
        state.diagnostics = {"QPI": {"error": "USB inverter 0665:5161 not found"}}
        await state.update_latest({
            "connected": False,
            "mode": None,
            "status": {},
            "warnings": None,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "error": "inverter has not identified as PIP-compatible",
        })
        state.last_discovery_attempt_at = datetime.now(timezone.utc) - timedelta(seconds=61)

        await state.poll()

        assert state.latest["connected"] is True
        assert state.latest["error"] is None
        assert recovering.commands[:6] == ["QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG"]
        assert recovering.commands[-3:] == ["QPIGS", "QMOD", "QPIWS"]
    finally:
        state.storage.close()
        state.inverter = previous_inverter
        state.storage = previous_storage
        state.diagnostics = previous_diagnostics
        state.latest_inverter = previous_latest_inverter
        state.latest = previous_latest
        state.last_discovery_attempt_at = previous_last_discovery_attempt_at


def test_bms_poll_loop_schedules_from_poll_start_time():
    assert main_module.next_poll_delay(40, started_at=100, finished_at=105) == 35
    assert main_module.next_poll_delay(40, started_at=100, finished_at=145) == 0
