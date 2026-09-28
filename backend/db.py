"""Tiny SQLite helper. Geometry is stored as a GeoJSON string."""
import os
import sqlite3

DB_PATH = os.getenv("DB_PATH", "roadsync.db")


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
                status   TEXT NOT NULL       -- submitted | approved
            );
            """
        )
