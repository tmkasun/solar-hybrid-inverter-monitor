"""Command-line helper for discovering and reading JK-BMS Bluetooth telemetry."""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from typing import Any, Sequence

from .bms import BmsError, JkbmsCliBms, scan_bluetooth_devices
from .config import settings

logger = logging.getLogger(__name__)


def _print_json(value: Any) -> None:
    print(json.dumps(value, indent=2, sort_keys=True, default=str))


def _print_status(status: dict[str, Any]) -> None:
    print(f"Captured: {status.get('captured_at') or '-'}")
    print(f"BMS: {status.get('name') or '-'} {status.get('address') or ''} ({status.get('protocol') or '-'})")
    print(f"Connected: {status.get('connected')}")
    if status.get("error"):
        print(f"Error: {status['error']}")
    for label, key, unit in (
        ("SOC", "capacity_percent", "%"),
        ("Voltage", "voltage", " V"),
        ("Current", "current_a", " A"),
        ("Power", "power_w", " W"),
        ("Cell delta", "delta_cell_voltage", " V"),
        ("MOS temp", "mos_temperature_c", " C"),
    ):
        value = status.get(key)
        print(f"{label:14} {value if value is not None else '-'}{unit if value is not None else ''}")
    cells = status.get("cells") or []
    if cells:
        print("Cells")
        for cell in cells:
            print(f"  {cell['index']:02d}: {cell['voltage']:.3f} V")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Discover and read read-only JK-BMS Bluetooth telemetry.")
    parser.add_argument("--verbose", action="store_true", help="show detailed logs on stderr")
    subcommands = parser.add_subparsers(dest="operation", required=True)

    scan = subcommands.add_parser("scan", help="scan nearby Bluetooth LE devices")
    scan.add_argument("--timeout", type=float, default=8, help="scan seconds (default: 8)")
    scan.add_argument("--json", action="store_true", help="print JSON")

    status = subcommands.add_parser("status", help="read one BMS status snapshot")
    add_bms_args(status)
    status.add_argument("--json", action="store_true", help="print JSON")

    info = subcommands.add_parser("info", help="read BMS identity information")
    add_bms_args(info)
    info.add_argument("--json", action="store_true", help="print JSON")

    monitor = subcommands.add_parser("monitor", help="continuously print BMS status")
    add_bms_args(monitor)
    monitor.add_argument("--interval", type=float, default=settings.bms_poll_seconds, help="seconds between readings")
    monitor.add_argument("--count", type=int, help="number of readings, then exit")
    monitor.add_argument("--json", action="store_true", help="print each reading as JSON")
    return parser


def add_bms_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--address", default=settings.bms_bluetooth_address, help="BMS Bluetooth MAC address")
    parser.add_argument("--name", default=settings.bms_name, help="BMS display/model name")
    parser.add_argument("--protocol", default=settings.bms_protocol, help="JK-BMS protocol (default: JK02)")
    parser.add_argument("--cell-count", type=int, default=settings.bms_cell_count, help="expected cell count")
    parser.add_argument("--timeout", type=float, default=settings.bms_timeout_seconds, help="command timeout seconds")
    parser.add_argument("--command", default=settings.bms_jkbms_command, help="path to the jkbms executable")


async def execute(args: argparse.Namespace) -> int:
    if args.operation == "scan":
        devices = await scan_bluetooth_devices(args.timeout)
        if args.json:
            _print_json({"devices": devices})
        else:
            for device in devices:
                print(f"{device['address']:18} {device.get('name') or '(unknown)'}")
        return 0

    if args.operation == "monitor":
        if args.interval <= 0:
            raise BmsError("--interval must be greater than zero")
        if args.count is not None and args.count <= 0:
            raise BmsError("--count must be greater than zero")

    bms = JkbmsCliBms(args.address, args.name, args.protocol, args.cell_count, args.timeout, args.command)
    try:
        if args.operation == "info":
            info = await bms.info()
            _print_json(info) if args.json else print(json.dumps(info, indent=2, sort_keys=True, default=str))
            return 0
        readings = 0
        while args.operation == "monitor" and (args.count is None or readings < args.count):
            status = (await bms.status()).to_dict()
            _print_json(status) if args.json else _print_status(status)
            readings += 1
            if args.count is None or readings < args.count:
                await asyncio.sleep(args.interval)
        if args.operation == "status":
            status = (await bms.status()).to_dict()
            _print_json(status) if args.json else _print_status(status)
    finally:
        await bms.close()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.CRITICAL + 1,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s", force=True)
    try:
        return asyncio.run(execute(args))
    except (BmsError, ValueError) as exc:
        logger.exception("BMS CLI command failed")
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
