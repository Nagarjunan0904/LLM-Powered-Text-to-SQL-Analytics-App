"""FastAPI backend for the LLM-Powered Text-to-SQL Analytics App."""
import asyncio
import json
import os
import time
from collections import Counter
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from pydantic import BaseModel
from sqlalchemy import create_engine, text

from db.safety import SafetyError, validate_sql
from db.schema_extractor import get_schema_context
from eval.logger import EvalLogger
from llm.correction_loop import execute_with_correction
from llm.prompt_builder import CORRECTION_PROMPT_TEMPLATE, CORE_PROMPT_TEMPLATE
from llm.sql_generator import _strip_fences

load_dotenv()

_MAX_ATTEMPTS = 3

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    sql: str
    columns: list[str]
    rows: list[list]
    attempts: int
    corrected: bool
    latency_ms: float


class SchemaResponse(BaseModel):
    schema_text: str
    sample_rows: str
    table_count: int
    row_count: int


class EvalStats(BaseModel):
    total_queries: int
    success_rate: float
    avg_latency_ms: float
    correction_rate: float
    top_errors: list[dict]


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/text_to_sql")
    engine = create_engine(db_url)
    app.state.engine = engine

    ctx = get_schema_context(engine)
    app.state.schema = ctx["schema"]
    app.state.sample_rows = ctx["sample_rows"]

    app.state.eval_logger = EvalLogger()

    # Cache row count once at startup
    try:
        with engine.connect() as conn:
            app.state.row_count = conn.execute(
                text("SELECT COUNT(*) FROM yellow_taxi_trips")
            ).scalar() or 0
    except Exception:
        app.state.row_count = 0

    table_count = app.state.schema.count("Table:")
    print(f"API ready — schema cached, {table_count} tables, {app.state.row_count:,} rows")

    yield

    engine.dispose()


# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="Text-to-SQL Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://victorious-charisma-production-7052.up.railway.app",
        "https://*.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Internal helper — sync SQL execution (used by streaming endpoint)
# ---------------------------------------------------------------------------

def _execute_sql(engine, sql: str) -> tuple[list[dict], list[str]]:
    """Execute sql and return (rows, columns). Caller handles exceptions."""
    with engine.connect() as conn:
        result = conn.execute(text(sql))
        columns = list(result.keys())
        rows = [dict(row._mapping) for row in result]
    return rows, columns


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    try:
        result = execute_with_correction(
            question=question,
            schema=app.state.schema,
            sample_rows=app.state.sample_rows,
            engine=app.state.engine,
        )
    except SafetyError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Query rejected by safety guardrail: {exc}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    rows_as_lists = [list(row.values()) for row in result["rows"]]

    return QueryResponse(
        sql=result["sql"],
        columns=result["columns"],
        rows=rows_as_lists,
        attempts=result["attempts"],
        corrected=result["corrected"],
        latency_ms=result["latency_ms"],
    )


@app.get("/query/stream")
async def stream_query(
    question: str = Query(..., description="Natural language question to answer with SQL"),
):
    """Stream SQL generation tokens and execution results as Server-Sent Events."""

    async def event_generator():
        q = question.strip()
        if not q:
            yield f"data: {json.dumps({'type': 'error', 'message': 'Question must not be empty'})}\n\n"
            yield f"data: {json.dumps({'type': 'end'})}\n\n"
            return

        llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            streaming=True,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
        )

        t_start = time.perf_counter()
        current_sql = ""
        last_error = ""

        for attempt in range(1, _MAX_ATTEMPTS + 1):
            attempt_t0 = time.perf_counter()

            # Build prompt and emit status
            if attempt == 1:
                yield f"data: {json.dumps({'type': 'status', 'content': 'Generating SQL...'})}\n\n"
                messages = CORE_PROMPT_TEMPLATE.format_messages(
                    schema=app.state.schema,
                    sample_rows=app.state.sample_rows,
                    question=q,
                )
            else:
                yield f"data: {json.dumps({'type': 'status', 'content': f'Correcting (attempt {attempt})...'})}\n\n"
                messages = CORRECTION_PROMPT_TEMPLATE.format_messages(
                    failed_sql=current_sql,
                    error_message=last_error,
                    schema=app.state.schema,
                )

            # Stream tokens from GPT-4o
            tokens: list[str] = []
            async for chunk in llm.astream(messages):
                token = chunk.content
                if token:
                    tokens.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            current_sql = _strip_fences("".join(tokens))

            # Safety check
            try:
                validate_sql(current_sql)
            except SafetyError as exc:
                yield f"data: {json.dumps({'type': 'error', 'message': f'Query rejected by safety guardrail: {exc}'})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
                return

            # Execute SQL (sync call moved off the event loop)
            try:
                rows, columns = await asyncio.to_thread(
                    _execute_sql, app.state.engine, current_sql
                )
                latency_ms = round((time.perf_counter() - t_start) * 1000, 1)
                attempt_latency = round((time.perf_counter() - attempt_t0) * 1000, 1)

                app.state.eval_logger.log(
                    question=q,
                    attempt_num=attempt,
                    sql=current_sql,
                    error=None,
                    latency_ms=attempt_latency,
                    success=True,
                )

                yield f"data: {json.dumps({'type': 'done', 'sql': current_sql, 'attempts': attempt, 'corrected': attempt > 1, 'latency_ms': latency_ms})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
                return

            except Exception as exc:
                last_error = str(exc)
                attempt_latency = round((time.perf_counter() - attempt_t0) * 1000, 1)

                app.state.eval_logger.log(
                    question=q,
                    attempt_num=attempt,
                    sql=current_sql,
                    error=last_error,
                    latency_ms=attempt_latency,
                    success=False,
                )

        # All attempts exhausted
        yield f"data: {json.dumps({'type': 'error', 'message': f'Could not generate a valid query after {_MAX_ATTEMPTS} attempts'})}\n\n"
        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.get("/schema", response_model=SchemaResponse)
def schema():
    return SchemaResponse(
        schema_text=app.state.schema,
        sample_rows=app.state.sample_rows,
        table_count=app.state.schema.count("Table:"),
        row_count=app.state.row_count,
    )


@app.get("/examples")
def examples():
    return [
        "How many total trips were taken?",
        "What is the average fare amount by month?",
        "Which pickup location had the most trips?",
        "What is the average tip amount by payment type?",
        "What percentage of trips were paid by credit card?",
        "Show the top 5 busiest hours of the day for pickups",
    ]


@app.get("/eval", response_model=EvalStats)
def eval_stats():
    records = app.state.eval_logger.read(limit=1000)

    if not records:
        return EvalStats(
            total_queries=0,
            success_rate=0.0,
            avg_latency_ms=0.0,
            correction_rate=0.0,
            top_errors=[],
        )

    unique_questions = {r["question"] for r in records}
    total_queries = len(unique_questions)

    successes = sum(1 for r in records if r["success"] == 1)
    success_rate = round(successes / len(records) * 100, 1) if records else 0.0

    avg_latency = round(
        sum(r["latency_ms"] for r in records) / len(records), 1
    ) if records else 0.0

    corrected_questions = {r["question"] for r in records if r["attempt_number"] > 1}
    correction_rate = round(len(corrected_questions) / total_queries * 100, 1) if total_queries else 0.0

    error_counts = Counter(
        r["error_msg"][:80]
        for r in records
        if r["error_msg"]
    )
    top_errors = [
        {"error": err, "count": cnt}
        for err, cnt in error_counts.most_common(5)
    ]

    return EvalStats(
        total_queries=total_queries,
        success_rate=success_rate,
        avg_latency_ms=avg_latency,
        correction_rate=correction_rate,
        top_errors=top_errors,
    )


@app.get("/health")
def health():
    db_ok = False
    try:
        with app.state.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "ok",
        "db": "connected" if db_ok else "error",
        "schema_cached": bool(app.state.schema),
    }
