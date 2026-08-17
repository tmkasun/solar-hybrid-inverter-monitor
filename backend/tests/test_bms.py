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
    JkbmsCliBms,
    apply_bms_to_status,
    bms_history_metrics,
    compact_process_detail,
    normalize_mppsolar_status,
    parse_json_output,
    scan_bluetooth_devices,
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
