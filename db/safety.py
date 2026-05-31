"""SQL safety guardrail — rejects any non-SELECT or destructive query."""
import re


class SafetyError(Exception):
    """Raised when a SQL query fails the safety check."""
    pass


_FORBIDDEN = [
    "drop", "delete", "insert", "update", "truncate",
    "alter", "create", "grant", "revoke",
]


def validate_sql(sql: str) -> bool:
    """
    Return True if sql is a safe read-only query, otherwise raise SafetyError.

    Checks (in order):
    1. Query must start with SELECT (first 20 chars, case-insensitive).
    2. Query must not contain forbidden DML/DDL keywords as whole words.
    """
    sql = sql.strip()

    if not sql[:20].lower().startswith("select"):
        raise SafetyError("Query must start with SELECT")

    lower_sql = sql.lower()
    for keyword in _FORBIDDEN:
        if re.search(rf"\b{keyword}\b", lower_sql):
            raise SafetyError(f"Forbidden keyword detected: {keyword}")

    return True
