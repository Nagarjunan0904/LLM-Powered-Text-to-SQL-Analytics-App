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


def get_schema_context(eng=None) -> str:
    """
    Build a human-readable schema context string for LLM prompt injection.

    For each user-defined table this function:
    1. Queries information_schema.tables to list tables.
    2. Queries information_schema.columns for column names + data types.
    3. Fetches one sample row via SELECT * ... LIMIT 1.

    Returns a formatted multi-line string, e.g.:
        Table: yellow_taxi_trips (columns: pickup_datetime timestamp, fare_amount numeric, ...)
        Sample row: (2023-01-01 08:23:11, 12.50, 2.00, ...)
    """
    if eng is None:
        eng = engine

    with eng.connect() as conn:
        # 1. List user tables
        tables_result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "ORDER BY table_name"
            )
        )
        table_names = [row[0] for row in tables_result]

        blocks = []
        for table in table_names:
            # 2. Fetch column metadata
            cols_result = conn.execute(
                text(
                    "SELECT column_name, data_type "
                    "FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = :t "
                    "ORDER BY ordinal_position"
                ),
                {"t": table},
            )
            columns = [(row[0], row[1]) for row in cols_result]
            col_str = ", ".join(f"{name} {dtype}" for name, dtype in columns)

            # 3. One sample row
            sample_result = conn.execute(
                text(f"SELECT * FROM {table} LIMIT 1")  # noqa: S608
            )
            row = sample_result.fetchone()
            if row:
                sample_str = "(" + ", ".join(str(v) for v in row) + ")"
            else:
                sample_str = "(no rows)"

            blocks.append(
                f"Table: {table} (columns: {col_str})\n"
                f"Sample row: {sample_str}"
            )

    return "\n\n".join(blocks)
