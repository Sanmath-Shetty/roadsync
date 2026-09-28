"""Tiny SQLite helper. Geometry is stored as a GeoJSON string."""
import os
import sqlite3
from pathlib import Path

# Always keep the DB next to this file, whatever folder you run from.
DB_PATH = str(Path(__file__).parent / os.getenv("DB_PATH", "roadsync.db"))


def get_conn():
    """Open a connection. Rows behave like dicts (row["id"])."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist yet."""
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS assets (
                id       TEXT PRIMARY KEY,   -- e.g. "gas-1"
                type     TEXT NOT NULL,      -- water | gas | electric | fiber
                geometry TEXT NOT NULL       -- GeoJSON LineString, [lng, lat]
            );
            CREATE TABLE IF NOT EXISTS work_orders (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                org      TEXT NOT NULL,
                geometry TEXT NOT NULL,      -- GeoJSON LineString, [lng, lat]
                start    TEXT NOT NULL,      -- ISO date, e.g. 2026-10-05
                end      TEXT NOT NULL,
                status   TEXT NOT NULL,      -- submitted | conflict | resolved | approved
                chain_id INTEGER,            -- id inside the smart contract
                conflicts TEXT               -- JSON list from the last check
            );
            -- Our copy of what we sent on-chain (each row has a real tx hash).
            CREATE TABLE IF NOT EXISTS events (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                event         TEXT NOT NULL,
                work_order_id INTEGER NOT NULL,
                tx_hash       TEXT NOT NULL,
                timestamp     TEXT NOT NULL
            );
            """
        )
        # Older DBs (from Task 1) lack the new columns: add them.
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(work_orders)")}
        for col in ("chain_id INTEGER", "conflicts TEXT"):
            if col.split()[0] not in cols:
                conn.execute(f"ALTER TABLE work_orders ADD COLUMN {col}")
