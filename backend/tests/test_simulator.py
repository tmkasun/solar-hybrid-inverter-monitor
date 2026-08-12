import pytest
from app.driver import SimulatorInverter, UsbHidInverter
from app.protocol import frame


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


def test_usb_driver_accepts_hid_control_output_reports():
    class Endpoint:
        bEndpointAddress = 0x81

    class Interface:
        bInterfaceClass = 0x03
        bInterfaceNumber = 0

        def __iter__(self):
            return iter((Endpoint(),))

    assert UsbHidInverter._find_endpoints((Interface(),)) == (0, None, 0x81)


def test_usb_driver_uses_hid_set_report_without_an_out_endpoint():
    class Device:
        def __init__(self):
            self.transfer = None

        def ctrl_transfer(self, *args, **kwargs):
            self.transfer = args, kwargs

        def read(self, endpoint, size, timeout):
            assert (endpoint, size, timeout) == (0x81, 8, 2500)
            return frame("(ACK")

    inverter = UsbHidInverter(0x0665, 0x5161)
    inverter.device = Device()
    inverter.interface = 0
    inverter.endpoint_in = 0x81
    assert inverter._send("QMOD") == "ACK"
    assert inverter.device.transfer == ((0x21, 0x09, 0x0200, 0, frame("QMOD").ljust(8, b"\0")), {"timeout": 2500})
