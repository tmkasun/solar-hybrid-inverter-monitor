"""Decode PI30 QPIWS alarms; positions are zero-based, left to right.

Source: FlinSlim PWM & MPPT RS232 Communication Protocol, section 2.9.
https://flinenergy.com/wp-content/uploads/2025/03/RS232-Protocol-for-FlinSlim-PWM-and-MPPT-Solar-Inverters.pdf
Keep the raw reply: Sako firmware variants may use different layouts.
"""
from __future__ import annotations

from typing import Any


# severity 'conditional' follows the inverter fault bit (a1).
PI30_ALARMS = {
    1: ("inverter_fault", "Inverter fault", "fault"),
    2: ("bus_over", "DC bus voltage too high", "fault"),
    3: ("bus_under", "DC bus voltage too low", "fault"),
    4: ("bus_soft_fail", "DC bus soft start failed", "fault"),
    5: ("line_fail", "Utility supply unavailable", "warning"),
    6: ("output_short", "AC output short circuit", "warning"),
    7: ("output_voltage_low", "Inverter voltage too low", "fault"),
    8: ("output_voltage_high", "Inverter voltage too high", "fault"),
    9: ("over_temperature", "Over temperature", "conditional"),
    10: ("fan_locked", "Fan locked", "conditional"),
    11: ("battery_voltage_high", "Battery voltage too high", "conditional"),
    12: ("battery_low", "Low battery alarm", "warning"),
    14: ("battery_shutdown", "Battery under-voltage shutdown", "warning"),
    16: ("overload", "Overload", "conditional"),
    17: ("eeprom_fault", "EEPROM fault", "warning"),
    18: ("over_current", "Inverter over current", "fault"),
    19: ("inverter_soft_fail", "Inverter soft start failed", "fault"),
    20: ("self_test_fail", "Self test failed", "fault"),
    21: ("output_dc_voltage_high", "Output DC voltage too high", "fault"),
    22: ("battery_open", "Battery disconnected", "fault"),
    23: ("current_sensor_fail", "Current sensor failed", "fault"),
    24: ("battery_short", "Battery short circuit", "fault"),
    25: ("power_limit", "Power limit active", "warning"),
    26: ("pv_voltage_high", "PV voltage too high", "warning"),
    27: ("mppt_overload_fault", "MPPT overload fault", "warning"),
    28: ("mppt_overload_warning", "MPPT overload warning", "warning"),
    29: ("battery_low_to_charge", "Battery too low to charge", "warning"),
}


def decode_alarms(
    raw: str | None, mode: str | None, protocol_id: str = "PI30", *, error: str | None = None
) -> dict[str, Any]:
    binary_reply = isinstance(raw, str) and len(raw) == 32 and not (set(raw) - {"0", "1"})
    available = protocol_id == "PI30" and binary_reply and error is None
    active: list[dict[str, Any]] = []
    if available:
        for position, bit in enumerate(raw):
            if bit != "1":
                continue
            key, label, severity = PI30_ALARMS.get(
                position, (f"unknown_bit_{position}", f"Unmapped inverter alarm (bit {position})", "warning")
            )
            if severity == "conditional":
                severity = "fault" if raw[1] == "1" or mode == "F" else "warning"
            active.append({"position": position, "key": key, "label": label, "severity": severity})
    elif error is None:
        error = "Alarm details unavailable: unsupported protocol or unexpected QPIWS response"
    if not available and binary_reply:
        active.extend(
            {"position": position, "key": f"unknown_bit_{position}",
             "label": f"Unmapped inverter alarm (bit {position})", "severity": "warning"}
            for position, bit in enumerate(raw) if bit == "1"
        )
    if mode == "F" and not any(alarm["key"] == "inverter_fault" for alarm in active):
        active.insert(0, {"position": None, "key": "fault_mode", "label": "Inverter is in fault mode", "severity": "fault"})
    severity = (
        "fault" if any(alarm["severity"] == "fault" for alarm in active)
        else "warning" if active else "ok" if available else "unknown"
    )
    return {"available": available, "severity": severity, "active": active, "error": error,
            "mapping": "pi30_standard" if available else None}


def retain_confirmed_alarms(snapshot: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    """Keep last confirmed details separate from an unavailable current reading."""
    previous = previous or {}
    alarms = dict(snapshot.get("alarms") or decode_alarms(None, snapshot.get("mode")))
    if snapshot.get("connected") and alarms["available"]:
        alarms["last_confirmed_active"] = list(alarms["active"])
        alarms["last_confirmed_at"] = alarms.get("captured_at") or snapshot.get("captured_at")
    else:
        alarms["last_confirmed_active"] = list(previous.get("last_confirmed_active", []))
        alarms["last_confirmed_at"] = previous.get("last_confirmed_at")
    return {**snapshot, "alarms": alarms}


def alarm_event_data(snapshot: dict[str, Any], protocol_id: str | None) -> dict[str, Any]:
    return {
        "connected": snapshot["connected"], "mode": snapshot.get("mode"),
        "warnings": snapshot.get("warnings"), "protocol_id": protocol_id,
        "alarms": snapshot["alarms"], "error": snapshot.get("error"),
    }


def alarm_signature(data: dict[str, Any]) -> tuple:
    """Ignore measurement time, mode-only changes and varying transport errors."""
    alarms = data["alarms"]
    reported = alarms["active"] if data["connected"] else []
    flags = lambda items: tuple(sorted((item["key"], item["severity"]) for item in items))
    return (bool(data["connected"] and alarms["available"]), flags(reported),
            flags(alarms["last_confirmed_active"]), data.get("protocol_id"))
