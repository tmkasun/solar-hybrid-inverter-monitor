"""Command-line monitoring and safe control for a Sako-compatible inverter.

Run from the repository root with ``./scripts/inverter-cli --help`` or from the
``backend`` directory with ``python -m app.cli --help``.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Sequence

from .capabilities import CAPABILITIES, command_for
from .config import settings
from .driver import BaseInverter, InverterError, SimulatorInverter, UsbHidInverter
from .protocol import parse_rating, status_dict

logger = logging.getLogger(__name__)


def _integer(value: str) -> int:
    return int(value, 0)


def _inverter(args: argparse.Namespace) -> BaseInverter:
    if args.mode == "simulator":
        return SimulatorInverter()
    return UsbHidInverter(args.vendor_id, args.product_id)


def _print_json(value: Any) -> None:
    print(json.dumps(value, indent=2, sort_keys=True, default=str))


def _print_fields(values: dict[str, Any]) -> None:
    for key, value in values.items():
        print(f"{key.replace('_', ' '):30} {value if value is not None else '-'}")


async def _read_status(inverter: BaseInverter) -> dict[str, Any]:
    qpigs, mode, warnings = await asyncio.gather(
        inverter.command("QPIGS"), inverter.command("QMOD"), inverter.command("QPIWS")
    )
    replies = {"QPIGS": qpigs, "QMOD": mode, "QPIWS": warnings}
    rejected = {command: reply for command, reply in replies.items() if reply in ("NAK", "(NAK")}
    if rejected:
        raise InverterError(f"inverter rejected monitoring command(s): {rejected}")
    status = status_dict(qpigs)
    if all(value is None for value in status.values()):
        raise InverterError(f"unexpected QPIGS response: {qpigs!r}")
    return {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "connected": True,
        "mode": mode,
        "status": status,
        "warnings": warnings,
    }


async def _require_pip_protocol(inverter: BaseInverter) -> None:
    """Confirm PIP support before issuing any status or setting command.

    USB ID 0665:5161 is shared by devices that use a different UPS protocol.
    QPI is the non-mutating PIP identification query; a PIP inverter replies
    with a PI-prefixed protocol version, such as PI30.
    """
    try:
        protocol = await inverter.command("QPI")
    except InverterError as exc:
        logger.exception("PIP protocol probe failed")
        raise InverterError(f"could not verify PIP protocol with QPI; no status or setting command was sent: {exc}") from exc
    if not protocol.startswith("PI"):
        logger.error("PIP protocol probe rejected device response: %r", protocol)
        raise InverterError(
            f"device does not identify as a PIP inverter (QPI returned {protocol!r}); "
            "no status or setting command was sent"
        )


def _show_status(snapshot: dict[str, Any], as_json: bool) -> None:
    if as_json:
        _print_json(snapshot)
        return
    print(f"Captured: {snapshot['captured_at']}")
    print(f"Inverter mode: {snapshot['mode']}")
    print(f"Warnings: {snapshot['warnings']}")
    _print_fields(snapshot["status"])


async def _show_info(inverter: BaseInverter, as_json: bool) -> None:
    commands = ("QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG")
    replies = {command: await inverter.command(command) for command in commands}
    rejected = {command: reply for command, reply in replies.items() if reply in ("NAK", "(NAK")}
    if rejected:
        raise InverterError(f"inverter rejected information command(s): {rejected}")
    replies["rating"] = parse_rating(replies["QPIRI"])
    if as_json:
        _print_json(replies)
        return
    for command in commands:
        print(f"{command:6} {replies[command]}")
    print("\nRated configuration")
    _print_fields(replies["rating"])


async def _set_value(inverter: BaseInverter, key: str, value: str, as_json: bool) -> None:
    command = command_for(key, value)
    if command is None:
        allowed = ", ".join(choice.value for capability in CAPABILITIES if capability.key == key for choice in capability.choices)
        raise InverterError(f"unsupported value {value!r} for {key}; choose one of: {allowed}")
    # QPIRI is the PIP configuration query used by the web API to establish
    # that this inverter exposes the supported priority controls.
    if await inverter.command("QPIRI") == "NAK":
        raise InverterError("inverter does not support the required PIP configuration query")
    reply = await inverter.command(command)
    if reply != "ACK":
        raise InverterError(f"inverter rejected {command}: {reply}")
    result = {"ok": True, "setting": key, "value": value, "command": command, "reply": reply}
    if as_json:
        _print_json(result)
    else:
        print(f"Applied {key}={value} ({command}): {reply}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Monitor and safely control a Sako-compatible PIP inverter.")
    parser.add_argument("--mode", choices=("simulator", "hardware"), default=settings.mode,
                        help="transport to use (default: INVERTER_MODE or %(default)s)")
    parser.add_argument("--vendor-id", type=_integer, default=settings.vendor_id,
                        help="USB vendor ID for hardware mode (default: 0x%(default)04x)")
    parser.add_argument("--product-id", type=_integer, default=settings.product_id,
                        help="USB product ID for hardware mode (default: 0x%(default)04x)")
    parser.add_argument("--verbose", action="store_true", help="show detailed transport logs on stderr")
    subcommands = parser.add_subparsers(dest="operation", required=True)

    status = subcommands.add_parser("status", help="read one live status snapshot")
    status.add_argument("--json", action="store_true", help="print JSON")

    monitor = subcommands.add_parser("monitor", help="continuously print live status")
    monitor.add_argument("--interval", type=float, default=5, help="seconds between readings (default: 5)")
    monitor.add_argument("--count", type=int, help="number of readings, then exit")
    monitor.add_argument("--json", action="store_true", help="print each reading as JSON")

    info = subcommands.add_parser("info", help="read inverter identity and rated configuration")
    info.add_argument("--json", action="store_true", help="print JSON")

    setting_help = "; ".join(
        f"{capability.key}: {', '.join(choice.value for choice in capability.choices)}"
        for capability in CAPABILITIES
    )
    change = subcommands.add_parser("set", help=f"apply a supported setting ({setting_help})")
    change.add_argument("key", choices=[capability.key for capability in CAPABILITIES])
    change.add_argument("value")
    change.add_argument("--yes", action="store_true", help="confirm this power-setting change")
    change.add_argument("--json", action="store_true", help="print JSON")
    return parser


async def execute(args: argparse.Namespace) -> int:
    if args.operation == "monitor":
        if args.interval <= 0:
            raise InverterError("--interval must be greater than zero")
        if args.count is not None and args.count <= 0:
            raise InverterError("--count must be greater than zero")
    if args.operation == "set" and not args.yes:
        raise InverterError("refusing to change a power setting without --yes")

    inverter = _inverter(args)
    try:
        logger.info("Starting %s in %s mode", args.operation, args.mode)
        await _require_pip_protocol(inverter)
        if args.operation == "status":
            _show_status(await _read_status(inverter), args.json)
        elif args.operation == "info":
            await _show_info(inverter, args.json)
        elif args.operation == "set":
            await _set_value(inverter, args.key, args.value, args.json)
        else:
            readings = 0
            while args.count is None or readings < args.count:
                try:
                    _show_status(await _read_status(inverter), args.json)
                except (InverterError, ValueError) as exc:
                    logger.exception("Monitor reading %d failed", readings + 1)
                    print(f"error: {exc}", file=sys.stderr)
                readings += 1
                if args.count is None or readings < args.count:
                    await asyncio.sleep(args.interval)
    finally:
        await inverter.close()
        logger.info("Finished %s", args.operation)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        return asyncio.run(execute(args))
    except (InverterError, ValueError) as exc:
        logger.exception("CLI command failed")
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        logger.info("CLI interrupted by user")
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
