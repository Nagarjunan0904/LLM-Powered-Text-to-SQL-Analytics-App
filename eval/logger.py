import json
import os
import sqlite3
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Legacy JSONL logger (kept for API /logs endpoint)
# ---------------------------------------------------------------------------
LOG_FILE = os.getenv("QUERY_LOG_FILE", "query_log.jsonl")


def log_query(question: str, sql: str, success: bool, error: str | None = None) -> None:
    """Append a query event to the JSONL log file."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "question": question,
        "sql": sql,
        "success": success,
        "error": error,
    }
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def read_logs(limit: int = 50) -> list[dict]:
    """Return the last `limit` JSONL log entries."""
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    entries = [json.loads(line) for line in lines if line.strip()]
    return entries[-limit:]


# ---------------------------------------------------------------------------
# EvalLogger — SQLite-backed structured logger for correction-loop attempts
# ---------------------------------------------------------------------------
_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS eval_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp      TEXT    NOT NULL,
    question       TEXT    NOT NULL,
    sql_attempt    TEXT    NOT NULL,
    error_msg      TEXT,
    attempt_number INTEGER NOT NULL,
    latency_ms     REAL    NOT NULL,
    success        INTEGER NOT NULL   -- 1 = success, 0 = failure
);
"""


class EvalLogger:
    """Structured logger that persists each correction-loop attempt to SQLite."""

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.getenv("EVAL_LOG_DB", "eval_log.db")
        self._init_db()

    def _init_db(self) -> None:
        with self._conn() as conn:
            conn.execute(_CREATE_TABLE_SQL)

    def _conn(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def log(
        self,
        question: str,
        attempt_num: int,
        sql: str,
        error: str | None,
        latency_ms: float,
        success: bool,
    ) -> None:
        """Insert one attempt record into eval_log."""
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO eval_log
                    (timestamp, question, sql_attempt, error_msg,
                     attempt_number, latency_ms, success)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    datetime.now(timezone.utc).isoformat(),
                    question,
                    sql,
                    error,
                    attempt_num,
                    latency_ms,
                    1 if success else 0,
                ),
            )

    def read(self, limit: int = 50) -> list[dict]:
        """Return the last `limit` eval_log rows as dicts."""
        with self._conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM eval_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in reversed(rows)]
