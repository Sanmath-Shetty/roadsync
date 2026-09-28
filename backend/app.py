"""RoadSync Flask API. Run: python app.py  -> http://localhost:5000"""
import json

from flask import Flask, jsonify, request
from flask_cors import CORS

from db import get_conn, init_db
from engine import check_conflicts, find_coordination, suggest_route

app = Flask(__name__)
CORS(app)  # lets the React dev server (another port) call this API


def load_assets():
    """All assets as a GeoJSON FeatureCollection."""
    with get_conn() as conn:
        rows = conn.execute("SELECT id, type, geometry FROM assets").fetchall()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": json.loads(r["geometry"]),
                "properties": {"id": r["id"], "type": r["type"]},
            }
            for r in rows
        ],
    }


def load_work_orders():
    """All work orders as a list of dicts."""
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM work_orders").fetchall()
    return [
        {
            "id": r["id"],
            "org": r["org"],
            "geometry": json.loads(r["geometry"]),
            "start": r["start"],
            "end": r["end"],
            "status": r["status"],
        }
        for r in rows
    ]


@app.get("/assets")
def get_assets():
    return jsonify(load_assets())


@app.get("/work-orders")
def get_work_orders():
    return jsonify(load_work_orders())


@app.post("/check")
def check():
    body = request.get_json(silent=True) or {}

    # Basic validation: we need a LineString with at least 2 points.
    geometry = body.get("geometry") or {}
    if geometry.get("type") != "LineString" or len(geometry.get("coordinates", [])) < 2:
        return jsonify({"error": "geometry must be a GeoJSON LineString"}), 400
    for field in ("org", "start", "end"):
        if not body.get(field):
            return jsonify({"error": f"missing field: {field}"}), 400

    assets = load_assets()
    conflicts = check_conflicts(geometry, assets)

    # Only look for a reroute when there is something to avoid.
    suggested = suggest_route(geometry, assets) if conflicts else None

    coordination = find_coordination(
        geometry, body["start"], body["end"], body["org"], load_work_orders()
    )

    return jsonify(
        {
            "conflicts": conflicts,
            "suggested_route": suggested,
            "coordination": coordination,
        }
    )


if __name__ == "__main__":
    init_db()  # safe: only creates tables if missing
    app.run(debug=True, port=5000)
