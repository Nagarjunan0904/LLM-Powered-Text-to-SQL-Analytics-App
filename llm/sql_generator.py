import os
import re

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

from llm.prompt_builder import CORE_PROMPT_TEMPLATE

load_dotenv()

_llm = None


def _get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
        )
    return _llm


def _strip_fences(text: str) -> str:
    """Remove any ```sql ... ``` or ``` ... ``` wrappers the model may emit."""
    text = text.strip()
    # Remove opening fence (```sql or ```)
    text = re.sub(r"^```(?:sql)?\s*\n?", "", text, flags=re.IGNORECASE)
    # Remove closing fence
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def generate_sql(question: str, schema: str, sample_rows: str) -> str:
    """
    Translate a natural language question into a PostgreSQL SELECT query.

    Uses the LCEL chain: CORE_PROMPT_TEMPLATE | ChatOpenAI(gpt-4o)

    Args:
        question:    The natural language question to answer.
        schema:      Schema string from get_schema_context()["schema"].
        sample_rows: Sample rows string from get_schema_context()["sample_rows"].

    Returns:
        A clean SQL string with no markdown fences or commentary.
    """
    chain = CORE_PROMPT_TEMPLATE | _get_llm()
    response = chain.invoke(
        {"schema": schema, "sample_rows": sample_rows, "question": question}
    )
    return _strip_fences(response.content)
