from sqlalchemy import inspect, text
from db.connection import engine


def get_schema() -> dict:
    """Return a dict mapping table names to their column definitions."""
    inspector = inspect(engine)
    schema = {}
    for table_name in inspector.get_table_names():
        columns = inspector.get_columns(table_name)
        schema[table_name] = [
            {"name": col["name"], "type": str(col["type"])}
            for col in columns
        ]
    return schema


def schema_to_ddl(schema: dict) -> str:
    """Convert schema dict to a DDL-style string for prompt injection."""
    lines = []
    for table, columns in schema.items():
        col_defs = ", ".join(f"{c['name']} {c['type']}" for c in columns)
        lines.append(f"Table {table} ({col_defs})")
    return "\n".join(lines)
