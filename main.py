"""Entry point: run the FastAPI app or execute a one-off query from the CLI."""
import sys
import uvicorn


def run_api():
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)


def run_cli(question: str):
    from db.connection import test_connection
    from llm.sql_generator import generate_sql
    from sqlalchemy import text
    from db.connection import engine

    if not test_connection():
        print("ERROR: Cannot connect to the database. Check DATABASE_URL in .env")
        sys.exit(1)

    print(f"Question: {question}")
    sql = generate_sql(question)
    print(f"Generated SQL:\n{sql}\n")

    with engine.connect() as conn:
        rows = conn.execute(text(sql))
        results = [dict(row._mapping) for row in rows]

    if results:
        headers = list(results[0].keys())
        print("\t".join(headers))
        for row in results:
            print("\t".join(str(v) for v in row.values()))
    else:
        print("(no rows returned)")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_cli(" ".join(sys.argv[1:]))
    else:
        run_api()
