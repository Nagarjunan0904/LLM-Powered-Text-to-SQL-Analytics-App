"""Tests to ensure the LLM never generates destructive SQL."""
import pytest

FORBIDDEN_KEYWORDS = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"]


def is_safe_sql(sql: str) -> bool:
    upper = sql.upper()
    return not any(kw in upper for kw in FORBIDDEN_KEYWORDS)


@pytest.mark.parametrize("sql,expected", [
    ("SELECT * FROM users", True),
    ("SELECT id FROM orders WHERE total > 100", True),
    ("DROP TABLE users", False),
    ("DELETE FROM users WHERE id=1", False),
    ("INSERT INTO users (name) VALUES ('x')", False),
    ("UPDATE users SET name='x' WHERE id=1", False),
    ("ALTER TABLE users ADD COLUMN foo TEXT", False),
    ("TRUNCATE TABLE logs", False),
    ("CREATE TABLE foo (id INT)", False),
])
def test_sql_safety(sql, expected):
    assert is_safe_sql(sql) == expected


def test_select_only_allowed():
    safe_queries = [
        "SELECT count(*) FROM orders",
        "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id",
    ]
    for q in safe_queries:
        assert is_safe_sql(q), f"Expected safe: {q}"
