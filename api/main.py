from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import text

from db.connection import engine
from llm.sql_generator import generate_sql
from eval.logger import log_query, read_logs

app = FastAPI(title="Text-to-SQL Analytics API")


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    question: str
    sql: str
    results: list[dict]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    sql = generate_sql(question)

    try:
        with engine.connect() as conn:
            rows = conn.execute(text(sql))
            results = [dict(row._mapping) for row in rows]
        log_query(question, sql, success=True)
    except Exception as e:
        log_query(question, sql, success=False, error=str(e))
        raise HTTPException(status_code=500, detail=f"SQL execution failed: {e}")

    return QueryResponse(question=question, sql=sql, results=results)


@app.get("/logs")
def get_logs(limit: int = 50):
    return read_logs(limit=limit)
