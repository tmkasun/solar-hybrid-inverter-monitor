from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from logging.handlers import WatchedFileHandler
from pathlib import Path
from typing import Any

import bcrypt
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .bms import BmsError, BmsStatus, apply_bms_to_status, bms_from_settings
from .capabilities import command_for, confirmation_for, public_capabilities
from .config import settings
from .driver import BaseInverter, InverterError, SimulatorInverter, UsbHidInverter
from .protocol import parse_rating, status_dict
from .storage import Storage

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def configure_logging() -> None:
    level = getattr(logging, settings.log_level, logging.INFO)
    formatter = logging.Formatter(LOG_FORMAT)
    logging.basicConfig(level=level, format=LOG_FORMAT)
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    if settings.log_file:
        log_path = Path(settings.log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = WatchedFileHandler(log_path)
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        for name in ("", "uvicorn", "uvicorn.access"):
            target_logger = logging.getLogger(name)
            if not any(isinstance(handler, WatchedFileHandler) and handler.baseFilename == str(log_path) for handler in target_logger.handlers):
                target_logger.addHandler(file_handler)


configure_logging()
logger = logging.getLogger(__name__)
HISTORY_MAX_RANGE = timedelta(hours=720)
BROADCAST_TIMEOUT_SECONDS = 2.0


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class ChangeRequest(BaseModel):
    value: str
    confirmation: str


class State:
    def __init__(self):
        self.inverter: BaseInverter = SimulatorInverter() if settings.mode == "simulator" else UsbHidInverter(settings.vendor_id, settings.product_id)
        self.bms = bms_from_settings(settings)
        self.storage = Storage(settings.database_path)
        self.sessions: dict[str, str] = {}
        self.latest_bms: BmsStatus = self.initial_bms_status()
        self.latest_inverter: dict[str, Any] = {"connected": False, "mode": None, "status": {}, "warnings": None, "captured_at": None, "error": "Awaiting first poll"}
        self.latest: dict[str, Any] = self.merge_latest()
        self.diagnostics: dict[str, Any] = {}
        self.sockets: set[WebSocket] = set()
        self.task: asyncio.Task | None = None
        self.bms_task: asyncio.Task | None = None
        self.last_stored_sample_at: datetime | None = None
        logger.info("Inverter state initialized in %s mode; BMS mode=%s", settings.mode, settings.bms_mode)

    def initial_bms_status(self) -> BmsStatus:
        if settings.bms_mode.lower() == "disabled":
            return BmsStatus.disabled()
        return BmsStatus.failed(
            settings.bms_mode.lower(),
            "Awaiting first BMS poll",
            address=settings.bms_bluetooth_address,
            name=settings.bms_name,
            protocol=settings.bms_protocol,
        )

    def bms_fresh_window_seconds(self) -> float:
        return max(settings.bms_poll_seconds * 2, settings.bms_timeout_seconds + settings.poll_seconds)

    def merge_latest(self) -> dict[str, Any]:
        latest = {**self.latest_inverter, "status": dict(self.latest_inverter.get("status", {}))}
        latest["status"] = apply_bms_to_status(latest["status"], self.latest_bms, self.bms_fresh_window_seconds())
        latest["bms"] = self.latest_bms.to_dict()
        return latest

    async def update_latest(self, inverter_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
        if inverter_snapshot is not None:
            self.latest_inverter = inverter_snapshot
        self.latest = self.merge_latest()
        return self.latest

    async def poll(self) -> None:
        if not isinstance(self.diagnostics.get("QPI"), str) or not self.diagnostics["QPI"].startswith("PI"):
            if self.latest["error"] != "inverter has not identified as PIP-compatible":
                logger.error("Poll skipped: inverter has not identified as PIP-compatible")
            latest = await self.update_latest({
                "connected": False,
                "mode": None,
                "status": {},
                "warnings": None,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "error": "inverter has not identified as PIP-compatible",
            })
            await self.broadcast({"type": "connection", "data": latest})
            return
        try:
            qpigs = await self.inverter.command("QPIGS")
            mode = await self.inverter.command("QMOD")
            warnings = await self.inverter.command("QPIWS")
            replies = {"QPIGS": qpigs, "QMOD": mode, "QPIWS": warnings}
            rejected = {command: reply for command, reply in replies.items() if reply in ("NAK", "(NAK")}
            if rejected:
                raise InverterError(f"inverter rejected monitoring command(s): {rejected}")
            status = status_dict(qpigs)
            if all(value is None for value in status.values()):
                raise InverterError(f"unexpected QPIGS response: {qpigs!r}")
            captured = datetime.now(timezone.utc).isoformat()
            latest = await self.update_latest({
                "connected": True,
                "mode": mode,
                "status": status,
                "warnings": warnings,
                "captured_at": captured,
                "error": None,
            })
            captured_at = datetime.fromisoformat(captured)
            if self.should_store_sample(captured_at):
                self.storage.add_sample(latest["status"], captured)
                self.last_stored_sample_at = captured_at
            await self.broadcast({"type": "telemetry", "data": latest})
        except (InverterError, ValueError) as exc:
            logger.exception("Inverter telemetry poll failed")
            latest = await self.update_latest({
                **self.latest_inverter,
                "connected": False,
                "error": str(exc),
                "captured_at": datetime.now(timezone.utc).isoformat(),
            })
            await self.broadcast({"type": "connection", "data": latest})

    async def poll_bms(self) -> BmsStatus:
        if settings.bms_mode.lower() == "disabled":
            self.latest_bms = BmsStatus.disabled()
            await self.update_latest()
            return self.latest_bms
        try:
            self.latest_bms = await self.bms.status()
            logger.info("BMS telemetry poll succeeded: source=%s connected=%s", self.latest_bms.source, self.latest_bms.connected)
        except (BmsError, ValueError) as exc:
            logger.exception("BMS telemetry poll failed")
            error = str(exc)
            self.latest_bms = (
                self.latest_bms.with_poll_error(error)
                if self.latest_bms.connected
                else BmsStatus.failed(
                    settings.bms_mode.lower(),
                    error,
                    address=settings.bms_bluetooth_address,
                    name=settings.bms_name,
                    protocol=settings.bms_protocol,
                )
            )
        latest = await self.update_latest()
        await self.broadcast({"type": "telemetry" if self.latest_bms.connected else "connection", "data": latest})
        return self.latest_bms

    async def poll_loop(self) -> None:
        while True:
            try:
                await self.poll()
            except Exception:
                logger.exception("Telemetry poll loop iteration failed; polling will continue")
            try:
                self.storage.compact(settings.raw_retention_days)
            except Exception:
                logger.exception("Telemetry compaction failed; polling will continue")
            await asyncio.sleep(settings.poll_seconds)

    async def bms_poll_loop(self) -> None:
        while True:
            try:
                await self.poll_bms()
            except Exception:
                logger.exception("BMS poll loop iteration failed; polling will continue")
            await asyncio.sleep(settings.bms_poll_seconds)

    def should_store_sample(self, captured_at: datetime) -> bool:
        return (
            self.last_stored_sample_at is None
            or (captured_at - self.last_stored_sample_at).total_seconds() >= settings.db_sample_seconds
        )

    async def discover(self) -> dict[str, Any]:
        commands = ("QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG")
        result: dict[str, Any] = {}
        logger.info("Discovering inverter protocol and capabilities")
        try:
            result["QPI"] = await self.inverter.command("QPI")
        except InverterError as exc:
            logger.exception("Inverter QPI protocol probe failed")
            result["QPI"] = {"error": str(exc)}
        if not isinstance(result["QPI"], str) or not result["QPI"].startswith("PI"):
            logger.error("Inverter protocol probe was rejected: %r", result["QPI"])
            result["protocol_error"] = "device did not identify as PIP-compatible; no further commands were sent"
            self.diagnostics = result
            return result
        for command in commands[1:]:
            try:
                result[command] = await self.inverter.command(command)
            except InverterError as exc:
                logger.exception("Inverter discovery command %s failed", command)
                result[command] = {"error": str(exc)}
        if isinstance(result.get("QPIRI"), str):
            result["rating"] = parse_rating(result["QPIRI"])
        self.diagnostics = result
        return result

    async def broadcast(self, event: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for socket in list(self.sockets):
            try:
                await asyncio.wait_for(socket.send_json(event), timeout=BROADCAST_TIMEOUT_SECONDS)
            except asyncio.TimeoutError:
                logger.warning("Dropping slow websocket client after %.1fs send timeout", BROADCAST_TIMEOUT_SECONDS)
                stale.append(socket)
            except Exception:
                logger.warning("Dropping failed websocket client", exc_info=True)
                stale.append(socket)
        for socket in stale:
            self.sockets.discard(socket)


state = State()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting inverter API")
    await state.discover()
    state.task = asyncio.create_task(state.poll_loop())
    if settings.bms_mode.lower() != "disabled":
        state.bms_task = asyncio.create_task(state.bms_poll_loop())
    yield
    if state.task:
        state.task.cancel()
    if state.bms_task:
        state.bms_task.cancel()
    await state.inverter.close()
    await state.bms.close()
    state.storage.close()
    logger.info("Stopped inverter API")


app = FastAPI(title="Sako Inverter", version="1.0.0", lifespan=lifespan)
# Only relevant for direct Vite development; production is same-origin behind nginx.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


async def session_auth(sako_session: str | None = Cookie(default=None), x_csrf_token: str | None = Header(default=None)) -> str:
    if not sako_session or sako_session not in state.sessions:
        raise HTTPException(401, "login required")
    if x_csrf_token != state.sessions[sako_session]:
        raise HTTPException(403, "invalid CSRF token")
    return sako_session


def utc_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "ok": True,
        "runtime_mode": settings.mode,
        "connected": state.latest["connected"],
        "error": state.latest["error"],
        "bms": {
            "mode": settings.bms_mode,
            "connected": state.latest_bms.connected,
            "error": state.latest_bms.error,
        },
    }


@app.get("/api/status")
async def get_status() -> dict[str, Any]:
    return state.latest


@app.get("/api/capabilities")
async def capabilities() -> dict[str, Any]:
    # QPIRI is the model/rating query that confirms this PIP configuration interface.
    supported = public_capabilities() if isinstance(state.diagnostics.get("QPIRI"), str) else []
    return {"capabilities": supported, "diagnostics": state.diagnostics}


@app.get("/api/history")
async def history(hours: int | None = None, start: datetime | None = None, end: datetime | None = None) -> dict[str, Any]:
    if start or end:
        if not start or not end:
            raise HTTPException(422, "start and end must be provided together")
        start_utc = utc_datetime(start)
        end_utc = utc_datetime(end)
        if start_utc > end_utc:
            raise HTTPException(422, "start must be before end")
        if end_utc - start_utc > HISTORY_MAX_RANGE:
            raise HTTPException(422, "date range must be 720 hours or less")
        return {"samples": state.storage.history_range(start_utc.isoformat(), end_utc.isoformat())}
    hours = 24 if hours is None else hours
    if not 1 <= hours <= 720:
        raise HTTPException(422, "hours must be between 1 and 720")
    return {"samples": state.storage.history(hours)}


@app.get("/api/audit")
async def audit(_: str = Depends(session_auth)) -> dict[str, Any]:
    return {"entries": state.storage.audit_rows()}


@app.get("/api/diagnostics")
async def diagnostics(_: str = Depends(session_auth)) -> dict[str, Any]:
    return {"diagnostics": state.diagnostics, "latest": state.latest, "bms": state.latest_bms.to_dict()}


@app.post("/api/diagnostics/refresh")
async def refresh_diagnostics(_: str = Depends(session_auth)) -> dict[str, Any]:
    diagnostics = await state.discover()
    if settings.bms_mode.lower() != "disabled":
        await state.poll_bms()
    return {"diagnostics": diagnostics, "bms": state.latest_bms.to_dict()}


@app.post("/api/auth/login")
async def login(body: LoginRequest, response: Response) -> dict[str, str]:
    valid = bool(settings.admin_password_hash) and bcrypt.checkpw(body.password.encode(), settings.admin_password_hash.encode())
    if not valid:
        logger.warning("Rejected login attempt")
        state.storage.audit("login", "rejected", detail="invalid password")
        raise HTTPException(401, "invalid credentials")
    session, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    state.sessions[session] = csrf
    response.set_cookie("sako_session", session, httponly=True, samesite="strict", max_age=28800)
    state.storage.audit("login", "accepted")
    return {"csrf_token": csrf}


@app.post("/api/auth/logout")
async def logout(response: Response, sako_session: str | None = Cookie(default=None)) -> dict[str, bool]:
    if sako_session:
        state.sessions.pop(sako_session, None)
    response.delete_cookie("sako_session")
    logger.info("User logged out")
    return {"ok": True}


@app.post("/api/settings/{key}")
async def change_setting(key: str, body: ChangeRequest, _: str = Depends(session_auth)) -> dict[str, Any]:
    if not isinstance(state.diagnostics.get("QPIRI"), str):
        raise HTTPException(409, "configuration capabilities have not been confirmed for this inverter")
    if body.confirmation != confirmation_for(key):
        raise HTTPException(422, f"confirmation must equal {confirmation_for(key)}")
    command = command_for(key, body.value)
    if not command:
        state.storage.audit("setting_change", "rejected", key, new_value=body.value, detail="unsupported setting/value")
        raise HTTPException(422, "unsupported setting or value for this inverter")
    try:
        logger.info("Applying inverter setting %s=%s using %s", key, body.value, command)
        reply = await state.inverter.command(command)
        if reply not in ("ACK", "(ACK"):
            raise InverterError(f"inverter rejected command: {reply}")
        diagnostics = await state.discover()
        state.storage.audit("setting_change", "accepted", key, new_value=body.value, detail=command)
        event = {"type": "command_result", "data": {"key": key, "value": body.value, "ok": True}}
        await state.broadcast(event)
        return {"ok": True, "reply": reply, "diagnostics": diagnostics}
    except InverterError as exc:
        logger.exception("Inverter setting change %s=%s failed", key, body.value)
        state.storage.audit("setting_change", "failed", key, new_value=body.value, detail=str(exc))
        await state.broadcast({"type": "command_result", "data": {"key": key, "value": body.value, "ok": False, "error": str(exc)}})
        raise HTTPException(502, str(exc))


@app.websocket("/ws")
async def websocket(socket: WebSocket):
    await socket.accept()
    state.sockets.add(socket)
    await socket.send_json({"type": "telemetry", "data": state.latest})
    try:
        while True:
            await socket.receive_text()
    except WebSocketDisconnect:
        state.sockets.discard(socket)
