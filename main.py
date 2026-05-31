"""
Entry point for the LLM-Powered Text-to-SQL Analytics App.

CLI usage:
    python main.py "Your question here"
    python main.py          # prompts for input

API usage (no arguments, --api flag):
    python main.py --api
"""
import json
import os
import sys
import time
from decimal import Decimal
from datetime import datetime, date

import uvicorn
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


# ---------------------------------------------------------------------------
# JSON serialisation helper — handles Decimal, datetime, date
# ---------------------------------------------------------------------------
def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serialisable")


def _to_json(rows: list[dict]) -> str:
    return json.dumps(rows, indent=2, default=_json_default)


# ---------------------------------------------------------------------------
# CLI pipeline
# ---------------------------------------------------------------------------
def run_cli(question: str) -> bool:
    """Execute the full pipeline for a single question. Returns True on success."""
    from db.schema_extractor import get_schema_context
    from llm.sql_generator import generate_sql

    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/text_to_sql",
    )
    engine = create_engine(database_url)

    # 1. Extract schema context
    ctx = get_schema_context(engine)
    schema = ctx["schema"]
    sample_rows = ctx["sample_rows"]

    # 2. Generate SQL
    sql = generate_sql(question, schema, sample_rows)

    print(f"\nQuestion:      {question}")
    print(f"Generated SQL: {sql}")

    # 3. Execute and time it
    t0 = time.perf_counter()
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            rows = [dict(row._mapping) for row in result]
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - t0) * 1000
        print(f"Query time:    {elapsed_ms:.1f} ms")
        print(f"ERROR:         {exc}")
        return False

    elapsed_ms = (time.perf_counter() - t0) * 1000

    print(f"Results:       {_to_json(rows)}")
    print(f"Query time:    {elapsed_ms:.1f} ms")
    return True


# ---------------------------------------------------------------------------
# API mode
# ---------------------------------------------------------------------------
def run_api():
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    args = sys.argv[1:]

    if "--api" in args:
        run_api()
    elif args:
        question = " ".join(args)
        ok = run_cli(question)
        sys.exit(0 if ok else 1)
    else:
        question = input("Enter your question: ").strip()
        if not question:
            print("No question provided.")
            sys.exit(1)
        ok = run_cli(question)
        sys.exit(0 if ok else 1)
