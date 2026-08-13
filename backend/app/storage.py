from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class Storage:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript("""
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS samples (
              captured_at TEXT PRIMARY KEY, data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS hourly_samples (
              captured_hour TEXT PRIMARY KEY, samples INTEGER NOT NULL, data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS daily_samples (
              captured_day TEXT PRIMARY KEY, samples INTEGER NOT NULL, data TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, action TEXT NOT NULL,
              setting_key TEXT, old_value TEXT, new_value TEXT, result TEXT NOT NULL, detail TEXT
            );
        """)
        self.connection.commit()
        logger.info("Storage initialized at %s", path)

    @staticmethod
    def now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def add_sample(self, data: dict[str, Any]) -> str:
        try:
            timestamp = self.now()
            self.connection.execute("INSERT INTO samples VALUES (?, ?)", (timestamp, json.dumps(data)))
            self.connection.commit()
            logger.debug("Stored telemetry sample at %s", timestamp)
            return timestamp
        except sqlite3.Error:
            logger.exception("Failed to store telemetry sample")
            raise

    def audit(self, action: str, result: str, setting_key: str | None = None,
              old_value: str | None = None, new_value: str | None = None, detail: str | None = None) -> None:
        try:
            self.connection.execute("INSERT INTO audit_log (occurred_at,action,setting_key,old_value,new_value,result,detail) VALUES (?,?,?,?,?,?,?)",
                                    (self.now(), action, setting_key, old_value, new_value, result, detail))
            self.connection.commit()
            logger.info("Audit event recorded: action=%s result=%s setting=%s", action, result, setting_key)
        except sqlite3.Error:
            logger.exception("Failed to record audit event: action=%s result=%s", action, result)
            raise

    def history(self, hours: int) -> list[dict[str, Any]]:
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            rows = self.connection.execute("SELECT captured_at, data FROM samples WHERE captured_at >= ? ORDER BY captured_at", (cutoff,)).fetchall()
            return [{"captured_at": row["captured_at"], **json.loads(row["data"])} for row in rows]
        except (sqlite3.Error, json.JSONDecodeError):
            logger.exception("Failed to read %d hours of telemetry history", hours)
            raise

    def history_range(self, start: str, end: str) -> list[dict[str, Any]]:
        try:
            rows = self.connection.execute(
                "SELECT captured_at, data FROM samples WHERE captured_at >= ? AND captured_at <= ? ORDER BY captured_at",
                (start, end),
            ).fetchall()
            return [{"captured_at": row["captured_at"], **json.loads(row["data"])} for row in rows]
        except (sqlite3.Error, json.JSONDecodeError):
            logger.exception("Failed to read telemetry history between %s and %s", start, end)
            raise

    def audit_rows(self, limit: int = 100) -> list[dict[str, Any]]:
        try:
            return [dict(row) for row in self.connection.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]
        except sqlite3.Error:
            logger.exception("Failed to read audit log")
            raise

    def compact(self, raw_retention_days: int) -> None:
        """Roll old raw values into deterministic hourly/daily average records."""
        try:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=raw_retention_days)).isoformat()
            old_rows = self.connection.execute("SELECT captured_at, data FROM samples WHERE captured_at < ?", (cutoff,)).fetchall()
            buckets: dict[str, list[dict]] = {}
            for row in old_rows:
                buckets.setdefault(row["captured_at"][:13] + ":00:00+00:00", []).append(json.loads(row["data"]))
            for hour, points in buckets.items():
                numeric: dict[str, list[float]] = {}
                for point in points:
                    for key, value in point.items():
                        if isinstance(value, (int, float)):
                            numeric.setdefault(key, []).append(value)
                averaged = {key: round(sum(values) / len(values), 3) for key, values in numeric.items()}
                self.connection.execute("INSERT OR REPLACE INTO hourly_samples VALUES (?, ?, ?)", (hour, len(points), json.dumps(averaged)))
            if old_rows:
                self.connection.execute("DELETE FROM samples WHERE captured_at < ?", (cutoff,))
                self.connection.commit()
                logger.info("Compacted %d raw telemetry samples", len(old_rows))
        except (sqlite3.Error, json.JSONDecodeError):
            logger.exception("Failed to compact telemetry older than %d days", raw_retention_days)
            raise

    def close(self) -> None:
        self.connection.close()
        logger.info("Storage closed")
