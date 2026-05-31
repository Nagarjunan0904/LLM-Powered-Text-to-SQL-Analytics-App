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


def get_schema_context(eng=None) -> dict:
    """
    Return schema metadata and sample rows as two separate strings,
    ready to be passed as individual arguments to generate_sql().

    Returns:
        {
          "schema":      "Table: yellow_taxi_trips (columns: vendor_id integer, ...)",
          "sample_rows": "yellow_taxi_trips: (2, 2023-01-01 00:32:10, ...)",
        }
    """
    if eng is None:
        eng = engine

    schema_lines = []
    sample_lines = []

    with eng.connect() as conn:
        tables_result = conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "ORDER BY table_name"
            )
        )
        table_names = [row[0] for row in tables_result]

        for table in table_names:
            # Column metadata
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
            schema_lines.append(f"Table: {table} (columns: {col_str})")

            # One sample row
            sample_result = conn.execute(
                text(f"SELECT * FROM {table} LIMIT 1")  # noqa: S608
            )
            row = sample_result.fetchone()
            if row:
                sample_lines.append(
                    f"{table}: (" + ", ".join(str(v) for v in row) + ")"
                )
            else:
                sample_lines.append(f"{table}: (no rows)")

    return {
        "schema": "\n".join(schema_lines),
        "sample_rows": "\n".join(sample_lines),
    }
