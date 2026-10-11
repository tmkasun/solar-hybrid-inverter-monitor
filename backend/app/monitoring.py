"""Shared read-only snapshot for API and CLI monitoring."""
from datetime import datetime, timezone
from typing import Any

from .alarms import decode_alarms
from .driver import BaseInverter, InverterError
from .protocol import status_dict


async def read_snapshot(inverter: BaseInverter, protocol_id: str = "PI30") -> dict[str, Any]:
    qpigs = await inverter.command("QPIGS")
    mode = await inverter.command("QMOD")
    rejected = {command: reply for command, reply in {"QPIGS": qpigs, "QMOD": mode}.items() if reply in ("NAK", "(NAK")}
    if rejected:
        raise InverterError(f"inverter rejected monitoring command(s): {rejected}")
    status = status_dict(qpigs)
    if not any(isinstance(value, (int, float)) for value in status.values()):
        raise InverterError(f"unexpected QPIGS response: {qpigs!r}")
    # An unsupported warning query must not hide usable telemetry or fault mode.
    warning_error = None
    warnings = None
    try:
        warnings = await inverter.command("QPIWS")
        if warnings in ("NAK", "(NAK"):
            warning_error = "Inverter rejected QPIWS alarm query"
    except (InverterError, ValueError) as exc:
        warning_error = str(exc)
    captured = datetime.now(timezone.utc).isoformat()
    return {
        "captured_at": captured, "connected": True, "mode": mode, "status": status,
        "warnings": warnings, "error": None,
        "alarms": {**decode_alarms(warnings, mode, protocol_id, error=warning_error), "captured_at": captured},
    }
