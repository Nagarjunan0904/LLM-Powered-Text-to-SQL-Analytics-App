import os
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from dotenv import load_dotenv

from db.schema_extractor import get_schema, schema_to_ddl
from llm.prompt_builder import build_prompt

load_dotenv()

_llm = None


def _get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            openai_api_key=os.getenv("OPENAI_API_KEY"),
        )
    return _llm


def generate_sql(question: str) -> str:
    """Translate a natural language question to a SQL query."""
    schema = get_schema()
    schema_ddl = schema_to_ddl(schema)
    messages = build_prompt(schema_ddl, question)

    lc_messages = []
    for m in messages:
        if m["role"] == "system":
            lc_messages.append(SystemMessage(content=m["content"]))
        else:
            lc_messages.append(HumanMessage(content=m["content"]))

    response = _get_llm().invoke(lc_messages)
    return response.content.strip()
