"""Synthetic data for the demo. Run once: python seed.py

Layout (all coordinates are [lng, lat], Mangalore, roughly 1 km of road):

    north
      |            water  ------------------------------  (~67 m north of road)
      |                        gas |            electric |
      |  ROAD  ======================+=====================+====   west -> east
      |                        gas |            electric |
      |            fiber  ------------------------------  (~67 m south of road)

The gas and electric lines run north-south and cross the road.
The gas line is a short branch: it ends ~22 m north of the road, so a
small northward offset can dodge it (that's our reroute demo).
The water and fiber lines run parallel to the road, far enough to never clash.
"""
import json

from db import get_conn, init_db

ROAD_LAT = 12.8750  # the road runs west -> east along this latitude

# --- Existing underground assets --------------------------------------------
ASSETS = [
    {
        "id": "gas-1",
        "type": "gas",
        "coords": [[74.8450, 12.8730], [74.8450, 12.8752]],  # crosses road, ends ~22 m north
    },
    {
        "id": "electric-1",
        "type": "electric",
        "coords": [[74.8485, 12.8730], [74.8485, 12.8770]],  # crosses road at 74.8485
    },
    {
        "id": "water-1",
        "type": "water",
        "coords": [[74.8400, 12.8756], [74.8500, 12.8756]],  # parallel, north of road
    },
    {
        "id": "fiber-1",
        "type": "fiber",
        "coords": [[74.8400, 12.8744], [74.8500, 12.8744]],  # parallel, south of road
    },
]

# --- Demo trenches (used by the test and, later, the frontend demo) ---------
# A telecom trench along the road that clearly crosses the gas line
# at [74.8450, 12.8750].
DEMO_TELECOM_LINE = {
    "type": "LineString",
    "coordinates": [[74.8430, ROAD_LAT], [74.8470, ROAD_LAT]],
}

# A trench that stays clear of every asset (between gas and electric).
DEMO_CLEAR_LINE = {
    "type": "LineString",
    "coordinates": [[74.8455, ROAD_LAT], [74.8480, ROAD_LAT]],
}

# --- Existing work order from ANOTHER organization --------------------------
# Overlaps the telecom trench in space, and is planned for the same week,
# so the coordination demo has something to match.
WORK_ORDERS = [
    {
        "org": "MCC (Mangalore City Corporation)",
        "geometry": {
            "type": "LineString",
            "coordinates": [[74.8440, 12.8751], [74.8465, 12.8751]],
        },
        "start": "2026-10-05",
        "end": "2026-10-09",
        "status": "approved",
    },
]


def seed():
    init_db()
    with get_conn() as conn:
        # Wipe first so running the script twice doesn't duplicate rows.
        conn.execute("DELETE FROM assets")
        conn.execute("DELETE FROM work_orders")
        conn.execute("DELETE FROM events")
        conn.execute("DELETE FROM sqlite_sequence")  # restart ids at 1

        for a in ASSETS:
            geometry = {"type": "LineString", "coordinates": a["coords"]}
            conn.execute(
                "INSERT INTO assets (id, type, geometry) VALUES (?, ?, ?)",
                (a["id"], a["type"], json.dumps(geometry)),
            )

        for w in WORK_ORDERS:
            conn.execute(
                "INSERT INTO work_orders (org, geometry, start, end, status) "
                "VALUES (?, ?, ?, ?, ?)",
                (w["org"], json.dumps(w["geometry"]), w["start"], w["end"], w["status"]),
            )

    print(f"Seeded {len(ASSETS)} assets and {len(WORK_ORDERS)} work order(s).")


def assets_as_features():
    """Assets in the GeoJSON Feature shape that GET /assets and engine.py use."""
    return [
        {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": a["coords"]},
            "properties": {"id": a["id"], "type": a["type"]},
        }
        for a in ASSETS
    ]


if __name__ == "__main__":
    seed()
