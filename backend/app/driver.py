"""Exclusive inverter drivers: real pyUSB HID and deterministic laptop simulator."""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod

from .protocol import frame, response_payload

logger = logging.getLogger(__name__)


class InverterError(RuntimeError):
    pass


class BaseInverter(ABC):
    @abstractmethod
    async def command(self, command: str) -> str: ...

    @abstractmethod
    async def close(self) -> None: ...


class UsbHidInverter(BaseInverter):
    """pyUSB interrupt transport. All calls are guarded to prevent frame interleaving."""
    report_size = 8
    max_response_reports = 32
    stale_report_timeout_ms = 25

    def __init__(self, vendor_id: int, product_id: int):
        self.vendor_id, self.product_id = vendor_id, product_id
        self.device = None
        self.interface = None
        self.endpoint_out = None
        self.endpoint_in = None
        self.interface_claimed = False
        self.lock = asyncio.Lock()

    @staticmethod
    def _find_endpoints(configuration):
        """Choose a HID interface with an interrupt IN endpoint.

        Some PIP HID devices have a matching interrupt OUT endpoint, while
        others send HID output reports through the control endpoint.
        """
        candidates = []
        for interface in configuration:
            endpoint_addresses = [endpoint.bEndpointAddress for endpoint in interface]
            endpoint_out = next((address for address in endpoint_addresses if not address & 0x80), None)
            endpoint_in = next((address for address in endpoint_addresses if address & 0x80), None)
            if endpoint_in is not None:
                # Prefer HID (USB class 3), but allow vendor-class PIP devices.
                is_hid = interface.bInterfaceClass == 0x03
                candidates.append((is_hid, endpoint_out is not None, interface.bInterfaceNumber, endpoint_out, endpoint_in))
        if not candidates:
            raise InverterError("no USB interface with an interrupt IN endpoint was found")
        _, _, interface_number, endpoint_out, endpoint_in = max(candidates, key=lambda candidate: candidate[:2])
        return interface_number, endpoint_out, endpoint_in

    def _connect(self) -> None:
        import usb.core
        import usb.util
        logger.info("Connecting to USB inverter %04x:%04x", self.vendor_id, self.product_id)
        self.device = usb.core.find(idVendor=self.vendor_id, idProduct=self.product_id)
        if self.device is None:
            logger.error("USB inverter %04x:%04x was not found", self.vendor_id, self.product_id)
            raise InverterError(f"USB inverter {self.vendor_id:04x}:{self.product_id:04x} not found")
        try:
            self.device.set_configuration()
        except Exception:
            # A configuration may already be active, which is normal.
            logger.debug("USB configuration was already active", exc_info=True)
        try:
            self.interface, self.endpoint_out, self.endpoint_in = self._find_endpoints(self.device.get_active_configuration())
        except Exception as exc:
            logger.exception("Unable to discover USB endpoints for %04x:%04x", self.vendor_id, self.product_id)
            self.device = None
            raise InverterError(f"could not discover USB HID endpoints: {exc}") from exc
        logger.info("USB inverter connected: interface=%d endpoint_out=%s endpoint_in=0x%02x",
                    self.interface, f"0x{self.endpoint_out:02x}" if self.endpoint_out is not None else "HID control",
                    self.endpoint_in)
        try:
            if self.device.is_kernel_driver_active(self.interface):
                logger.info("Detaching kernel driver from USB interface %d", self.interface)
                self.device.detach_kernel_driver(self.interface)
        except (NotImplementedError, AttributeError):
            logger.debug("Kernel driver status is unavailable for USB interface %d", self.interface)
        try:
            usb.util.claim_interface(self.device, self.interface)
            self.interface_claimed = True
        except Exception as exc:
            logger.exception("Unable to claim USB interface %d", self.interface)
            self.device = None
            raise InverterError(
                f"could not claim USB interface {self.interface}; another inverter application may be using it: {exc}"
            ) from exc
        self._drain_input()

    def _drain_input(self) -> None:
        """Discard replies left behind by an interrupted prior client session."""
        assert self.device is not None and self.endpoint_in is not None
        stale_reports: list[bytes] = []
        for _ in range(self.max_response_reports):
            try:
                report = bytes(self.device.read(self.endpoint_in, self.report_size, timeout=self.stale_report_timeout_ms))
            except Exception as exc:
                # libusb timeout is normally errno 110 on Linux or error -7.
                if getattr(exc, "errno", None) == 110 or getattr(exc, "backend_error_code", None) == -7:
                    break
                logger.warning("Unable to drain USB input endpoint", exc_info=True)
                break
            if not report:
                break
            stale_reports.append(report)
        if stale_reports:
            logger.warning("Discarded %d stale USB input report(s): %s", len(stale_reports), b"".join(stale_reports).hex(" "))

    def _disconnect(self) -> None:
        device, interface = self.device, self.interface
        self.device = None
        self.interface = None
        self.endpoint_out = None
        self.endpoint_in = None
        claimed = self.interface_claimed
        self.interface_claimed = False
        if device is not None and claimed and interface is not None:
            try:
                import usb.util
                usb.util.release_interface(device, interface)
                usb.util.dispose_resources(device)
            except Exception:
                logger.warning("Failed to release USB interface %d", interface, exc_info=True)

    def _send(self, command: str) -> str:
        if self.device is None:
            self._connect()
        try:
            assert self.interface is not None and self.endpoint_in is not None
            payload = frame(command).ljust(self.report_size, b"\0")
            logger.debug("Sending USB command %s: report=%s", command, payload.hex(" "))
            if self.endpoint_out is not None:
                self.device.write(self.endpoint_out, payload, timeout=2500)
            else:
                # HID SET_REPORT for devices, such as the Cypress 0665:5161,
                # that declare Output reports but no interrupt OUT endpoint.
                self.device.ctrl_transfer(0x21, 0x09, 0x0200, self.interface, payload, timeout=2500)
            chunks: list[bytes] = []
            # QPIGS and QPIRI exceed 64 bytes.  This device transports them
            # in 8-byte HID reports, so keep reading until their CR terminator.
            for _ in range(self.max_response_reports):
                chunk = bytes(self.device.read(self.endpoint_in, self.report_size, timeout=2500))
                chunks.append(chunk)
                if b"\r" in chunk:
                    break
            if not any(b"\r" in chunk for chunk in chunks):
                raise ValueError(f"truncated inverter response after {len(chunks)} HID reports: {b''.join(chunks).hex(' ')}")
            reply = b"".join(chunks).split(b"\r", 1)[0] + b"\r"
            try:
                result = response_payload(reply)
                logger.debug("USB command %s completed: reports=%d response=%r", command, len(chunks), result)
                return result
            except ValueError as exc:
                raise ValueError(f"{exc}; received bytes: {reply.hex(' ')}") from exc
        except Exception as exc:
            logger.exception("USB command %s failed", command)
            self._disconnect()
            raise InverterError(f"USB command {command} failed: {exc}") from exc

    async def command(self, command: str) -> str:
        async with self.lock:
            # asyncio.to_thread was added in Python 3.9.  The Pi may run
            # Python 3.8, where run_in_executor provides the same behavior.
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self._send, command)

    async def close(self) -> None:
        logger.info("Closing USB inverter connection")
        self._disconnect()


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
                logger.error("Simulator configured to fail command %s", command)
                raise InverterError("simulated USB timeout")
            logger.debug("Simulator command %s", command)
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
