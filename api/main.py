"""FastAPI backend for the LLM-Powered Text-to-SQL Analytics App."""
import os
from collections import Counter
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text

from db.safety import SafetyError
from db.schema_extractor import get_schema_context
from eval.logger import EvalLogger
from llm.correction_loop import execute_with_correction

load_dotenv()

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

    table_count = app.state.schema.count("Table:")
    print(f"API ready — schema cached, {table_count} tables found")

    yield

    engine.dispose()


# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="Text-to-SQL Analytics API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.get("/schema", response_model=SchemaResponse)
def schema():
    return SchemaResponse(
        schema_text=app.state.schema,
        sample_rows=app.state.sample_rows,
        table_count=app.state.schema.count("Table:"),
    )


@app.get("/examples")
def examples():
    return [
        "How many total trips were taken in 2023?",
        "What is the average fare amount by month?",
        "Which pickup location had the most trips?",
        "What is the total revenue by day of the week?",
        "What percentage of trips were paid by credit card?",
        "What is the average tip amount by payment type?",
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

    # questions where any attempt_number > 1 exists
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
