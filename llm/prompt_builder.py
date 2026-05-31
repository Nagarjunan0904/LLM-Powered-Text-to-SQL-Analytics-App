from langchain_core.prompts import ChatPromptTemplate

# ---------------------------------------------------------------------------
# Core prompt — natural language → SQL
# ---------------------------------------------------------------------------
_CORE_SYSTEM = (
    "You are a PostgreSQL expert. "
    "Your ONLY job is to write a single, valid PostgreSQL SELECT query that answers the user's question.\n\n"
    "STRICT OUTPUT RULES — violating any rule is a failure:\n"
    "  • Output the raw SQL statement and nothing else.\n"
    "  • Do NOT wrap the SQL in markdown code fences (``` or ```sql).\n"
    "  • Do NOT add any explanation, commentary, preamble, or trailing text.\n"
    "  • Use ONLY the tables and columns listed in the schema below.\n"
    "  • Never emit INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or TRUNCATE.\n"
    "  • Prefer explicit column names over SELECT *."
)

_CORE_HUMAN = (
    "Schema:\n{schema}\n\n"
    "Sample rows:\n{sample_rows}\n\n"
    "Question: {question}\n\n"
    "SQL:"
)

CORE_PROMPT_TEMPLATE = ChatPromptTemplate.from_messages(
    [("system", _CORE_SYSTEM), ("human", _CORE_HUMAN)]
)


def build_core_prompt(schema: str, sample_rows: str, question: str) -> str:
    """Return the fully formatted prompt string for the core SQL generation task."""
    messages = CORE_PROMPT_TEMPLATE.format_messages(
        schema=schema,
        sample_rows=sample_rows,
        question=question,
    )
    # Render as a plain string (system block + human block)
    return "\n\n".join(m.content for m in messages)


# ---------------------------------------------------------------------------
# Correction prompt — fix a previously generated SQL that errored
# ---------------------------------------------------------------------------
_CORRECTION_SYSTEM = (
    "You are a PostgreSQL expert. "
    "A SQL query was generated but failed to execute. "
    "Your ONLY job is to return the corrected SQL.\n\n"
    "STRICT OUTPUT RULES:\n"
    "  • Output the corrected raw SQL statement and nothing else.\n"
    "  • Do NOT wrap it in markdown code fences.\n"
    "  • Do NOT add explanation, commentary, or any other text.\n"
    "  • Use ONLY the tables and columns listed in the schema."
)

_CORRECTION_HUMAN = (
    "Schema:\n{schema}\n\n"
    "Failed SQL:\n{failed_sql}\n\n"
    "Error message:\n{error_message}\n\n"
    "Corrected SQL:"
)

CORRECTION_PROMPT_TEMPLATE = ChatPromptTemplate.from_messages(
    [("system", _CORRECTION_SYSTEM), ("human", _CORRECTION_HUMAN)]
)


def build_correction_prompt(failed_sql: str, error_message: str, schema: str) -> str:
    """Return the fully formatted prompt string for the SQL correction task."""
    messages = CORRECTION_PROMPT_TEMPLATE.format_messages(
        failed_sql=failed_sql,
        error_message=error_message,
        schema=schema,
    )
    return "\n\n".join(m.content for m in messages)
