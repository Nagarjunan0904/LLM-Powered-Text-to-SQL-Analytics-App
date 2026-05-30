"""
Download NYC Yellow Taxi 2023 parquet files and stream them into PostgreSQL.
No CSV files are written to disk — data flows from memory directly via COPY.
"""
import io
import os
import urllib.request

import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/text_to_sql",
)

BASE_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2023-{month:02d}.parquet"

# Column mapping: parquet column → DB column name
COLUMN_MAP = {
    "VendorID": "vendor_id",
    "tpep_pickup_datetime": "pickup_datetime",
    "tpep_dropoff_datetime": "dropoff_datetime",
    "passenger_count": "passenger_count",
    "trip_distance": "trip_distance",
    "RatecodeID": "rate_code_id",
    "store_and_fwd_flag": "store_fwd_flag",
    "PULocationID": "pickup_location_id",
    "DOLocationID": "dropoff_location_id",
    "payment_type": "payment_type",
    "fare_amount": "fare_amount",
    "extra": "extra",
    "mta_tax": "mta_tax",
    "tip_amount": "tip_amount",
    "tolls_amount": "tolls_amount",
    "improvement_surcharge": "improvement_surcharge",
    "total_amount": "total_amount",
    "congestion_surcharge": "congestion_surcharge",
    "airport_fee": "airport_fee",
}

DB_COLUMNS = list(COLUMN_MAP.values())

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS yellow_taxi_trips (
    vendor_id              INTEGER,
    pickup_datetime        TIMESTAMP,
    dropoff_datetime       TIMESTAMP,
    passenger_count        INTEGER,
    trip_distance          NUMERIC(8,2),
    rate_code_id           INTEGER,
    store_fwd_flag         TEXT,
    pickup_location_id     INTEGER,
    dropoff_location_id    INTEGER,
    payment_type           INTEGER,
    fare_amount            NUMERIC(8,2),
    extra                  NUMERIC(8,2),
    mta_tax                NUMERIC(8,2),
    tip_amount             NUMERIC(8,2),
    tolls_amount           NUMERIC(8,2),
    improvement_surcharge  NUMERIC(8,2),
    total_amount           NUMERIC(8,2),
    congestion_surcharge   NUMERIC(8,2),
    airport_fee            NUMERIC(8,2)
);
"""

INDEX_SQLS = [
    "CREATE INDEX IF NOT EXISTS idx_taxi_pickup_datetime     ON yellow_taxi_trips (pickup_datetime);",
    "CREATE INDEX IF NOT EXISTS idx_taxi_payment_type        ON yellow_taxi_trips (payment_type);",
    "CREATE INDEX IF NOT EXISTS idx_taxi_pickup_location_id  ON yellow_taxi_trips (pickup_location_id);",
]


def parse_dsn(url: str) -> dict:
    """Parse a postgresql:// URL into psycopg2 connect kwargs."""
    from urllib.parse import urlparse
    p = urlparse(url)
    return {
        "host": p.hostname,
        "port": p.port or 5432,
        "dbname": p.path.lstrip("/"),
        "user": p.username,
        "password": p.password,
    }


def df_to_csv_buffer(df: pd.DataFrame) -> io.StringIO:
    """Serialize DataFrame to an in-memory CSV buffer (no disk I/O)."""
    # Convert nullable integer columns to object so NA becomes empty string
    for col in df.select_dtypes(include="Int64").columns:
        df[col] = df[col].astype(object).where(df[col].notna(), other=None)
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, na_rep="")
    buf.seek(0)
    return buf


def load_month(cur, month: int) -> int:
    filename = f"yellow_tripdata_2023-{month:02d}.parquet"
    url = BASE_URL.format(month=month)
    print(f"  Downloading {filename} ...", flush=True)

    with urllib.request.urlopen(url) as resp:
        raw = resp.read()

    print(f"  Parsing parquet ({len(raw) / 1_048_576:.1f} MB) ...", flush=True)
    df = pd.read_parquet(io.BytesIO(raw))

    # Keep only known columns, rename to DB names
    present = {k: v for k, v in COLUMN_MAP.items() if k in df.columns}
    df = df[list(present.keys())].rename(columns=present)

    # Ensure all DB columns exist (fill missing with None)
    for col in DB_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df = df[DB_COLUMNS]

    # Coerce numeric columns — clip to NUMERIC(8,2) safe range
    numeric_cols = [
        "trip_distance", "fare_amount", "extra", "mta_tax", "tip_amount",
        "tolls_amount", "improvement_surcharge", "total_amount",
        "congestion_surcharge", "airport_fee",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").clip(-999999.99, 999999.99)

    int_cols = ["vendor_id", "passenger_count", "rate_code_id",
                "pickup_location_id", "dropoff_location_id", "payment_type"]
    for col in int_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").round(0).astype("Int64")

    buf = df_to_csv_buffer(df)
    cols_str = ", ".join(DB_COLUMNS)
    cur.copy_expert(
        f"COPY yellow_taxi_trips ({cols_str}) FROM STDIN WITH (FORMAT CSV, NULL '')",
        buf,
    )
    n = len(df)
    print(f"  Loaded {n:,} rows from {filename}", flush=True)
    return n


def main():
    dsn = parse_dsn(DATABASE_URL)
    conn = psycopg2.connect(**dsn)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            print("Dropping existing table (clean load) ...")
            cur.execute("DROP TABLE IF EXISTS yellow_taxi_trips;")
            print("Creating table ...")
            cur.execute(CREATE_TABLE_SQL)
            conn.commit()

        total = 0
        for month in range(1, 13):
            with conn.cursor() as cur:
                n = load_month(cur, month)
                conn.commit()
            total += n
            print(f"  -> Cumulative rows: {total:,}\n", flush=True)

        print("Creating indexes ...")
        with conn.cursor() as cur:
            for sql in INDEX_SQLS:
                cur.execute(sql)
            conn.commit()

        print(f"\nDone. Total rows loaded: {total:,}")

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
