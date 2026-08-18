"""Read-only JK-BMS telemetry helpers.

The API prefers a persistent BLE connection for hardware polling and keeps the
older mpp-solar ``jkbms`` command path available as a fallback backend. The
rest of the app only sees a normalized, stable BMS status shape.
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
JK_BMS_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb"
JK_BMS_CHARACTERISTIC_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb"
JK_BMS_FRAME_HEADER = b"\x55\xaa\xeb\x90"
JK_BMS_COMMAND_HEADER = b"\xaa\x55\x90\xeb"
JK_BMS_CELL_INFO_COMMAND = 0x96
JK_BMS_DEVICE_INFO_COMMAND = 0x97
JK_BMS_MIN_FRAME_SIZE = 300
JK_BMS_MAX_FRAME_SIZE = 400


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


class JkbmsBleBms(BaseBms):
    def __init__(self, address: str, name: str = "", protocol: str = "JK02", cell_count: int = 8,
                 timeout_seconds: float = 25, client_factory: Callable[..., Any] | None = None,
                 bootstrap_seconds: float = 1):
        self.address = address.strip()
        self.name = name.strip()
        self.protocol = protocol.strip() or "JK02"
        self.cell_count = cell_count
        self.timeout_seconds = timeout_seconds
        self.bootstrap_seconds = max(0, bootstrap_seconds)
        self.client_factory = client_factory
        self.client: Any | None = None
        self.notify_char: Any | None = None
        self.write_char: Any | None = None
        self.frame_buffer = bytearray()
        self.latest_status: BmsStatus | None = None
        self.latest_status_monotonic = 0.0
        self.status_version = 0
        self.connected = False
        self.disconnect_error: str | None = None
        self._lock = asyncio.Lock()
        self._status_event = asyncio.Event()

    async def status(self) -> BmsStatus:
        if not self.address:
            raise BmsError("BMS_BLUETOOTH_ADDRESS is required for BMS_MODE=jkbms")
        try:
            async with self._lock:
                logger.debug(
                    "JK-BMS BLE status requested: address=%s protocol=%s cell_count=%s cached=%s connected=%s",
                    self.address,
                    self.protocol,
                    self.cell_count,
                    bool(self.latest_status),
                    self._client_is_connected(),
                )
                await self._ensure_connected()
                now = time.monotonic()
                if self.latest_status and now - self.latest_status_monotonic <= self.timeout_seconds:
                    logger.debug(
                        "Returning cached JK-BMS BLE status: age=%.1fs version=%d",
                        now - self.latest_status_monotonic,
                        self.status_version,
                    )
                    return self.latest_status
                starting_version = self.status_version
                logger.debug("Requesting fresh JK-BMS BLE status: starting_version=%d", starting_version)
                await self._request_cell_info()
            try:
                await asyncio.wait_for(self._wait_for_new_status(starting_version), timeout=self.timeout_seconds)
            except asyncio.TimeoutError as exc:
                await self._disconnect()
                raise BmsError(f"JK-BMS BLE status timed out after {self.timeout_seconds:g}s") from exc
        except BmsError:
            raise
        except Exception as exc:
            await self._disconnect()
            raise BmsError(f"JK-BMS BLE read failed: {exc}") from exc
        assert self.latest_status is not None
        return self.latest_status

    async def close(self) -> None:
        await self._disconnect()

    async def _wait_for_new_status(self, starting_version: int) -> None:
        while self.status_version <= starting_version:
            if self.disconnect_error:
                raise BmsError(self.disconnect_error)
            self._status_event.clear()
            if self.disconnect_error:
                raise BmsError(self.disconnect_error)
            await self._status_event.wait()
        if self.disconnect_error and self.status_version <= starting_version:
            raise BmsError(self.disconnect_error)

    async def _ensure_connected(self) -> None:
        if self._client_is_connected():
            return
        await self._disconnect()
        try:
            client = self._new_client()
            self.client = client
            started_at = time.monotonic()
            logger.info("Connecting to JK-BMS BLE device %s", self.address)
            await asyncio.wait_for(client.connect(), timeout=self.timeout_seconds)
            if not self._client_is_connected(client):
                raise BmsError(f"failed to connect to JK-BMS BLE device {self.address}")
            self.connected = True
            self.disconnect_error = None
            logger.debug("JK-BMS BLE connect completed in %.2fs", time.monotonic() - started_at)
            self.write_char, self.notify_char = await self._characteristics(client)
            await client.start_notify(self.notify_char, self._notification)
            logger.info("JK-BMS BLE connected; requesting device and cell info")
            await self._write_command(JK_BMS_DEVICE_INFO_COMMAND)
            if self.bootstrap_seconds:
                logger.debug("Waiting %.1fs after JK-BMS device-info request before cell-info request", self.bootstrap_seconds)
                await asyncio.sleep(self.bootstrap_seconds)
            await self._write_command(JK_BMS_CELL_INFO_COMMAND)
        except BmsError:
            await self._disconnect()
            raise
        except Exception as exc:
            await self._disconnect()
            raise BmsError(f"JK-BMS BLE connection failed: {exc}") from exc

    def _new_client(self) -> Any:
        if self.client_factory is not None:
            return self.client_factory(self.address, disconnected_callback=self._on_disconnect)
        try:
            from bleak import BleakClient
        except ModuleNotFoundError as exc:
            raise BmsError("bleak is not installed; run scripts/pi-api-install to install mppsolar[ble]") from exc
        return BleakClient(self.address, disconnected_callback=self._on_disconnect)

    async def _characteristics(self, client: Any) -> tuple[Any, Any]:
        services = getattr(client, "services", None)
        if callable(getattr(client, "get_services", None)):
            services = await client.get_services()

        characteristics: list[Any] = []
        for service in services or []:
            service_uuid = str(getattr(service, "uuid", "")).lower()
            service_characteristics = getattr(service, "characteristics", []) or []
            logger.debug(
                "JK-BMS BLE service discovered: uuid=%s characteristic_count=%d",
                service_uuid,
                len(service_characteristics),
            )
            for characteristic in service_characteristics:
                logger.debug(
                    "JK-BMS BLE characteristic discovered: service=%s uuid=%s properties=%s handle=%s",
                    service_uuid,
                    getattr(characteristic, "uuid", ""),
                    list(getattr(characteristic, "properties", []) or []),
                    getattr(characteristic, "handle", None),
                )
            if service_uuid not in (JK_BMS_SERVICE_UUID, "ffe0", "0xffe0"):
                continue
            characteristics.extend(service_characteristics)
        if not characteristics and services is not None:
            for service in services:
                characteristics.extend(getattr(service, "characteristics", []) or [])

        ffe1 = [char for char in characteristics if _uuid_matches(getattr(char, "uuid", ""), JK_BMS_CHARACTERISTIC_UUID)]
        write_char = next((char for char in ffe1 if _char_supports(char, "write-without-response")), None)
        write_char = write_char or next((char for char in ffe1 if _char_supports(char, "write")), None)
        notify_char = next((char for char in ffe1 if _char_supports(char, "notify")), None)
        if not write_char:
            write_char = JK_BMS_CHARACTERISTIC_UUID
        if not notify_char:
            notify_char = JK_BMS_CHARACTERISTIC_UUID
        logger.debug(
            "JK-BMS BLE characteristic selection: write=%s notify=%s",
            _characteristic_description(write_char),
            _characteristic_description(notify_char),
        )
        return write_char, notify_char

    async def _request_cell_info(self) -> None:
        await self._write_command(JK_BMS_CELL_INFO_COMMAND)

    async def _write_command(self, command: int) -> None:
        if self.client is None or self.write_char is None:
            raise BmsError("JK-BMS BLE client is not connected")
        payload = build_jkbms_command(command)
        logger.debug(
            "Writing JK-BMS BLE command: command=0x%02x characteristic=%s payload=%s",
            command,
            _characteristic_description(self.write_char),
            payload.hex(),
        )
        await self.client.write_gatt_char(self.write_char, payload, response=False)

    def _notification(self, _: Any, data: bytearray | bytes | memoryview) -> None:
        chunk = bytes(data)
        logger.debug(
            "JK-BMS BLE notification received: chunk_len=%d prefix=%s buffer_before=%d",
            len(chunk),
            chunk[:16].hex(" "),
            len(self.frame_buffer),
        )
        try:
            status = self._accept_notification(chunk)
        except BmsError as exc:
            logger.warning("Dropped invalid JK-BMS BLE frame: %s", exc)
            return
        if status is not None:
            self.latest_status = status
            self.latest_status_monotonic = time.monotonic()
            self.status_version += 1
            logger.info(
                "JK-BMS BLE status frame accepted: version=%d voltage=%s current=%s soc=%s cells=%d layout=%s",
                self.status_version,
                status.voltage,
                status.current_a,
                status.capacity_percent,
                len(status.cells),
                status.raw_summary.get("layout"),
            )
            self._status_event.set()

    def _accept_notification(self, data: bytes) -> BmsStatus | None:
        if not data:
            return None
        combined = bytes(self.frame_buffer) + data
        header_at = combined.rfind(JK_BMS_FRAME_HEADER)
        if header_at != -1:
            if header_at:
                logger.debug("Discarding %d byte(s) before JK-BMS BLE frame header", header_at)
            combined = combined[header_at:]
        elif not self.frame_buffer:
            logger.debug("Ignoring JK-BMS BLE notification without frame header: len=%d prefix=%s", len(data), data[:16].hex(" "))
            return None
        if len(combined) > JK_BMS_MAX_FRAME_SIZE:
            self.frame_buffer.clear()
            raise BmsError("frame exceeded maximum BLE response size")
        self.frame_buffer = bytearray(combined)
        logger.debug("JK-BMS BLE frame buffer updated: len=%d", len(self.frame_buffer))
        if len(self.frame_buffer) < JK_BMS_MIN_FRAME_SIZE:
            return None
        frame = bytes(self.frame_buffer[:JK_BMS_MIN_FRAME_SIZE])
        self.frame_buffer.clear()
        frame_type = frame[4]
        if frame_type != 0x02:
            logger.debug("Ignoring JK-BMS BLE frame type 0x%02x", frame_type)
            return None
        logger.debug("Parsing JK-BMS BLE cell-info frame: len=%d crc=0x%02x", len(frame), frame[-1])
        return parse_jkbms_ble_cell_info(
            frame,
            address=self.address,
            name=self.name,
            protocol=self.protocol,
            cell_count=self.cell_count,
        )

    async def _disconnect(self) -> None:
        client = self.client
        notify_char = self.notify_char
        self.client = None
        self.notify_char = None
        self.write_char = None
        self.frame_buffer.clear()
        self.connected = False
        self.disconnect_error = None
        if client is None:
            return
        try:
            if notify_char is not None and self._client_is_connected(client):
                await client.stop_notify(notify_char)
        except Exception:
            logger.debug("Failed to stop JK-BMS BLE notifications", exc_info=True)
        try:
            if self._client_is_connected(client):
                await client.disconnect()
        except Exception:
            logger.debug("Failed to disconnect JK-BMS BLE client", exc_info=True)

    def _client_is_connected(self, client: Any | None = None) -> bool:
        client = client if client is not None else self.client
        if client is None:
            return False
        connected = getattr(client, "is_connected", False)
        return connected() if callable(connected) else bool(connected)

    def _on_disconnect(self, _: Any) -> None:
        logger.warning(
            "JK-BMS BLE device disconnected: buffered_bytes=%d status_version=%d had_status=%s",
            len(self.frame_buffer),
            self.status_version,
            bool(self.latest_status),
        )
        self.connected = False
        self.client = None
        self.notify_char = None
        self.write_char = None
        self.frame_buffer.clear()
        self.disconnect_error = "JK-BMS BLE device disconnected before a status frame was received"
        self._status_event.set()


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


class JkbmsAutoBms(BaseBms):
    def __init__(self, ble: JkbmsBleBms, cli: JkbmsCliBms, ble_retry_seconds: float = 300,
                 clock: Callable[[], float] = time.monotonic):
        self.ble = ble
        self.cli = cli
        self.ble_retry_seconds = max(0, ble_retry_seconds)
        self.clock = clock
        self.last_ble_failure_at: float | None = None

    async def status(self) -> BmsStatus:
        if self._ble_in_cooldown():
            logger.debug(
                "Using JK-BMS CLI backend while persistent BLE is in retry cooldown: remaining=%.1fs",
                self._ble_cooldown_remaining(),
            )
            return await self.cli.status()
        try:
            status = await self.ble.status()
            self.last_ble_failure_at = None
            return status
        except BmsError as exc:
            self.last_ble_failure_at = self.clock()
            logger.warning(
                "Persistent JK-BMS BLE read failed; falling back to jkbms CLI for %.0fs: %s",
                self.ble_retry_seconds,
                exc,
            )
            await self.ble.close()
            return await self.cli.status()

    async def close(self) -> None:
        await self.ble.close()
        await self.cli.close()

    def _ble_in_cooldown(self) -> bool:
        return (
            self.last_ble_failure_at is not None
            and self.clock() - self.last_ble_failure_at < self.ble_retry_seconds
        )

    def _ble_cooldown_remaining(self) -> float:
        if self.last_ble_failure_at is None:
            return 0.0
        return max(0.0, self.ble_retry_seconds - (self.clock() - self.last_ble_failure_at))


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


def build_jkbms_command(command: int) -> bytes:
    frame = bytearray(20)
    frame[:4] = JK_BMS_COMMAND_HEADER
    frame[4] = command & 0xFF
    frame[19] = jkbms_crc(frame[:19])
    return bytes(frame)


def jkbms_crc(data: bytes | bytearray | memoryview) -> int:
    return sum(data) & 0xFF


def parse_jkbms_ble_cell_info(frame: bytes, *, address: str = "", name: str = "", protocol: str = "JK02",
                              cell_count: int = 8) -> BmsStatus:
    validate_jkbms_ble_frame(frame)
    preferred_layout = "32s" if "32" in protocol.lower() or cell_count > 24 else "24s"
    candidates = [
        _parse_jk02_layout(frame, preferred_layout, address, name, protocol, cell_count),
        _parse_jk02_layout(frame, "24s" if preferred_layout == "32s" else "32s", address, name, protocol, cell_count),
    ]
    logger.debug(
        "JK-BMS BLE parsed layout candidates: preferred=%s summaries=%s",
        preferred_layout,
        [
            {
                "layout": status.raw_summary.get("layout"),
                "voltage": status.voltage,
                "current": status.current_a,
                "soc": status.capacity_percent,
                "cells": len(status.cells),
                "plausible": _plausible_jkbms_status(status),
            }
            for status in candidates
        ],
    )
    plausible = [status for status in candidates if _plausible_jkbms_status(status)]
    if plausible:
        return plausible[0]
    if candidates[0].cells or candidates[0].voltage is not None or candidates[0].capacity_percent is not None:
        return candidates[0]
    raise BmsError("JK-BMS BLE frame did not contain recognized cell or battery data")


def validate_jkbms_ble_frame(frame: bytes) -> None:
    if len(frame) < JK_BMS_MIN_FRAME_SIZE:
        raise BmsError(f"frame was shorter than {JK_BMS_MIN_FRAME_SIZE} bytes")
    frame = frame[:JK_BMS_MIN_FRAME_SIZE]
    if not frame.startswith(JK_BMS_FRAME_HEADER):
        raise BmsError("frame did not start with JK-BMS header")
    computed_crc = jkbms_crc(frame[:JK_BMS_MIN_FRAME_SIZE - 1])
    if frame[JK_BMS_MIN_FRAME_SIZE - 1] != computed_crc:
        raise BmsError(f"CRC check failed: 0x{computed_crc:02x} != 0x{frame[JK_BMS_MIN_FRAME_SIZE - 1]:02x}")


def _parse_jk02_layout(frame: bytes, layout: str, address: str, name: str, protocol: str, cell_count: int) -> BmsStatus:
    if layout == "32s":
        voltage_start = 6
        resistance_start = 80
        mos_temperature_at = 144
        pack_voltage_at = 150
        current_at = 158
        battery_t1_at = 162
        battery_t2_at = 164
        balance_current_at = 170
        capacity_percent_at = 173
        remaining_capacity_at = 174
        nominal_capacity_at = 178
        cycle_count_at = 182
        cycle_capacity_at = 186
        max_cells = 32
    else:
        voltage_start = 6
        resistance_start = 64
        pack_voltage_at = 118
        current_at = 126
        battery_t1_at = 130
        battery_t2_at = 132
        mos_temperature_at = 134
        balance_current_at = 138
        capacity_percent_at = 141
        remaining_capacity_at = 142
        nominal_capacity_at = 146
        cycle_count_at = 150
        cycle_capacity_at = 154
        max_cells = 24

    cells: list[BmsCell] = []
    for index in range(1, min(max(1, cell_count), max_cells) + 1):
        voltage = _u16(frame, voltage_start + (index - 1) * 2) * 0.001
        resistance_mohm = _u16(frame, resistance_start + (index - 1) * 2) * 0.001
        if 0 < voltage < 6:
            cells.append(BmsCell(
                index=index,
                voltage=round(voltage, 4),
                resistance_mohm=_round(resistance_mohm, 4),
                wire_resistance_mohm=_round(resistance_mohm, 4),
            ))

    current_a = _i32(frame, current_at) * 0.001
    voltage = _u32(frame, pack_voltage_at) * 0.001
    balance_current_a = _i16(frame, balance_current_at) * 0.001
    return _status_from_values(
        source="jkbms-ble",
        connected=True,
        address=address or None,
        name=name or None,
        protocol=protocol,
        cell_count=cell_count,
        cells=cells,
        voltage=voltage,
        current_a=current_a,
        capacity_percent=frame[capacity_percent_at],
        remaining_capacity_ah=_u32(frame, remaining_capacity_at) * 0.001,
        nominal_capacity_ah=_u32(frame, nominal_capacity_at) * 0.001,
        cycle_count=_u32(frame, cycle_count_at),
        cycle_capacity_ah=_u32(frame, cycle_capacity_at) * 0.001,
        balance_current_a=balance_current_a,
        battery_t1_c=_i16(frame, battery_t1_at) * 0.1,
        battery_t2_c=_i16(frame, battery_t2_at) * 0.1,
        mos_temperature_c=_i16(frame, mos_temperature_at) * 0.1,
        raw_summary={
            "protocol": "JK02 BLE",
            "layout": layout,
            "frame_type": frame[4],
            "frame_counter": frame[5],
        },
    )


def _plausible_jkbms_status(status: BmsStatus) -> bool:
    if status.capacity_percent is not None and not 0 <= status.capacity_percent <= 100:
        return False
    if status.voltage is not None and not 1 <= status.voltage <= 200:
        return False
    if status.current_a is not None and abs(status.current_a) > 500:
        return False
    if status.cells:
        summed = sum(cell.voltage for cell in status.cells)
        if status.voltage is not None and summed > 1 and abs(status.voltage - summed) > max(3.0, summed * 0.25):
            return False
    return bool(status.cells or status.voltage is not None or status.capacity_percent is not None)


def _u16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset:offset + 2], "little", signed=False)


def _i16(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset:offset + 2], "little", signed=True)


def _u32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset:offset + 4], "little", signed=False)


def _i32(data: bytes, offset: int) -> int:
    return int.from_bytes(data[offset:offset + 4], "little", signed=True)


def _uuid_matches(uuid: Any, expected: str) -> bool:
    value = str(uuid).lower()
    short = expected[4:8]
    return value in (expected, short, f"0x{short}") or value.replace("-", "").endswith(expected.replace("-", "")[:8])


def _char_supports(characteristic: Any, property_name: str) -> bool:
    return property_name in {str(value).lower() for value in getattr(characteristic, "properties", []) or []}


def _characteristic_description(characteristic: Any) -> str:
    if isinstance(characteristic, str):
        return characteristic
    return "uuid=%s handle=%s props=%s" % (
        getattr(characteristic, "uuid", ""),
        getattr(characteristic, "handle", None),
        list(getattr(characteristic, "properties", []) or []),
    )


def bms_from_settings(settings: Any) -> BaseBms:
    mode = settings.bms_mode.lower()
    if mode == "simulator":
        return SimulatorBms(settings.bms_cell_count)
    if mode == "jkbms":
        backend = getattr(settings, "bms_jkbms_backend", "auto").lower()
        if backend == "cli":
            return _jkbms_cli_from_settings(settings)
        if backend == "ble":
            return _jkbms_ble_from_settings(settings)
        return JkbmsAutoBms(
            _jkbms_ble_from_settings(settings),
            _jkbms_cli_from_settings(settings),
            getattr(settings, "bms_ble_retry_seconds", 300),
        )
    return DisabledBms()


def _jkbms_ble_from_settings(settings: Any) -> JkbmsBleBms:
    return JkbmsBleBms(
        settings.bms_bluetooth_address,
        settings.bms_name,
        settings.bms_protocol,
        settings.bms_cell_count,
        settings.bms_timeout_seconds,
        bootstrap_seconds=getattr(settings, "bms_ble_bootstrap_seconds", 1),
    )


def _jkbms_cli_from_settings(settings: Any) -> JkbmsCliBms:
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
