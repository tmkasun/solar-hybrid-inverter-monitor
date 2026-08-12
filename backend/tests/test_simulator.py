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


def test_usb_driver_reads_status_across_multiple_hid_reports():
    status = "230.0 50.0 230.0 50.0 0550 0440 22 390 51.20 012 86 31 4.2 116.0 51.10 000 01000000"
    reply = frame(f"({status}")
    reports = [reply[index:index + 8] for index in range(0, len(reply), 8)]

    class Device:
        def ctrl_transfer(self, *args, **kwargs):
            return None

        def read(self, endpoint, size, timeout):
            return reports.pop(0)

    inverter = UsbHidInverter(0x0665, 0x5161)
    inverter.device = Device()
    inverter.interface = 0
    inverter.endpoint_in = 0x81
    assert inverter._send("QPIGS") == status
