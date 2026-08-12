"""Voltronic/PIP USB-HID framing and parsers used by Sako-compatible inverters."""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


def crc16_xmodem(payload: bytes) -> int:
    crc = 0
    for byte in payload:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def frame(command: str) -> bytes:
    payload = command.encode("ascii")
    crc = crc16_xmodem(payload).to_bytes(2, "big")
    # PIP requires reserved checksum bytes to be altered before transmission.
    crc = bytes(byte + 1 if byte in (0x28, 0x0D, 0x0A) else byte for byte in crc)
    return payload + crc + b"\r"


def response_payload(reply: bytes, *, allow_unchecksummed_rating: bool = False) -> str:
    if len(reply) < 4 or not reply.endswith(b"\r"):
        raise ValueError("truncated inverter response")
    data, received_crc = reply[:-3], reply[-3:-1]
    expected = crc16_xmodem(data).to_bytes(2, "big")
    expected = bytes(byte + 1 if byte in (0x28, 0x0D, 0x0A) else byte for byte in expected)
    if received_crc != expected:
        # Some PIP-compatible firmware omits the CRC only from QPIRI.  Accept
        # that read-only rating response only when it has the expected
        # parenthesized, multi-field structure; all other replies stay strict.
        unchecksummed = reply[:-1]
        fields = unchecksummed.lstrip(b"(").split()
        if allow_unchecksummed_rating and unchecksummed.startswith(b"(") and len(fields) >= 18:
            return unchecksummed.decode("ascii", errors="replace").lstrip("(")
        raise ValueError("inverter response checksum mismatch")
    return data.decode("ascii", errors="replace").lstrip("(")


@dataclass
class LiveStatus:
    grid_voltage: float | None = None
    grid_frequency: float | None = None
    output_voltage: float | None = None
    output_frequency: float | None = None
    output_apparent_power_va: int | None = None
    output_active_power_w: int | None = None
    load_percent: int | None = None
    bus_voltage: int | None = None
    battery_voltage: float | None = None
    battery_charge_current: int | None = None
    battery_capacity_percent: int | None = None
    inverter_temperature_c: float | int | None = None
    pv_input_current: float | None = None
    pv_input_voltage: float | None = None
    battery_discharge_current: int | None = None
    status_bits: str | None = None
    status_flags: list[dict[str, Any]] | None = None


def _number(fields: list[str], index: int, kind: type) -> Any:
    try:
        return kind(fields[index])
    except (ValueError, IndexError):
        return None


def _temperature(fields: list[str], index: int) -> float | int | None:
    """Parse PIP temperature fields, including four-digit deci-degree values."""
    try:
        raw = fields[index]
        temperature = int(raw)
        # Some 24 V PIP variants return, for example, 0490 for 49.0 C.
        return temperature / 10 if len(raw.lstrip("+-")) >= 4 else temperature
    except (ValueError, IndexError):
        return None


STATUS_BIT_DEFINITIONS = (
    ("sbu_priority_version_added", "SBU-priority capability", "This firmware supports the SBU-priority feature."),
    ("configuration_changed", "Configuration changed", "The inverter reports that its configuration has changed."),
    ("scc_firmware_updated", "SCC firmware updated", "The solar charge controller firmware is marked as updated."),
    ("load_on", "Load output on", "The inverter AC output is supplying the connected load."),
    ("battery_voltage_steady_while_charging", "Battery voltage steady", "Battery voltage has reached its steady state while charging."),
    ("charging_on", "Charging enabled", "The inverter charging function is enabled."),
    ("scc_charging_on", "Solar charging enabled", "Solar/SCC charging is enabled."),
    ("ac_charging_on", "Utility charging enabled", "AC/utility charging is enabled."),
)


def decode_status_bits(bits: str | None) -> list[dict[str, Any]]:
    """Decode the eight documented PI30-style QPIGS state flags.

    The bit meanings are firmware-specific; unsupported or malformed values are
    returned as an empty list while preserving the raw value in ``status_bits``.
    """
    if not bits or len(bits) != len(STATUS_BIT_DEFINITIONS) or set(bits) - {"0", "1"}:
        return []
    return [
        {"position": position, "key": key, "label": label, "description": description, "active": bit == "1"}
        for position, (bit, (key, label, description)) in enumerate(zip(bits, STATUS_BIT_DEFINITIONS), start=1)
    ]


def parse_qpigs(payload: str) -> LiveStatus:
    fields = payload.split()
    status_bits = fields[16] if len(fields) > 16 else None
    return LiveStatus(
        grid_voltage=_number(fields, 0, float), grid_frequency=_number(fields, 1, float),
        output_voltage=_number(fields, 2, float), output_frequency=_number(fields, 3, float),
        output_apparent_power_va=_number(fields, 4, int), output_active_power_w=_number(fields, 5, int),
        load_percent=_number(fields, 6, int), bus_voltage=_number(fields, 7, int),
        battery_voltage=_number(fields, 8, float), battery_charge_current=_number(fields, 9, int),
        battery_capacity_percent=_number(fields, 10, int), inverter_temperature_c=_temperature(fields, 11),
        pv_input_current=_number(fields, 12, float), pv_input_voltage=_number(fields, 13, float),
        battery_discharge_current=_number(fields, 15, int), status_bits=status_bits,
        status_flags=decode_status_bits(status_bits),
    )


def status_dict(payload: str) -> dict[str, Any]:
    return asdict(parse_qpigs(payload))


def parse_rating(payload: str) -> dict[str, Any]:
    fields = payload.split()
    keys = ["grid_rating_voltage", "grid_rating_current", "output_rating_voltage", "output_rating_frequency",
            "output_rating_current", "output_rating_apparent_power_va", "output_rating_active_power_w",
            "battery_rating_voltage", "battery_recharge_voltage", "battery_under_voltage",
            "battery_bulk_voltage", "battery_float_voltage", "battery_type", "max_ac_charge_current",
            "max_charge_current", "input_voltage_range", "output_source_priority", "charger_source_priority"]
    return {key: fields[index] for index, key in enumerate(keys) if index < len(fields)}
