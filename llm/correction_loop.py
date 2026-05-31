"""
Self-correction loop for Text-to-SQL generation.

execute_with_correction() attempts SQL generation + execution up to MAX_ATTEMPTS
times, using the correction prompt on each failure.
"""
import os
import re
import time

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from eval.logger import EvalLogger
from llm.prompt_builder import CORRECTION_PROMPT_TEMPLATE
from llm.sql_generator import generate_sql, _strip_fences

load_dotenv()

MAX_ATTEMPTS = 3

_eval_logger = EvalLogger()


def _get_correction_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        openai_api_key=os.getenv("OPENAI_API_KEY"),
    )


def _run_sql(engine, sql: str) -> tuple[list[dict], list[str]]:
    """Execute sql and return (rows, columns). Raises on any DB error."""
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(row._mapping) for row in result]
    return rows, columns


def _correct_sql(failed_sql: str, error_message: str, schema: str) -> str:
    """Ask the LLM to fix a broken SQL query. Returns clean SQL string."""
    llm = _get_correction_llm()
    chain = CORRECTION_PROMPT_TEMPLATE | llm
    response = chain.invoke(
        {
            "failed_sql": failed_sql,
            "error_message": error_message,
            "schema": schema,
        }
    )
    return _strip_fences(response.content)


def execute_with_correction(
    question: str,
    schema: str,
    sample_rows: str,
    engine,
) -> dict:
    """
    Generate SQL for `question` and execute it, retrying with LLM correction
    on failure up to MAX_ATTEMPTS times.

    Returns on success:
        {
          "sql":        str,         # final working SQL
          "rows":       list[dict],  # result rows
          "columns":    list[str],   # column names
          "attempts":   int,         # 1–3
          "corrected":  bool,        # True if any correction was needed
          "latency_ms": float,       # wall-clock ms from first attempt to success
        }

    Returns on exhausted attempts:
        {
          "error":      str,
          "attempts":   int,
          "last_sql":   str,
          "last_error": str,
        }
    """
    t_start = time.perf_counter()
    current_sql: str | None = None
    last_error: str = ""

    for attempt in range(1, MAX_ATTEMPTS + 1):
        attempt_t0 = time.perf_counter()

        # --- Generate SQL ---
        if attempt == 1:
            current_sql = generate_sql(question, schema, sample_rows)
        else:
            current_sql = _correct_sql(current_sql, last_error, schema)

        # --- Execute SQL ---
        try:
            rows, columns = _run_sql(engine, current_sql)
            latency_ms = (time.perf_counter() - t_start) * 1000
            attempt_latency = (time.perf_counter() - attempt_t0) * 1000

            _eval_logger.log(
                question=question,
                attempt_num=attempt,
                sql=current_sql,
                error=None,
                latency_ms=attempt_latency,
                success=True,
            )

            return {
                "sql": current_sql,
                "rows": rows,
                "columns": columns,
                "attempts": attempt,
                "corrected": attempt > 1,
                "latency_ms": round(latency_ms, 1),
            }

        except (SQLAlchemyError, Exception) as exc:
            last_error = str(exc)
            attempt_latency = (time.perf_counter() - attempt_t0) * 1000

            _eval_logger.log(
                question=question,
                attempt_num=attempt,
                sql=current_sql,
                error=last_error,
                latency_ms=attempt_latency,
                success=False,
            )

            print(
                f"  [correction_loop] attempt {attempt} failed: "
                f"{last_error[:120]}{'...' if len(last_error) > 120 else ''}"
            )

    # All attempts exhausted
    return {
        "error": f"Could not generate a valid query after {MAX_ATTEMPTS} attempts",
        "attempts": MAX_ATTEMPTS,
        "last_sql": current_sql,
        "last_error": last_error,
    }
