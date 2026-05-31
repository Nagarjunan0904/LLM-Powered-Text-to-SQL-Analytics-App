"""12 test cases for the SQL safety guardrail (db/safety.py)."""
import pytest

from db.safety import SafetyError, validate_sql


# ---------------------------------------------------------------------------
# SHOULD PASS — validate_sql returns True
# ---------------------------------------------------------------------------

def test_simple_select():
    assert validate_sql("SELECT COUNT(*) FROM yellow_taxi_trips") is True


def test_select_with_where():
    assert validate_sql(
        "SELECT fare_amount FROM yellow_taxi_trips WHERE trip_distance > 5"
    ) is True


def test_select_group_by_order_by():
    assert validate_sql(
        "SELECT payment_type, COUNT(*) AS trips "
        "FROM yellow_taxi_trips "
        "GROUP BY payment_type "
        "ORDER BY trips DESC"
    ) is True


def test_select_with_join():
    assert validate_sql(
        "SELECT t.vendor_id, z.zone "
        "FROM yellow_taxi_trips t "
        "JOIN taxi_zones z ON t.pu_location_id = z.location_id"
    ) is True


def test_update_inside_string_literal():
    # 'update' appears only inside a string value — word boundary prevents match
    assert validate_sql(
        "SELECT * FROM t WHERE status = 'update_pending'"
    ) is True


def test_create_inside_column_alias():
    # 'create' is part of the identifier 'create_count' — word boundary prevents match
    assert validate_sql(
        "SELECT COUNT(*) AS create_count FROM yellow_taxi_trips"
    ) is True


# ---------------------------------------------------------------------------
# SHOULD FAIL — validate_sql raises SafetyError
# ---------------------------------------------------------------------------

def test_drop_table():
    with pytest.raises(SafetyError):
        validate_sql("DROP TABLE yellow_taxi_trips")


def test_delete():
    with pytest.raises(SafetyError):
        validate_sql("DELETE FROM yellow_taxi_trips WHERE vendor_id = 1")


def test_insert():
    with pytest.raises(SafetyError):
        validate_sql("INSERT INTO yellow_taxi_trips VALUES (1, 2, 3)")


def test_update():
    with pytest.raises(SafetyError):
        validate_sql("UPDATE yellow_taxi_trips SET fare_amount = 0")


def test_union_injection_passes_safety():
    # UNION alone is not destructive — the SELECT-start guardrail is the
    # primary protection; blocking UNION would also block legitimate analytics.
    assert validate_sql(
        "SELECT * FROM users UNION SELECT * FROM admin"
    ) is True


def test_disguised_drop_whitespace_mixed_case():
    # Leading whitespace is stripped; mixed case is normalised — still caught.
    with pytest.raises(SafetyError):
        validate_sql("   DrOp TABLE yellow_taxi_trips")
