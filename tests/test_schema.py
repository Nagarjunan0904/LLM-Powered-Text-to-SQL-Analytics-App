"""Unit tests for db/schema_extractor.get_schema_context() using a mock engine."""
from unittest.mock import MagicMock, patch, call
import pytest

from db.schema_extractor import get_schema_context

TABLE_NAME = "yellow_taxi_trips"
COLUMNS = [("pickup_datetime", "timestamp without time zone"), ("fare_amount", "numeric")]
SAMPLE_ROW = ("2023-01-01 08:23:11", "12.50")


def _make_mock_engine():
    """Build a mock SQLAlchemy engine whose .connect() context manager works."""
    mock_conn = MagicMock()
    mock_ctx = MagicMock()
    mock_ctx.__enter__ = MagicMock(return_value=mock_conn)
    mock_ctx.__exit__ = MagicMock(return_value=False)

    mock_engine = MagicMock()
    mock_engine.connect.return_value = mock_ctx

    def execute_side_effect(stmt, params=None):
        sql = str(stmt).lower()
        result = MagicMock()
        if "information_schema.tables" in sql:
            result.__iter__ = MagicMock(return_value=iter([(TABLE_NAME,)]))
        elif "information_schema.columns" in sql:
            result.__iter__ = MagicMock(return_value=iter(COLUMNS))
        else:
            # sample row query
            result.fetchone.return_value = SAMPLE_ROW
        return result

    mock_conn.execute.side_effect = execute_side_effect
    return mock_engine


def test_returns_non_empty_string():
    """get_schema_context() must return a non-empty string."""
    result = get_schema_context(_make_mock_engine())
    assert isinstance(result, str)
    assert len(result.strip()) > 0


def test_string_contains_table_name():
    """The output must mention the table name."""
    result = get_schema_context(_make_mock_engine())
    assert TABLE_NAME in result


def test_string_contains_column_name():
    """The output must contain at least one column name from the schema."""
    result = get_schema_context(_make_mock_engine())
    column_names = [col[0] for col in COLUMNS]
    assert any(col in result for col in column_names), (
        f"None of {column_names} found in output:\n{result}"
    )
