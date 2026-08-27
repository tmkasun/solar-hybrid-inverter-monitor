import asyncio
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.bms import (
    BmsCell,
    BmsError,
    BmsStatus,
    JkbmsAutoBms,
    JkbmsBleBms,
    JkbmsCliBms,
    SimulatorBms,
    apply_bms_to_status,
    bms_from_settings,
    bms_history_metrics,
    bms_setting_spec,
    build_jkbms_register_frame,
    build_jkbms_command,
    compact_process_detail,
    encode_bms_setting_value,
    parse_jkbms_ble_settings,
    parse_jkbms_ble_cell_info,
    normalize_mppsolar_status,
    parse_json_output,
    scan_bluetooth_devices,
    validate_jkbms_ble_frame,
)


def sample_mppsolar_payload():
    return {
        "getCellData": {
            "_command": ["getCellData", ""],
            "_command_description": ["BLE Cell Data inquiry", ""],
            "Voltage_Cell01": [3.322, "V"],
            "Voltage_Cell02": [3.324, "V"],
            "Voltage_Cell03": [3.323, "V"],
            "Voltage_Cell04": [3.326, "V"],
            "Voltage_Cell05": [3.321, "V"],
            "Voltage_Cell06": [3.324, "V"],
            "Voltage_Cell07": [3.325, "V"],
            "Voltage_Cell08": [3.323, "V"],
            "WireRes_Cell01": [0.42, "mOhm"],
            "WireRes_Cell02": [0.43, "mOhm"],
            "WireRes_Cell03": [0.44, "mOhm"],
            "WireRes_Cell04": [0.45, "mOhm"],
            "WireRes_Cell05": [0.46, "mOhm"],
            "WireRes_Cell06": [0.47, "mOhm"],
            "WireRes_Cell07": [0.48, "mOhm"],
            "WireRes_Cell08": [0.49, "mOhm"],
            "Battery_Voltage": [26.588, "V"],
            "Current_Charge": [0.0, "A"],
            "Current_Discharge": [6.25, "A"],
            "Percent_Remain": [78, "%"],
            "Capacity_Remain": [93.6, "Ah"],
            "Nominal_Capacity": [120, "Ah"],
            "Cycle_Count": [42, ""],
            "Balance_Current": [0.01, "A"],
            "Battery_T1": [29.4, "°C"],
            "Battery_T2": [29.8, "°C"],
            "MOS_Temp": [32.1, "°C"],
            "raw_response": ["large binary blob", ""],
        }
    }


def sample_jkbms_ble_frame_24s():
    frame = bytearray(300)
    frame[:4] = b"\x55\xaa\xeb\x90"
    frame[4] = 0x02
    frame[5] = 0x8C

    def set_u16(offset, value):
        frame[offset:offset + 2] = int(value).to_bytes(2, "little", signed=False)

    def set_i16(offset, value):
        frame[offset:offset + 2] = int(value).to_bytes(2, "little", signed=True)

    def set_u32(offset, value):
        frame[offset:offset + 4] = int(value).to_bytes(4, "little", signed=False)

    def set_i32(offset, value):
        frame[offset:offset + 4] = int(value).to_bytes(4, "little", signed=True)

    cell_voltages = [3322, 3324, 3323, 3326, 3321, 3324, 3325, 3323]
    for index, millivolts in enumerate(cell_voltages):
        set_u16(6 + index * 2, millivolts)
        set_u16(64 + index * 2, 420 + index)
    set_u32(118, 26588)
    set_i32(126, -6250)
    set_i16(130, 294)
    set_i16(132, 298)
    set_i16(134, 321)
    set_i16(138, 10)
    frame[141] = 78
    set_u32(142, 93600)
    set_u32(146, 120000)
    set_u32(150, 42)
    set_u32(154, 3120000)
    frame[299] = sum(frame[:299]) & 0xFF
    return bytes(frame)


def sample_jkbms_settings_frame_24s(*, max_charge_current=25.0):
    frame = bytearray(300)
    frame[:4] = b"\x55\xaa\xeb\x90"
    frame[4] = 0x01
    frame[5] = 0x4F

    def set_i32(offset, value):
        frame[offset:offset + 4] = int(value).to_bytes(4, "little", signed=True)

    def set_u32(offset, value):
        frame[offset:offset + 4] = int(value).to_bytes(4, "little", signed=False)

    set_u32(6, 600)
    set_u32(10, 2900)
    set_u32(14, 3200)
    set_u32(18, 3650)
    set_u32(22, 3500)
    set_u32(26, 10)
    set_u32(30, 3400)
    set_u32(34, 2800)
    set_u32(38, 3400)
    set_u32(42, 3375)
    set_u32(46, 2700)
    set_u32(50, int(max_charge_current * 1000))
    set_u32(54, 30)
    set_u32(58, 60)
    set_u32(62, 150000)
    set_u32(66, 300)
    set_u32(70, 60)
    set_u32(74, 60)
    set_u32(78, 300)
    set_u32(82, 600)
    set_u32(86, 550)
    set_u32(90, 650)
    set_u32(94, 600)
    set_i32(98, -50)
    set_i32(102, 0)
    set_i32(106, 950)
    set_i32(110, 800)
    set_u32(114, 8)
    set_u32(118, 1)
    set_u32(122, 1)
    set_u32(126, 1)
    set_u32(130, 120000)
    set_u32(134, 2000)
    set_u32(138, 3200)
    frame[299] = sum(frame[:299]) & 0xFF
    return bytes(frame)


def test_normalizes_mppsolar_jkbms_status():
    status = normalize_mppsolar_status(
        sample_mppsolar_payload(),
        address="C8:47:8C:E2:A0:2E",
        name="JK-B1A20S15P",
        protocol="JK02",
        cell_count=8,
    )

    assert status.connected is True
    assert status.address == "C8:47:8C:E2:A0:2E"
    assert status.voltage == 26.588
    assert status.current_a == -6.25
    assert status.power_w == -166.2
    assert status.capacity_percent == 78
    assert len(status.cells) == 8
    assert status.cells[0].resistance_mohm == 0.42
    assert status.cells[0].wire_resistance_mohm == 0.42
    assert status.cells[7].resistance_mohm == 0.49
    assert status.cells[7].wire_resistance_mohm == 0.49
    assert status.min_cell_voltage == 3.321
    assert status.max_cell_voltage == 3.326
    assert status.delta_cell_voltage == 0.005
    assert "raw_response" not in status.raw_summary["keys"]


def test_builds_jkbms_ble_commands_with_sum_crc():
    cell_info = build_jkbms_command(0x96)
    device_info = build_jkbms_command(0x97)

    assert cell_info.hex() == "aa5590eb96000000000000000000000000000010"
    assert device_info.hex() == "aa5590eb97000000000000000000000000000011"


def test_builds_jkbms_register_write_frame_with_scaled_payload():
    spec = bms_setting_spec("max_charge_current")
    payload = build_jkbms_register_frame(0x0C, encode_bms_setting_value(spec, 25.0), spec.length)

    assert payload.hex() == "aa5590eb0c04a861000000000000000000000093"


def test_parses_jkbms_settings_frame_24s():
    settings = parse_jkbms_ble_settings(sample_jkbms_settings_frame_24s(), protocol="JK02", cell_count=8)

    assert settings.supported is True
    assert settings.values["power_off_voltage"] == 2.7
    assert settings.values["max_charge_current"] == 25.0
    assert settings.values["max_discharge_current"] == 150.0
    assert settings.values["charge_undertemperature_protection"] == -5.0
    assert settings.values["charging"] is True
    assert settings.values["voltage_calibration"] is None
    assert next(setting for setting in settings.settings if setting["key"] == "voltage_calibration")["writable"] is False


def test_rejects_jkbms_ble_frame_with_invalid_crc():
    frame = bytearray(sample_jkbms_ble_frame_24s())
    frame[299] ^= 0xFF

    with pytest.raises(BmsError, match="CRC check failed"):
        validate_jkbms_ble_frame(bytes(frame))


def test_parses_jkbms_ble_24s_cell_info_frame():
    status = parse_jkbms_ble_cell_info(
        sample_jkbms_ble_frame_24s(),
        address="C8:47:8C:E2:A0:2E",
        name="JK-B1A20S15P",
        protocol="JK02",
        cell_count=8,
    )

    assert status.connected is True
    assert status.source == "jkbms-ble"
    assert status.raw_summary["layout"] == "24s"
    assert status.address == "C8:47:8C:E2:A0:2E"
    assert status.voltage == 26.588
    assert status.current_a == -6.25
    assert status.power_w == -166.2
    assert status.capacity_percent == 78
    assert status.remaining_capacity_ah == 93.6
    assert status.nominal_capacity_ah == 120
    assert status.cycle_count == 42
    assert status.cycle_capacity_ah == 3120
    assert status.balance_current_a == 0.01
    assert status.battery_t1_c == 29.4
    assert status.battery_t2_c == 29.8
    assert status.mos_temperature_c == 32.1
    assert len(status.cells) == 8
    assert status.cells[0].voltage == 3.322
    assert status.cells[0].wire_resistance_mohm == 0.42
    assert status.delta_cell_voltage == 0.005


def test_normalizer_allows_missing_optional_fields():
    status = normalize_mppsolar_status({"Voltage_Cell01": [3.3, "V"], "Voltage_Cell02": [3.31, "V"]}, cell_count=2)

    assert status.voltage == 6.61
    assert status.capacity_percent is None
    assert status.current_a is None
    assert status.cells[0].resistance_mohm is None
    assert status.cells[0].wire_resistance_mohm is None


def test_bms_history_metrics_includes_cell_resistance_when_present():
    bms = BmsStatus(
        enabled=True,
        connected=True,
        source="simulator",
        captured_at=datetime.now(timezone.utc).isoformat(),
        cells=[BmsCell(1, 3.312, wire_resistance_mohm=0.421), BmsCell(2, 3.313)],
    )

    metrics = bms_history_metrics(bms)

    assert metrics["bms_cell_01_voltage"] == 3.312
    assert metrics["bms_cell_01_resistance_mohm"] == 0.421
    assert metrics["bms_cell_01_wire_resistance_mohm"] == 0.421
    assert metrics["bms_cell_02_voltage"] == 3.313
    assert "bms_cell_02_resistance_mohm" not in metrics
    assert "bms_cell_02_wire_resistance_mohm" not in metrics


def test_normalizer_prefers_computed_power_over_raw_jkbms_power_field():
    status = normalize_mppsolar_status(
        {
            "voltage_cell01": [3.252, "V"],
            "voltage_cell02": [3.255, "V"],
            "battery_voltage": [26.028, "V"],
            "current_charge": [2.052, "A"],
            "current_discharge": [0, "A"],
            "battery_power": [42633, "W"],
            "percent_remain": [15, "%"],
        },
        cell_count=2,
    )

    assert status.current_a == 2.052
    assert status.power_w == 53.4


def test_normalizer_finds_nested_mppsolar_payload():
    status = normalize_mppsolar_status(
        {
            "result": {
                "command": {
                    "getCellData": {
                        "Cell 1 Voltage": [3.252, "V"],
                        "Cell 2 Voltage": [3.255, "V"],
                        "Pack Voltage": [26.028, "V"],
                        "Battery SOC": [15, "%"],
                    }
                }
            }
        },
        cell_count=2,
    )

    assert status.voltage == 26.028
    assert status.capacity_percent == 15
    assert [cell.voltage for cell in status.cells] == [3.252, 3.255]


def test_normalizer_reports_keys_when_payload_has_no_measurements():
    with pytest.raises(BmsError, match=r"top_level_keys=\['getCellData'\].*payload_keys=\['_command', 'raw_only'\]"):
        normalize_mppsolar_status({
            "getCellData": {
                "_command": ["getCellData", ""],
                "raw_only": ["", ""],
                "raw_response": ["blob", ""],
            }
        })


def test_parse_json_output_reports_invalid_json():
    with pytest.raises(BmsError, match="did not return JSON"):
        parse_json_output("not json")


def test_jkbms_command_timeout_is_human_readable():
    def timeout_runner(*args, **kwargs):
        raise subprocess.TimeoutExpired(args[0], kwargs["timeout"])

    bms = JkbmsCliBms("AA:BB:CC:DD:EE:FF", timeout_seconds=3, command="jkbms", runner=timeout_runner)

    with pytest.raises(BmsError, match="timed out after 3s"):
        bms._run_json_command("getCellData")


def test_jkbms_command_normalizes_json_stdout():
    def runner(*args, **kwargs):
        return subprocess.CompletedProcess(args[0], 0, json.dumps(sample_mppsolar_payload()), "")

    bms = JkbmsCliBms("AA:BB:CC:DD:EE:FF", cell_count=8, command="jkbms", runner=runner)

    assert bms._read_status().capacity_percent == 78


def test_jkbms_status_retries_incomplete_json_output():
    attempts = []

    def runner(*args, **kwargs):
        attempts.append(args[0])
        if len(attempts) == 1:
            return subprocess.CompletedProcess(args[0], 0, json.dumps({"getCellData": {"_command": ["getCellData", ""]}}), "")
        return subprocess.CompletedProcess(args[0], 0, json.dumps(sample_mppsolar_payload()), "")

    bms = JkbmsCliBms("AA:BB:CC:DD:EE:FF", cell_count=8, command="jkbms", retries=1, retry_delay_seconds=0, runner=runner)

    assert bms._read_status().capacity_percent == 78
    assert len(attempts) == 2


def test_jkbms_status_retries_mppsolar_subprocess_crash():
    attempts = []
    traceback = """Traceback (most recent call last):
  File "/tmp/jkbms", line 1, in <module>
TypeError: object of type 'NoneType' has no len()
"""

    def runner(*args, **kwargs):
        attempts.append(args[0])
        if len(attempts) == 1:
            return subprocess.CompletedProcess(args[0], 1, "", traceback)
        return subprocess.CompletedProcess(args[0], 0, json.dumps(sample_mppsolar_payload()), "")

    bms = JkbmsCliBms("AA:BB:CC:DD:EE:FF", cell_count=8, command="jkbms", retries=1, retry_delay_seconds=0, runner=runner)

    assert bms._read_status().capacity_percent == 78
    assert len(attempts) == 2


@pytest.mark.asyncio
async def test_jkbms_ble_status_reuses_persistent_connection():
    frame = sample_jkbms_ble_frame_24s()

    class FakeCharacteristic:
        def __init__(self, properties):
            self.uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            self.properties = properties

    class FakeService:
        uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
        characteristics = [
            FakeCharacteristic(["write-without-response"]),
            FakeCharacteristic(["notify"]),
        ]

    class FakeBleakClient:
        instances = []

        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback
            self.is_connected = False
            self.services = [FakeService()]
            self.connects = 0
            self.writes = []
            self.notify_callback = None
            FakeBleakClient.instances.append(self)

        async def connect(self):
            self.connects += 1
            self.is_connected = True

        async def start_notify(self, characteristic, callback):
            self.notify_callback = callback

        async def stop_notify(self, characteristic):
            self.notify_callback = None

        async def write_gatt_char(self, characteristic, data, response=False):
            self.writes.append(bytes(data))
            if data[4] == 0x96:
                self.notify_callback(characteristic, frame[:90])
                self.notify_callback(characteristic, frame[90:220])
                self.notify_callback(characteristic, frame[220:])

        async def disconnect(self):
            self.is_connected = False

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FakeBleakClient, bootstrap_seconds=0)
    try:
        first = await bms.status()
        second = await bms.status()
    finally:
        await bms.close()

    client = FakeBleakClient.instances[0]
    assert first.capacity_percent == 78
    assert second.capacity_percent == 78
    assert len(FakeBleakClient.instances) == 1
    assert client.connects == 1
    assert [command[4] for command in client.writes] == [0x97, 0x96]


@pytest.mark.asyncio
async def test_jkbms_ble_settings_connects_without_status_bootstrap():
    class FakeCharacteristic:
        def __init__(self, properties):
            self.uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            self.properties = properties

    class FakeService:
        uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
        characteristics = [
            FakeCharacteristic(["write-without-response"]),
            FakeCharacteristic(["notify"]),
        ]

    class FakeBleakClient:
        instances = []

        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback
            self.is_connected = False
            self.services = [FakeService()]
            self.notify_callback = None
            self.writes = []
            FakeBleakClient.instances.append(self)

        async def connect(self):
            self.is_connected = True

        async def start_notify(self, characteristic, callback):
            self.notify_callback = callback

        async def stop_notify(self, characteristic):
            self.notify_callback = None

        async def write_gatt_char(self, characteristic, data, response=False):
            self.writes.append(bytes(data))
            if data[4] == 0x97:
                self.notify_callback(characteristic, sample_jkbms_settings_frame_24s())

        async def disconnect(self):
            self.is_connected = False

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FakeBleakClient, bootstrap_seconds=0)
    try:
        settings = await bms.settings()
    finally:
        await bms.close()

    assert settings.values["max_charge_current"] == 25.0
    assert [command[4] for command in FakeBleakClient.instances[0].writes] == [0x97]


@pytest.mark.asyncio
async def test_jkbms_ble_setting_write_requires_read_back_match():
    class FakeCharacteristic:
        def __init__(self, properties):
            self.uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            self.properties = properties

    class FakeService:
        uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
        characteristics = [
            FakeCharacteristic(["write-without-response"]),
            FakeCharacteristic(["notify"]),
        ]

    class FakeBleakClient:
        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback
            self.is_connected = False
            self.services = [FakeService()]
            self.notify_callback = None
            self.max_charge_current = 25.0
            self.writes = []

        async def connect(self):
            self.is_connected = True

        async def start_notify(self, characteristic, callback):
            self.notify_callback = callback

        async def stop_notify(self, characteristic):
            self.notify_callback = None

        async def write_gatt_char(self, characteristic, data, response=False):
            self.writes.append(bytes(data))
            if data[4] == 0x0C:
                self.max_charge_current = int.from_bytes(data[6:10], "little") / 1000
            if data[4] == 0x97:
                frame = sample_jkbms_settings_frame_24s(max_charge_current=self.max_charge_current)
                self.notify_callback(characteristic, frame[:120])
                self.notify_callback(characteristic, frame[120:])

        async def disconnect(self):
            self.is_connected = False

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FakeBleakClient, bootstrap_seconds=0)
    try:
        result = await bms.apply_setting("max_charge_current", 30.0)
    finally:
        await bms.close()

    assert result.old_value == 25.0
    assert result.new_value == 30.0
    assert result.verified_value == 30.0
    assert result.register == 0x0C


@pytest.mark.asyncio
async def test_jkbms_ble_setting_write_fails_on_read_back_mismatch():
    class FakeCharacteristic:
        def __init__(self, properties):
            self.uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            self.properties = properties

    class FakeService:
        uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
        characteristics = [
            FakeCharacteristic(["write-without-response"]),
            FakeCharacteristic(["notify"]),
        ]

    class FakeBleakClient:
        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback
            self.is_connected = False
            self.services = [FakeService()]
            self.notify_callback = None

        async def connect(self):
            self.is_connected = True

        async def start_notify(self, characteristic, callback):
            self.notify_callback = callback

        async def stop_notify(self, characteristic):
            self.notify_callback = None

        async def write_gatt_char(self, characteristic, data, response=False):
            if data[4] == 0x97:
                self.notify_callback(characteristic, sample_jkbms_settings_frame_24s(max_charge_current=25.0))

        async def disconnect(self):
            self.is_connected = False

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FakeBleakClient, bootstrap_seconds=0)

    with pytest.raises(BmsError, match="read-back mismatch"):
        await bms.apply_setting("max_charge_current", 30.0)

    await bms.close()


@pytest.mark.asyncio
async def test_jkbms_ble_wraps_client_connect_errors_as_bms_errors():
    class FailingBleakClient:
        is_connected = False

        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback

        async def connect(self):
            raise RuntimeError("No Bluetooth adapters found.")

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FailingBleakClient, bootstrap_seconds=0)

    with pytest.raises(BmsError, match="No Bluetooth adapters found"):
        await bms.status()


@pytest.mark.asyncio
async def test_jkbms_ble_debug_scan_runs_before_connect_when_debug_enabled(monkeypatch, caplog):
    class FailingBleakClient:
        is_connected = False

        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback

        async def connect(self):
            raise RuntimeError("Device not found")

    async def fake_scan(timeout):
        assert timeout == 2
        return [{"address": "AA:BB:CC:DD:EE:FF", "name": "JK-BMS", "rssi": -48}]

    monkeypatch.setattr("app.bms.scan_bluetooth_devices", fake_scan)
    caplog.set_level("DEBUG", logger="app.bms")
    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, FailingBleakClient, bootstrap_seconds=0, debug_scan_seconds=2)

    with pytest.raises(BmsError, match="Device not found"):
        await bms.status()

    assert "target_seen=True" in caplog.text


@pytest.mark.asyncio
async def test_jkbms_ble_reports_disconnect_before_status_frame():
    class FakeCharacteristic:
        def __init__(self, properties):
            self.uuid = "0000ffe1-0000-1000-8000-00805f9b34fb"
            self.properties = properties

    class FakeService:
        uuid = "0000ffe0-0000-1000-8000-00805f9b34fb"
        characteristics = [
            FakeCharacteristic(["write-without-response"]),
            FakeCharacteristic(["notify"]),
        ]

    class DisconnectingBleakClient:
        def __init__(self, address, disconnected_callback=None):
            self.address = address
            self.disconnected_callback = disconnected_callback
            self.is_connected = False
            self.services = [FakeService()]
            self.cell_info_writes = 0

        async def connect(self):
            self.is_connected = True

        async def start_notify(self, characteristic, callback):
            return None

        async def write_gatt_char(self, characteristic, data, response=False):
            if data[4] == 0x96:
                self.cell_info_writes += 1
                if self.cell_info_writes == 2:
                    asyncio.get_running_loop().call_soon(self.disconnected_callback, self)

        async def disconnect(self):
            self.is_connected = False

    bms = JkbmsBleBms("AA:BB:CC:DD:EE:FF", "JK-BMS", "JK02", 8, 3, DisconnectingBleakClient, bootstrap_seconds=0)

    with pytest.raises(BmsError, match="disconnected before a status frame"):
        await bms.status()


def test_bms_from_settings_uses_auto_backend_by_default():
    selected = bms_from_settings(SimpleNamespace(
        bms_mode="jkbms",
        bms_bluetooth_address="AA:BB:CC:DD:EE:FF",
        bms_name="JK-BMS",
        bms_protocol="JK02",
        bms_cell_count=8,
        bms_timeout_seconds=25,
        bms_jkbms_backend="auto",
        bms_ble_bootstrap_seconds=1,
        bms_jkbms_command="jkbms",
        bms_retries=1,
        bms_retry_delay_seconds=0,
    ))

    assert isinstance(selected, JkbmsAutoBms)


def test_bms_from_settings_can_force_ble_backend():
    selected = bms_from_settings(SimpleNamespace(
        bms_mode="jkbms",
        bms_bluetooth_address="AA:BB:CC:DD:EE:FF",
        bms_name="JK-BMS",
        bms_protocol="JK02",
        bms_cell_count=8,
        bms_timeout_seconds=25,
        bms_jkbms_backend="ble",
        bms_ble_bootstrap_seconds=1,
    ))

    assert isinstance(selected, JkbmsBleBms)


@pytest.mark.asyncio
async def test_jkbms_auto_falls_back_to_cli_when_ble_adapter_is_unavailable():
    class FailingBle:
        closed = False

        async def status(self):
            raise BmsError("JK-BMS BLE connection failed: No Bluetooth adapters found.")

        async def close(self):
            self.closed = True

    class WorkingCli:
        closed = False

        async def status(self):
            return await SimulatorBms(2).status()

        async def close(self):
            self.closed = True

    ble = FailingBle()
    cli = WorkingCli()
    status = await JkbmsAutoBms(ble, cli).status()

    assert status.connected is True
    assert ble.closed is True
    assert cli.closed is False


@pytest.mark.asyncio
async def test_jkbms_auto_skips_ble_during_retry_cooldown():
    now = 1000.0

    class FailingBle:
        calls = 0

        async def status(self):
            self.calls += 1
            raise BmsError("JK-BMS BLE status timed out after 25s")

        async def close(self):
            return None

    class WorkingCli:
        calls = 0

        async def status(self):
            self.calls += 1
            return await SimulatorBms(2).status()

        async def close(self):
            return None

    ble = FailingBle()
    cli = WorkingCli()
    auto = JkbmsAutoBms(ble, cli, ble_retry_seconds=300, clock=lambda: now)

    await auto.status()
    await auto.status()

    assert ble.calls == 1
    assert cli.calls == 2


@pytest.mark.asyncio
async def test_jkbms_auto_retries_ble_after_retry_cooldown():
    now = 1000.0

    class RecoveringBle:
        calls = 0

        async def status(self):
            self.calls += 1
            if self.calls == 1:
                raise BmsError("JK-BMS BLE status timed out after 25s")
            return await SimulatorBms(2).status()

        async def close(self):
            return None

    class WorkingCli:
        calls = 0

        async def status(self):
            self.calls += 1
            return await SimulatorBms(2).status()

        async def close(self):
            return None

    ble = RecoveringBle()
    cli = WorkingCli()
    auto = JkbmsAutoBms(ble, cli, ble_retry_seconds=300, clock=lambda: now)

    await auto.status()
    now += 301
    await auto.status()

    assert ble.calls == 2
    assert cli.calls == 1
    assert auto.last_ble_failure_at is None


def test_bms_from_settings_can_force_cli_backend():
    selected = bms_from_settings(SimpleNamespace(
        bms_mode="jkbms",
        bms_bluetooth_address="AA:BB:CC:DD:EE:FF",
        bms_name="JK-BMS",
        bms_protocol="JK02",
        bms_cell_count=8,
        bms_timeout_seconds=25,
        bms_jkbms_backend="cli",
        bms_jkbms_command="jkbms",
        bms_retries=1,
        bms_retry_delay_seconds=0,
    ))

    assert isinstance(selected, JkbmsCliBms)


def test_compacts_traceback_to_final_error_line():
    detail = compact_process_detail("""Traceback (most recent call last):
  File "/tmp/jkbms", line 1, in <module>
TypeError: object of type 'NoneType' has no len()
""")

    assert detail == "TypeError: object of type 'NoneType' has no len()"


def test_bms_status_overrides_fresh_battery_values_and_preserves_inverter_values():
    status = {"battery_voltage": 25.4, "battery_charge_current": 3, "battery_discharge_current": 0, "battery_capacity_percent": 64}
    bms = BmsStatus(
        enabled=True,
        connected=True,
        source="simulator",
        captured_at=datetime.now(timezone.utc).isoformat(),
        voltage=26.5,
        current_a=-4.2,
        capacity_percent=79,
        cells=[BmsCell(1, 3.312), BmsCell(2, 3.313)],
    )

    merged = apply_bms_to_status(status, bms, 60)

    assert merged["battery_source"] == "bms"
    assert merged["battery_voltage"] == 26.5
    assert merged["battery_charge_current"] == 0
    assert merged["battery_discharge_current"] == 4.2
    assert merged["battery_capacity_percent"] == 79
    assert merged["inverter_battery_voltage"] == 25.4
    assert merged["bms_cell_01_voltage"] == 3.312


def test_stale_bms_status_keeps_inverter_battery_values():
    stale = datetime.now(timezone.utc) - timedelta(minutes=10)
    bms = BmsStatus(enabled=True, connected=True, source="simulator", captured_at=stale.isoformat(), voltage=26.5, capacity_percent=79)

    merged = apply_bms_to_status({"battery_voltage": 25.4, "battery_capacity_percent": 64}, bms, 60)

    assert merged["battery_source"] == "inverter"
    assert merged["battery_voltage"] == 25.4
    assert "inverter_battery_voltage" not in merged


@pytest.mark.asyncio
async def test_scan_uses_advertisement_rssi_without_touching_deprecated_device_rssi(monkeypatch):
    class Device:
        address = "AA:BB:CC:DD:EE:FF"
        name = None

        @property
        def rssi(self):
            raise AssertionError("deprecated BLEDevice.rssi should not be accessed")

    class FakeScanner:
        @staticmethod
        async def discover(*, timeout, return_adv=False):
            assert timeout == 2
            assert return_adv is True
            advertisement = SimpleNamespace(rssi=-51, local_name="JK-BMS")
            return {"AA:BB:CC:DD:EE:FF": (Device(), advertisement)}

    monkeypatch.setitem(sys.modules, "bleak", SimpleNamespace(BleakScanner=FakeScanner))

    assert await scan_bluetooth_devices(2) == [{"address": "AA:BB:CC:DD:EE:FF", "name": "JK-BMS", "rssi": -51}]
