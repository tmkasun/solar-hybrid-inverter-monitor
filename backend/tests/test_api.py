import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app, state


@pytest.mark.asyncio
async def test_simulator_status_and_guarded_setting_change():
    await state.discover()
    await state.poll()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        status = await client.get("/api/status")
        assert status.status_code == 200
        assert status.json()["connected"] is True

        denied = await client.post("/api/settings/output_source_priority", json={"value": "sbu", "confirmation": "APPLY output_source_priority"})
        assert denied.status_code == 401

        state.sessions["test-session"] = "csrf"
        client.cookies.set("sako_session", "test-session")
        changed = await client.post("/api/settings/output_source_priority", headers={"X-CSRF-Token": "csrf"}, json={"value": "sbu", "confirmation": "APPLY output_source_priority"})
        assert changed.status_code == 200
        assert changed.json()["ok"] is True
