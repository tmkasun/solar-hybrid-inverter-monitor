from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


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

    @staticmethod
    def now() -> str:
        return datetime.now(UTC).isoformat()

    def add_sample(self, data: dict[str, Any]) -> str:
        timestamp = self.now()
        self.connection.execute("INSERT INTO samples VALUES (?, ?)", (timestamp, json.dumps(data)))
        self.connection.commit()
        return timestamp

    def audit(self, action: str, result: str, setting_key: str | None = None,
              old_value: str | None = None, new_value: str | None = None, detail: str | None = None) -> None:
        self.connection.execute("INSERT INTO audit_log (occurred_at,action,setting_key,old_value,new_value,result,detail) VALUES (?,?,?,?,?,?,?)",
                                (self.now(), action, setting_key, old_value, new_value, result, detail))
        self.connection.commit()

    def history(self, hours: int) -> list[dict[str, Any]]:
        cutoff = (datetime.now(UTC) - timedelta(hours=hours)).isoformat()
        rows = self.connection.execute("SELECT captured_at, data FROM samples WHERE captured_at >= ? ORDER BY captured_at", (cutoff,)).fetchall()
        return [{"captured_at": row["captured_at"], **json.loads(row["data"])} for row in rows]

    def audit_rows(self, limit: int = 100) -> list[dict[str, Any]]:
        return [dict(row) for row in self.connection.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]

    def compact(self, raw_retention_days: int) -> None:
        """Roll old raw values into deterministic hourly/daily average records."""
        cutoff = (datetime.now(UTC) - timedelta(days=raw_retention_days)).isoformat()
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

    def close(self) -> None:
        self.connection.close()
