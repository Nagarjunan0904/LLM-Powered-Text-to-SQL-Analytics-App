"""
Smoke test for Sub-phase 1.3.
Confirms that get_schema_context + generate_sql produce valid SQL without executing it.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/text_to_sql")

from db.schema_extractor import get_schema_context
from llm.sql_generator import generate_sql

print("Connecting to database and extracting schema ...")
eng = create_engine(DATABASE_URL)
ctx = get_schema_context(eng)

print("\n--- Schema (first 400 chars) ---")
print(ctx["schema"][:400])
print("\n--- Sample rows ---")
print(ctx["sample_rows"])

question = "How many trips are in the dataset?"
print(f"\nQuestion: {question}")
print("Calling generate_sql (gpt-4o) ...")

sql = generate_sql(question, ctx["schema"], ctx["sample_rows"])

print(f"\nGenerated SQL:\n{sql}")
print("\nDONE")
