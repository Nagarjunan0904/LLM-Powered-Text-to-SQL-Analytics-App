"""
Manual test for Sub-phase 2.1 — Self-Correction Loop.

Scenario 1: happy path  → attempts=1, corrected=False
Scenario 2: bad prompt  → loop retries, corrected=True or graceful failure dict
"""
import json
import os
from decimal import Decimal
from datetime import datetime, date

from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

from db.schema_extractor import get_schema_context
from llm.correction_loop import execute_with_correction

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/text_to_sql")
engine = create_engine(DATABASE_URL)

ctx = get_schema_context(engine)
schema = ctx["schema"]
sample_rows = ctx["sample_rows"]


def _serialise(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(type(obj))


def pretty(d: dict) -> str:
    # Truncate rows list for readability
    display = dict(d)
    if "rows" in display:
        display["rows"] = display["rows"][:3]  # show at most 3 rows
    return json.dumps(display, indent=2, default=_serialise)


# ---------------------------------------------------------------------------
# Scenario 1 — happy path
# ---------------------------------------------------------------------------
print("=" * 60)
print("SCENARIO 1 — Happy path")
print("=" * 60)
result1 = execute_with_correction(
    "What is the average fare amount?",
    schema,
    sample_rows,
    engine,
)
print(pretty(result1))
assert "error" not in result1, "Scenario 1 should succeed"
assert result1["attempts"] == 1, f"Expected 1 attempt, got {result1['attempts']}"
assert result1["corrected"] is False, "Expected corrected=False"
print("PASS: attempts=1, corrected=False\n")

# ---------------------------------------------------------------------------
# Scenario 2 — force a correction by passing a broken SQL as the question
# ---------------------------------------------------------------------------
print("=" * 60)
print("SCENARIO 2 — Force correction (bad question/nonexistent table)")
print("=" * 60)
result2 = execute_with_correction(
    "SELECT * FROM nonexistent_table_xyz",
    schema,
    sample_rows,
    engine,
)
print(pretty(result2))
if "error" in result2:
    assert result2["attempts"] == 3, f"Expected 3 attempts, got {result2['attempts']}"
    assert "last_sql" in result2
    assert "last_error" in result2
    print("PASS: Graceful failure after 3 attempts - no Python traceback\n")
else:
    assert result2["corrected"] is True, "Expected corrected=True"
    assert result2["attempts"] > 1, "Expected more than 1 attempt"
    print(f"PASS: Corrected successfully in {result2['attempts']} attempts\n")

print("DONE")
