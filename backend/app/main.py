from __future__ import annotations

import asyncio
import hashlib
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import bcrypt
from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .capabilities import command_for, confirmation_for, public_capabilities
from .config import settings
from .driver import BaseInverter, InverterError, SimulatorInverter, UsbHidInverter
from .protocol import parse_rating, status_dict
from .storage import Storage


class LoginRequest(BaseModel):
    password: str = Field(min_length=1)


class ChangeRequest(BaseModel):
    value: str
    confirmation: str


class State:
    def __init__(self):
        self.inverter: BaseInverter = SimulatorInverter() if settings.mode == "simulator" else UsbHidInverter(settings.vendor_id, settings.product_id)
        self.storage = Storage(settings.database_path)
        self.sessions: dict[str, str] = {}
        self.latest: dict[str, Any] = {"connected": False, "mode": None, "status": {}, "warnings": None, "captured_at": None, "error": "Awaiting first poll"}
        self.diagnostics: dict[str, Any] = {}
        self.sockets: set[WebSocket] = set()
        self.task: asyncio.Task | None = None

    async def poll(self) -> None:
        try:
            qpigs, mode, warnings = await asyncio.gather(self.inverter.command("QPIGS"), self.inverter.command("QMOD"), self.inverter.command("QPIWS"))
            captured = datetime.now(timezone.utc).isoformat()
            self.latest = {"connected": True, "mode": mode, "status": status_dict(qpigs), "warnings": warnings,
                           "captured_at": captured, "error": None}
            self.storage.add_sample(self.latest["status"])
            await self.broadcast({"type": "telemetry", "data": self.latest})
        except (InverterError, ValueError) as exc:
            self.latest.update({"connected": False, "error": str(exc), "captured_at": datetime.now(timezone.utc).isoformat()})
            await self.broadcast({"type": "connection", "data": self.latest})

    async def poll_loop(self) -> None:
        while True:
            await self.poll()
            self.storage.compact(settings.raw_retention_days)
            await asyncio.sleep(settings.poll_seconds)

    async def discover(self) -> dict[str, Any]:
        commands = ("QPI", "QID", "QVFW", "QVFW2", "QPIRI", "QFLAG")
        result: dict[str, Any] = {}
        for command in commands:
            try:
                result[command] = await self.inverter.command(command)
            except InverterError as exc:
                result[command] = {"error": str(exc)}
        if isinstance(result.get("QPIRI"), str):
            result["rating"] = parse_rating(result["QPIRI"])
        self.diagnostics = result
        return result

    async def broadcast(self, event: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for socket in self.sockets:
            try:
                await socket.send_json(event)
            except Exception:
                stale.append(socket)
        for socket in stale:
            self.sockets.discard(socket)


state = State()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await state.discover()
    state.task = asyncio.create_task(state.poll_loop())
    yield
    if state.task:
        state.task.cancel()
    await state.inverter.close()
    state.storage.close()


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


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "runtime_mode": settings.mode, "connected": state.latest["connected"], "error": state.latest["error"]}


@app.get("/api/status")
async def get_status() -> dict[str, Any]:
    return state.latest


@app.get("/api/capabilities")
async def capabilities() -> dict[str, Any]:
    # QPIRI is the model/rating query that confirms this PIP configuration interface.
    supported = public_capabilities() if isinstance(state.diagnostics.get("QPIRI"), str) else []
    return {"capabilities": supported, "diagnostics": state.diagnostics}


@app.get("/api/history")
async def history(hours: int = 24) -> dict[str, Any]:
    if not 1 <= hours <= 720:
        raise HTTPException(422, "hours must be between 1 and 720")
    return {"samples": state.storage.history(hours)}


@app.get("/api/audit")
async def audit(_: str = Depends(session_auth)) -> dict[str, Any]:
    return {"entries": state.storage.audit_rows()}


@app.get("/api/diagnostics")
async def diagnostics(_: str = Depends(session_auth)) -> dict[str, Any]:
    return {"diagnostics": state.diagnostics, "latest": state.latest}


@app.post("/api/diagnostics/refresh")
async def refresh_diagnostics(_: str = Depends(session_auth)) -> dict[str, Any]:
    return {"diagnostics": await state.discover()}


@app.post("/api/auth/login")
async def login(body: LoginRequest, response: Response) -> dict[str, str]:
    valid = bool(settings.admin_password_hash) and bcrypt.checkpw(body.password.encode(), settings.admin_password_hash.encode())
    if not valid:
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
        reply = await state.inverter.command(command)
        if reply not in ("ACK", "(ACK"):
            raise InverterError(f"inverter rejected command: {reply}")
        diagnostics = await state.discover()
        state.storage.audit("setting_change", "accepted", key, new_value=body.value, detail=command)
        event = {"type": "command_result", "data": {"key": key, "value": body.value, "ok": True}}
        await state.broadcast(event)
        return {"ok": True, "reply": reply, "diagnostics": diagnostics}
    except InverterError as exc:
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
