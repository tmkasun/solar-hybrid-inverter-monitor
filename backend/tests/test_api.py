import json

import pytest
from httpx import ASGITransport, AsyncClient

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
