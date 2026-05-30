import json
import os
from datetime import datetime, timezone

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
    """Return the last `limit` log entries."""
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()
    entries = [json.loads(line) for line in lines if line.strip()]
    return entries[-limit:]
