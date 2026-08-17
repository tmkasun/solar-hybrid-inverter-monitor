"""Read-only JK-BMS telemetry helpers.

The first hardware implementation deliberately shells out to the mpp-solar
``jkbms`` command because that is the known-good path for this battery pack.
The rest of the app only sees a normalized, stable BMS status shape.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

Runner = Callable[..., subprocess.CompletedProcess[str]]


class BmsError(RuntimeError):
    pass


@dataclass(frozen=True)
class BmsCell:
    index: int
    voltage: float
    resistance_mohm: float | None = None
    wire_resistance_mohm: float | None = None


@dataclass(frozen=True)
class BmsStatus:
    enabled: bool
    connected: bool
    source: str
    address: str | None = None
    name: str | None = None
    protocol: str | None = None
    captured_at: str | None = None
    error: str | None = None
    stale: bool = False
    last_error: str | None = None
    last_error_at: str | None = None
    cell_count: int | None = None
    cells: list[BmsCell] = field(default_factory=list)
    min_cell_voltage: float | None = None
    max_cell_voltage: float | None = None
    delta_cell_voltage: float | None = None
    voltage: float | None = None
    current_a: float | None = None
    power_w: float | None = None
    capacity_percent: float | None = None
    remaining_capacity_ah: float | None = None
    nominal_capacity_ah: float | None = None
    cycle_count: int | None = None
    cycle_capacity_ah: float | None = None
    balance_current_a: float | None = None
    battery_t1_c: float | None = None
    battery_t2_c: float | None = None
    mos_temperature_c: float | None = None
    raw_summary: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def disabled(cls) -> "BmsStatus":
        return cls(enabled=False, connected=False, source="disabled")

    @classmethod
    def failed(cls, source: str, error: str, *, address: str | None = None,
               name: str | None = None, protocol: str | None = None) -> "BmsStatus":
        return cls(
            enabled=source != "disabled",
            connected=False,
            source=source,
            address=address or None,
            name=name or None,
            protocol=protocol or None,
            captured_at=utc_now(),
            error=error,
            last_error=error,
            last_error_at=utc_now(),
        )

    def with_poll_error(self, error: str) -> "BmsStatus":
        return replace(self, stale=True, error=None, last_error=error, last_error_at=utc_now())

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def is_fresh(self, max_age_seconds: float) -> bool:
        if not self.connected or not self.captured_at:
            return False
        try:
            captured_at = datetime.fromisoformat(self.captured_at)
        except ValueError:
            return False
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)
        age = datetime.now(timezone.utc) - captured_at.astimezone(timezone.utc)
        return age.total_seconds() <= max_age_seconds


class BaseBms:
    async def status(self) -> BmsStatus:
        raise NotImplementedError

    async def close(self) -> None:
        return None


class DisabledBms(BaseBms):
    async def status(self) -> BmsStatus:
        return BmsStatus.disabled()


class SimulatorBms(BaseBms):
    def __init__(self, cell_count: int = 8):
        self.cell_count = max(1, cell_count)

    async def status(self) -> BmsStatus:
        cells = [
            BmsCell(
                index=index,
                voltage=round(3.328 + (index % 3) * 0.003, 3),
                resistance_mohm=round(0.42 + (index % 4) * 0.015, 3),
                wire_resistance_mohm=round(0.42 + (index % 4) * 0.015, 3),
            )
            for index in range(1, self.cell_count + 1)
        ]
        return _status_from_values(
            source="simulator",
            connected=True,
            address="simulated",
            name="JK-BMS simulator",
            protocol="JK02",
            cell_count=self.cell_count,
            cells=cells,
            voltage=round(sum(cell.voltage for cell in cells), 3),
            current_a=-7.4,
            capacity_percent=82,
            remaining_capacity_ah=98.4,
            nominal_capacity_ah=120,
            cycle_count=48,
            cycle_capacity_ah=3120,
            balance_current_a=0,
            battery_t1_c=28.4,
            battery_t2_c=28.7,
            mos_temperature_c=31.2,
            raw_summary={"fixture": "simulator"},
        )


class JkbmsCliBms(BaseBms):
    def __init__(self, address: str, name: str = "", protocol: str = "JK02", cell_count: int = 8,
                 timeout_seconds: float = 25, command: str = "", retries: int = 1,
                 retry_delay_seconds: float = 2, runner: Runner = subprocess.run):
        self.address = address.strip()
        self.name = name.strip()
        self.protocol = protocol.strip() or "JK02"
        self.cell_count = cell_count
        self.timeout_seconds = timeout_seconds
        self.command = command.strip() or default_jkbms_command()
        self.retries = max(0, retries)
        self.retry_delay_seconds = max(0, retry_delay_seconds)
        self.runner = runner

    async def status(self) -> BmsStatus:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._read_status)

    async def info(self) -> dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._run_json_command, "getInfo")

    async def raw(self, bms_command: str = "getCellData") -> dict[str, Any]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._run_json_command, bms_command)

    def _read_status(self) -> BmsStatus:
        last_error: BmsError | None = None
        for attempt in range(self.retries + 1):
            try:
                data = self._run_json_command("getCellData")
                return normalize_mppsolar_status(
                    data,
                    address=self.address,
                    name=self.name,
                    protocol=self.protocol,
                    cell_count=self.cell_count,
                )
            except BmsError as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
                logger.warning("JK-BMS read attempt %d/%d failed: %s", attempt + 1, self.retries + 1, exc)
                time.sleep(self.retry_delay_seconds)
        assert last_error is not None
        if self.retries:
            raise BmsError(f"JK-BMS read failed after {self.retries + 1} attempts: {last_error}") from last_error
        raise last_error

    def _run_json_command(self, bms_command: str) -> dict[str, Any]:
        if not self.address:
            raise BmsError("BMS_BLUETOOTH_ADDRESS is required for BMS_MODE=jkbms")
        command = [self.command, "-p", self.address, "-P", self.protocol, "-c", bms_command, "-o", "json"]
        if self.name:
            command[3:3] = ["-n", self.name]
        logger.debug("Running JK-BMS command: %s", " ".join(command))
        try:
            completed = self.runner(command, capture_output=True, text=True, timeout=self.timeout_seconds, check=False)
        except FileNotFoundError as exc:
            raise BmsError(f"jkbms command was not found at {self.command!r}; run scripts/pi-api-install") from exc
        except subprocess.TimeoutExpired as exc:
            raise BmsError(f"jkbms {bms_command} timed out after {self.timeout_seconds:g}s") from exc
        if completed.returncode != 0:
            detail = compact_process_detail(completed.stderr or completed.stdout)
            raise BmsError(f"jkbms {bms_command} failed with exit code {completed.returncode}: {detail}")
        return parse_json_output(completed.stdout)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_jkbms_command() -> str:
    sibling = Path(sys.executable).with_name("jkbms")
    if sibling.exists():
        return str(sibling)
    return shutil.which("jkbms") or "jkbms"


def compact_process_detail(output: str | None) -> str:
    lines = [line.strip() for line in (output or "").splitlines() if line.strip()]
    if not lines:
        return "no output"
    return next((line for line in reversed(lines) if line.startswith(("TypeError:", "ValueError:", "RuntimeError:", "Exception:"))), lines[-1])


def bms_from_settings(settings: Any) -> BaseBms:
    mode = settings.bms_mode.lower()
    if mode == "simulator":
        return SimulatorBms(settings.bms_cell_count)
    if mode == "jkbms":
        return JkbmsCliBms(
            settings.bms_bluetooth_address,
            settings.bms_name,
            settings.bms_protocol,
            settings.bms_cell_count,
            settings.bms_timeout_seconds,
            settings.bms_jkbms_command,
            settings.bms_retries,
            settings.bms_retry_delay_seconds,
        )
    return DisabledBms()


async def scan_bluetooth_devices(timeout_seconds: float = 8) -> list[dict[str, Any]]:
    try:
        from bleak import BleakScanner
    except ModuleNotFoundError as exc:
        raise BmsError("bleak is not installed; run scripts/pi-api-install to install mppsolar[ble]") from exc
    try:
        discovered = await BleakScanner.discover(timeout=timeout_seconds, return_adv=True)
    except TypeError:
        devices = await BleakScanner.discover(timeout=timeout_seconds)
        return [_bluetooth_device_record(device, include_device_rssi=True) for device in devices]
    return [
        _bluetooth_device_record(device, advertisement)
        for device, advertisement in discovered.values()
    ]


def _bluetooth_device_record(device: Any, advertisement: Any | None = None, *, include_device_rssi: bool = False) -> dict[str, Any]:
    rssi = getattr(advertisement, "rssi", None)
    if rssi is None and include_device_rssi:
        rssi = getattr(device, "rssi", None)
    return {
        "address": device.address,
        "name": device.name or getattr(advertisement, "local_name", None) or "",
        "rssi": rssi,
    }


def parse_json_output(output: str) -> dict[str, Any]:
    text = output.strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise BmsError("jkbms did not return JSON output")
        try:
            value = json.loads(text[start:end + 1])
        except json.JSONDecodeError as exc:
            raise BmsError(f"jkbms returned invalid JSON: {exc}") from exc
    if isinstance(value, list):
        value = next((item for item in value if isinstance(item, dict)), None)
    if not isinstance(value, dict):
        raise BmsError("jkbms JSON output was not an object")
    return value


def normalize_mppsolar_status(data: dict[str, Any], *, address: str = "", name: str = "", protocol: str = "JK02",
                              cell_count: int = 8, captured_at: str | None = None) -> BmsStatus:
    payload = _find_measurement_payload(data)
    cells: list[BmsCell] = []
    for index in range(1, max(1, cell_count) + 1):
        voltage = _number(payload, *_cell_voltage_names(index))
        wire_resistance_mohm = _cell_wire_resistance_mohm(payload, index)
        if voltage is not None and voltage > 0:
            cells.append(BmsCell(
                index=index,
                voltage=round(voltage, 4),
                resistance_mohm=_round(wire_resistance_mohm, 4),
                wire_resistance_mohm=_round(wire_resistance_mohm, 4),
            ))

    voltage = _number(payload, "Battery_Voltage", "Pack_Voltage", "Total_Voltage", "BatteryVoltage", "PackVoltage",
                      "TotalVoltage", "Voltage")
    if voltage is None and cells:
        voltage = sum(cell.voltage for cell in cells)
    current_a = _signed_current(payload)
    power_w = voltage * current_a if voltage is not None and current_a is not None else _number(payload, "Battery_Power", "Power")

    min_cell = _number(payload, "Minimum_Cell_Voltage", "Min_Cell_Voltage")
    max_cell = _number(payload, "Maximum_Cell_Voltage", "Max_Cell_Voltage")
    if cells:
        min_cell = min_cell if min_cell is not None else min(cell.voltage for cell in cells)
        max_cell = max_cell if max_cell is not None else max(cell.voltage for cell in cells)
    delta_cell = _number(payload, "Delta_Cell_Voltage", "Cell_Voltage_Delta")
    if delta_cell is None and min_cell is not None and max_cell is not None:
        delta_cell = max_cell - min_cell

    status = _status_from_values(
        source="mppsolar",
        connected=True,
        address=address or None,
        name=name or None,
        protocol=protocol,
        cell_count=cell_count,
        cells=cells,
        min_cell_voltage=min_cell,
        max_cell_voltage=max_cell,
        delta_cell_voltage=delta_cell,
        voltage=voltage,
        current_a=current_a,
        power_w=power_w,
        capacity_percent=_number(payload, "Percent_Remain", "Battery_Capacity", "State_Of_Charge", "SOC",
                                 "SOC_Percent", "Battery_SOC", "Charge_Percent"),
        remaining_capacity_ah=_number(payload, "Capacity_Remain", "Remaining_Capacity", "RemainingCapacity"),
        nominal_capacity_ah=_number(payload, "Nominal_Capacity", "Battery_Nominal_Capacity", "NominalCapacity"),
        cycle_count=_integer(payload, "Cycle_Count", "Cycles"),
        cycle_capacity_ah=_number(payload, "Cycle_Capacity"),
        balance_current_a=_number(payload, "Balance_Current", "Current_Balancer"),
        battery_t1_c=_number(payload, "Battery_T1", "Battery_Temperature_1", "Temperature_Cell01"),
        battery_t2_c=_number(payload, "Battery_T2", "Battery_Temperature_2", "Temperature_Cell02"),
        mos_temperature_c=_number(payload, "MOS_Temp", "MOS_Temperature"),
        captured_at=captured_at,
        raw_summary=raw_summary(payload),
    )
    if not cells and all(value is None for value in (status.voltage, status.current_a, status.capacity_percent)):
        raise BmsError(f"jkbms output did not contain recognized cell or battery data; {raw_key_summary(data, payload)}")
    return status


def _status_from_values(*, source: str, connected: bool, address: str | None = None, name: str | None = None,
                        protocol: str | None = None, cell_count: int | None = None, cells: list[BmsCell] | None = None,
                        min_cell_voltage: float | None = None, max_cell_voltage: float | None = None,
                        delta_cell_voltage: float | None = None, voltage: float | None = None,
                        current_a: float | None = None, power_w: float | None = None,
                        capacity_percent: float | None = None, remaining_capacity_ah: float | None = None,
                        nominal_capacity_ah: float | None = None, cycle_count: int | None = None,
                        cycle_capacity_ah: float | None = None, balance_current_a: float | None = None,
                        battery_t1_c: float | None = None, battery_t2_c: float | None = None,
                        mos_temperature_c: float | None = None, captured_at: str | None = None,
                        raw_summary: dict[str, Any] | None = None) -> BmsStatus:
    cells = cells or []
    if cells:
        min_cell_voltage = min_cell_voltage if min_cell_voltage is not None else min(cell.voltage for cell in cells)
        max_cell_voltage = max_cell_voltage if max_cell_voltage is not None else max(cell.voltage for cell in cells)
    if delta_cell_voltage is None and min_cell_voltage is not None and max_cell_voltage is not None:
        delta_cell_voltage = max_cell_voltage - min_cell_voltage
    if power_w is None and voltage is not None and current_a is not None:
        power_w = voltage * current_a
    return BmsStatus(
        enabled=True,
        connected=connected,
        source=source,
        address=address,
        name=name,
        protocol=protocol,
        captured_at=captured_at or utc_now(),
        cell_count=cell_count or len(cells) or None,
        cells=cells,
        min_cell_voltage=_round(min_cell_voltage, 4),
        max_cell_voltage=_round(max_cell_voltage, 4),
        delta_cell_voltage=_round(delta_cell_voltage, 4),
        voltage=_round(voltage, 3),
        current_a=_round(current_a, 3),
        power_w=_round(power_w, 1),
        capacity_percent=_round(capacity_percent, 1),
        remaining_capacity_ah=_round(remaining_capacity_ah, 3),
        nominal_capacity_ah=_round(nominal_capacity_ah, 3),
        cycle_count=cycle_count,
        cycle_capacity_ah=_round(cycle_capacity_ah, 3),
        balance_current_a=_round(balance_current_a, 3),
        battery_t1_c=_round(battery_t1_c, 1),
        battery_t2_c=_round(battery_t2_c, 1),
        mos_temperature_c=_round(mos_temperature_c, 1),
        raw_summary=raw_summary or {},
    )


def apply_bms_to_status(status: dict[str, Any], bms_status: BmsStatus, fresh_window_seconds: float) -> dict[str, Any]:
    merged = dict(status)
    metrics = bms_history_metrics(bms_status) if bms_status.is_fresh(fresh_window_seconds) else {}
    merged.update(metrics)
    if metrics:
        _override_battery_value(merged, "battery_voltage", bms_status.voltage)
        _override_battery_value(merged, "battery_capacity_percent", bms_status.capacity_percent)
        if bms_status.current_a is not None:
            _preserve_inverter_value(merged, "battery_charge_current")
            _preserve_inverter_value(merged, "battery_discharge_current")
            if bms_status.current_a >= 0:
                merged["battery_charge_current"] = bms_status.current_a
                merged["battery_discharge_current"] = 0
            else:
                merged["battery_charge_current"] = 0
                merged["battery_discharge_current"] = abs(bms_status.current_a)
        merged["battery_source"] = "bms"
    else:
        merged["battery_source"] = "inverter"
    return merged


def bms_history_metrics(status: BmsStatus) -> dict[str, Any]:
    if not status.connected:
        return {}
    fields = {
        "bms_battery_voltage": status.voltage,
        "bms_current_a": status.current_a,
        "bms_power_w": status.power_w,
        "bms_capacity_percent": status.capacity_percent,
        "bms_min_cell_voltage": status.min_cell_voltage,
        "bms_max_cell_voltage": status.max_cell_voltage,
        "bms_delta_cell_voltage": status.delta_cell_voltage,
        "bms_remaining_capacity_ah": status.remaining_capacity_ah,
        "bms_nominal_capacity_ah": status.nominal_capacity_ah,
        "bms_cycle_count": status.cycle_count,
        "bms_cycle_capacity_ah": status.cycle_capacity_ah,
        "bms_balance_current_a": status.balance_current_a,
        "bms_battery_t1_c": status.battery_t1_c,
        "bms_battery_t2_c": status.battery_t2_c,
        "bms_mos_temperature_c": status.mos_temperature_c,
    }
    metrics = {key: value for key, value in fields.items() if value is not None}
    for cell in status.cells:
        metrics[f"bms_cell_{cell.index:02d}_voltage"] = cell.voltage
        wire_resistance = cell.wire_resistance_mohm if cell.wire_resistance_mohm is not None else cell.resistance_mohm
        if wire_resistance is not None:
            metrics[f"bms_cell_{cell.index:02d}_resistance_mohm"] = wire_resistance
            metrics[f"bms_cell_{cell.index:02d}_wire_resistance_mohm"] = wire_resistance
    return metrics


def raw_summary(payload: dict[str, Any]) -> dict[str, Any]:
    keys = [str(key) for key in payload if str(key) != "raw_response"]
    return {
        "command": _plain_value(payload.get("_command")),
        "command_description": _plain_value(payload.get("_command_description")),
        "keys": sorted(keys)[:80],
    }


def raw_key_summary(data: dict[str, Any], payload: dict[str, Any] | None = None) -> str:
    top_level_keys = _safe_key_list(data)
    if payload is data or payload is None:
        return f"keys={top_level_keys}"
    return f"top_level_keys={top_level_keys}; payload_keys={_safe_key_list(payload)}"


def _safe_key_list(data: dict[str, Any], limit: int = 30) -> list[str]:
    return sorted(str(key) for key in data if str(key) != "raw_response")[:limit]


def _find_measurement_payload(data: dict[str, Any]) -> dict[str, Any]:
    return _find_measurement_payload_recursive(data) or _find_command_payload_recursive(data) or data


def _find_measurement_payload_recursive(data: dict[str, Any]) -> dict[str, Any] | None:
    if _contains_measurements(data):
        return data
    for value in data.values():
        if isinstance(value, dict):
            payload = _find_measurement_payload_recursive(value)
            if payload is not None:
                return payload
    return None


def _find_command_payload_recursive(data: dict[str, Any]) -> dict[str, Any] | None:
    if "_command" in data or "raw_response" in data:
        return data
    dict_values = [value for value in data.values() if isinstance(value, dict)]
    if len(dict_values) == 1:
        return _find_command_payload_recursive(dict_values[0]) or dict_values[0]
    for value in dict_values:
        payload = _find_command_payload_recursive(value)
        if payload is not None:
            return payload
    return None


def _contains_measurements(data: dict[str, Any]) -> bool:
    normalized = {_normalized_key(key) for key in data}
    return bool(normalized & {
        "batteryvoltage",
        "packvoltage",
        "totalvoltage",
        "percentremain",
        "batterysoc",
        "soc",
        "stateofcharge",
        "voltagecell01",
        "voltagecell1",
        "cell01voltage",
        "cell1voltage",
        "cellvoltage01",
        "cellvoltage1",
        "currentcharge",
        "chargecurrent",
        "currentdischarge",
        "dischargecurrent",
        "batterycurrent",
        "packcurrent",
    })


def _cell_voltage_names(index: int) -> tuple[str, ...]:
    return (
        f"Voltage_Cell{index:02d}",
        f"Voltage_Cell{index}",
        f"VoltageCell{index:02d}",
        f"VoltageCell{index}",
        f"Cell{index:02d}_Voltage",
        f"Cell{index}_Voltage",
        f"Cell{index:02d}Voltage",
        f"Cell{index}Voltage",
        f"CellVoltage{index:02d}",
        f"CellVoltage{index}",
        f"cell_{index:02d}_voltage",
        f"cell_{index}_voltage",
        f"cell_voltage_{index:02d}",
        f"cell_voltage_{index}",
    )


def _number(data: dict[str, Any], *names: str) -> float | None:
    value = _lookup(data, *names)
    value = _plain_value(value)
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _integer(data: dict[str, Any], *names: str) -> int | None:
    value = _number(data, *names)
    return int(value) if value is not None else None


def _signed_current(data: dict[str, Any]) -> float | None:
    current = _number(data, "Battery_Current", "Current", "Pack_Current")
    if current is not None:
        return current
    charge = _number(data, "Current_Charge", "Charge_Current", "Charging_Current") or 0
    discharge = _number(data, "Current_Discharge", "Discharge_Current", "Discharging_Current") or 0
    if charge == 0 and discharge == 0:
        return None
    return charge - discharge


def _cell_wire_resistance_mohm(data: dict[str, Any], index: int) -> float | None:
    value = _lookup(
        data,
        f"WireRes_Cell{index:02d}",
        f"Wire_Res_Cell{index:02d}",
        f"WireResCell{index:02d}",
        f"WireResistance_Cell{index:02d}",
        f"Wire_Resistance_Cell{index:02d}",
        f"Cell{index:02d}_WireRes",
        f"Cell{index:02d}_Wire_Res",
        f"Cell{index:02d}_Wire_Resistance",
        f"Resistance_Cell{index:02d}",
        f"Cell{index:02d}_Resistance",
        f"cell_{index:02d}_resistance",
        f"Cell_Resistance{index:02d}",
        f"Cell{index:02d}_Internal_Resistance",
        f"Internal_Resistance_Cell{index:02d}",
    )
    amount, unit = _measurement_amount_and_unit(value)
    if amount is None:
        return None
    unit_key = _normalized_key(unit or "")
    unit_text = str(unit or "").strip().lower()
    if unit_text in {"Ω", "Ω"}:
        return amount * 1000
    if unit_key in {"ohm", "omega"}:
        return amount * 1000
    if unit_text.startswith(("uΩ", "uΩ", "µΩ", "µΩ")):
        return amount / 1000
    if unit_key.startswith(("uohm", "microohm")):
        return amount / 1000
    return amount


def _lookup(data: dict[str, Any], *names: str) -> Any:
    by_key = {_normalized_key(key): value for key, value in data.items()}
    for name in names:
        value = by_key.get(_normalized_key(name))
        if value is not None:
            return value
    return None


def _measurement_amount_and_unit(value: Any) -> tuple[float | None, str | None]:
    unit: str | None = None
    raw = value
    if isinstance(value, (list, tuple)):
        raw = value[0] if value else None
        unit = str(value[1]) if len(value) > 1 and value[1] is not None else None
    elif isinstance(value, dict):
        unit_value = value.get("unit") or value.get("Unit") or value.get("units") or value.get("Units")
        unit = str(unit_value) if unit_value is not None else None
        raw = _plain_value(value)
    else:
        raw = _plain_value(value)
    if raw is None or raw == "":
        return None, unit
    try:
        return float(raw), unit
    except (TypeError, ValueError):
        return None, unit


def _plain_value(value: Any) -> Any:
    if isinstance(value, (list, tuple)):
        return value[0] if value else None
    if isinstance(value, dict):
        for key in ("value", "Value", "raw", "Raw"):
            if key in value:
                return _plain_value(value[key])
    return value


def _normalized_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _round(value: float | None, digits: int) -> float | None:
    return round(value, digits) if value is not None else None


def _override_battery_value(status: dict[str, Any], key: str, value: Any) -> None:
    if value is None:
        return
    _preserve_inverter_value(status, key)
    status[key] = value


def _preserve_inverter_value(status: dict[str, Any], key: str) -> None:
    if key in status and f"inverter_{key}" not in status:
        status[f"inverter_{key}"] = status[key]
