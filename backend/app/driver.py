"""Exclusive inverter drivers: real pyUSB HID and deterministic laptop simulator."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Final

from .protocol import frame, response_payload


class InverterError(RuntimeError):
    pass


class BaseInverter(ABC):
    @abstractmethod
    async def command(self, command: str) -> str: ...

    @abstractmethod
    async def close(self) -> None: ...


class UsbHidInverter(BaseInverter):
    """pyUSB interrupt transport. All calls are guarded to prevent frame interleaving."""
    interface: Final = 0
    endpoint_out: Final = 0x01
    endpoint_in: Final = 0x81

    def __init__(self, vendor_id: int, product_id: int):
        self.vendor_id, self.product_id = vendor_id, product_id
        self.device = None
        self.lock = asyncio.Lock()

    def _connect(self) -> None:
        import usb.core
        self.device = usb.core.find(idVendor=self.vendor_id, idProduct=self.product_id)
        if self.device is None:
            raise InverterError(f"USB inverter {self.vendor_id:04x}:{self.product_id:04x} not found")
        try:
            if self.device.is_kernel_driver_active(self.interface):
                self.device.detach_kernel_driver(self.interface)
        except (NotImplementedError, AttributeError):
            pass
        try:
            self.device.set_configuration()
        except Exception:
            pass

    def _send(self, command: str) -> str:
        if self.device is None:
            self._connect()
        try:
            self.device.write(self.endpoint_out, frame(command), timeout=2500)
            chunks: list[bytes] = []
            for _ in range(8):
                chunk = bytes(self.device.read(self.endpoint_in, 64, timeout=2500))
                chunks.append(chunk)
                if b"\r" in chunk:
                    break
            return response_payload(b"".join(chunks).split(b"\r", 1)[0] + b"\r")
        except Exception as exc:
            self.device = None
            raise InverterError(f"USB command {command} failed: {exc}") from exc

    async def command(self, command: str) -> str:
        async with self.lock:
            return await asyncio.to_thread(self._send, command)

    async def close(self) -> None:
        self.device = None


class SimulatorInverter(BaseInverter):
    """PIP-shaped fixture responses for laptop/API/browser testing without live hardware."""
    def __init__(self):
        self.lock = asyncio.Lock()
        self.output_priority = "01"
        self.charger_priority = "01"
        self.fail_next = False

    async def command(self, command: str) -> str:
        async with self.lock:
            if self.fail_next:
                self.fail_next = False
                raise InverterError("simulated USB timeout")
            if command.startswith("POP"):
                self.output_priority = command[-2:]
                return "ACK"
            if command.startswith("PCP"):
                self.charger_priority = command[-2:]
                return "ACK"
            replies = {
                "QPI": "PI30", "QID": "SAKO-SIM-0001", "QVFW": "VERFW:00001.00",
                "QVFW2": "VERFW2:00001.00", "QMOD": "L",
                "QPIGS": "230.0 50.0 230.0 50.0 0550 0440 22 390 51.20 012 86 31 4.2 116.0 51.10 000 01000000",
                "QPIRI": f"230.0 30.0 230.0 50.0 13.0 3000 2400 48.0 54.0 42.0 56.4 54.0 AGM 30 60 UPS {self.output_priority} {self.charger_priority}",
                "QFLAG": "Eabjkuvxyz", "QPIWS": "00000000000000000000000000000000",
            }
            return replies.get(command, "NAK")

    async def close(self) -> None:
        return None
