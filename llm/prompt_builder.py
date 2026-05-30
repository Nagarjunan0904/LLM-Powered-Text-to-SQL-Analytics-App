SYSTEM_PROMPT = """You are an expert SQL analyst. Given a database schema and a natural language question,
generate a single valid PostgreSQL SELECT query that answers the question.

Rules:
- Return ONLY the SQL query, no explanation or markdown.
- Use only tables and columns present in the schema.
- Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or TRUNCATE.
- Prefer explicit column names over SELECT *.
"""


def build_prompt(schema_ddl: str, question: str) -> list[dict]:
    """Build the messages list for the LLM chat completion."""
    user_content = f"""Schema:
{schema_ddl}

Question: {question}

SQL Query:"""

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
