import pytest
from app.driver import SimulatorInverter


@pytest.mark.asyncio
async def test_simulator_changes_priority():
    inverter = SimulatorInverter()
    assert await inverter.command("POP02") == "ACK"
    assert "02" in await inverter.command("QPIRI")
