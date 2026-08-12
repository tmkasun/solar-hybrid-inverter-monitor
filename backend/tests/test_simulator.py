import pytest
from app.driver import SimulatorInverter, UsbHidInverter


@pytest.mark.asyncio
async def test_simulator_changes_priority():
    inverter = SimulatorInverter()
    assert await inverter.command("POP02") == "ACK"
    assert "02" in await inverter.command("QPIRI")


def test_usb_driver_discovers_nonstandard_hid_endpoints():
    class Endpoint:
        def __init__(self, address):
            self.bEndpointAddress = address

    class Interface:
        bInterfaceClass = 0x03
        bInterfaceNumber = 1

        def __iter__(self):
            return iter((Endpoint(0x02), Endpoint(0x82)))

    interface = Interface()
    assert UsbHidInverter._find_endpoints((interface,)) == (1, 0x02, 0x82)
