"""RoadSync Flask API. Run: python app.py  -> http://localhost:5000

Flow: /check -> /submit -> /accept-suggestion -> /approve, and /timeline.
"""
import json
import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

import chain
from db import get_conn, init_db
from engine import check_conflicts, find_coordination, suggest_route

app = Flask(__name__)
CORS(app)  # lets the React dev server (another port) call this API


@app.errorhandler(Exception)
def handle_error(e):
    """Any crash -> JSON (not an HTML page), so the frontend can show it."""
    code = getattr(e, "code", 500)
    if not isinstance(code, int):
        code = 500
    return jsonify({"error": str(e)}), code


# --- Loading helpers ----------------------------------------------------------
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


def _row_to_order(r):
    return {
        "id": r["id"],
        "org": r["org"],
        "geometry": json.loads(r["geometry"]),
        "start": r["start"],
        "end": r["end"],
        "status": r["status"],
    }


def load_work_orders():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM work_orders").fetchall()
    return [_row_to_order(r) for r in rows]


def get_order(order_id):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM work_orders WHERE id = ?", (order_id,)).fetchone()


def log_event(event, order_id, tx_hash):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO events (event, work_order_id, tx_hash, timestamp) VALUES (?, ?, ?, ?)",
            (event, order_id, tx_hash, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )


def record_payload(wo):
    """What we hash on-chain for a work order. Same fields every time, so
    /verify can re-hash today's DB row and compare it to the chain."""
    return {
        "work_order_id": wo["id"],
        "org": wo["org"],
        "geometry": wo["geometry"],
        "start": wo["start"],
        "end": wo["end"],
    }


def explorer_link(tx_hash):
    base = os.getenv("EXPLORER_URL", "").rstrip("/")
    return f"{base}/tx/{tx_hash}" if base else None


def run_check(org, geometry, start, end, exclude_id=None):
    """The full check: conflicts + reroute + coordination."""
    assets = load_assets()
    conflicts = check_conflicts(geometry, assets)
    others = [w for w in load_work_orders() if w["id"] != exclude_id]
    return {
        "conflicts": conflicts,
        "suggested_route": suggest_route(geometry, assets) if conflicts else None,
        "coordination": find_coordination(geometry, start, end, org, others),
    }


def validate(body):
    """Returns an error string, or None if the body is fine."""
    geometry = body.get("geometry") or {}
    if geometry.get("type") != "LineString" or len(geometry.get("coordinates", [])) < 2:
        return "geometry must be a GeoJSON LineString"
    for field in ("org", "start", "end"):
        if not body.get(field):
            return f"missing field: {field}"
    return None


def chain_error(e):
    """Contract said no -> 409 with its reason (e.g. 'Conflict unresolved')."""
    return jsonify({"error": e.reason, "enforced_by": "smart contract"}), 409


# --- Read endpoints -------------------------------------------------------------
@app.get("/assets")
def get_assets():
    return jsonify(load_assets())


@app.get("/work-orders")
def get_work_orders():
    return jsonify(load_work_orders())


@app.get("/timeline")
def timeline():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM events ORDER BY id").fetchall()
    return jsonify(
        [
            {
                "event": r["event"],
                "work_order_id": r["work_order_id"],
                "tx_hash": r["tx_hash"],
                "timestamp": r["timestamp"],
                "explorer": explorer_link(r["tx_hash"]),
            }
            for r in rows
        ]
    )


# --- Check (no blockchain) ----------------------------------------------------
@app.post("/check")
def check():
    body = request.get_json(silent=True) or {}
    if err := validate(body):
        return jsonify({"error": err}), 400
    return jsonify(run_check(body["org"], body["geometry"], body["start"], body["end"]))


# --- Chain endpoints ------------------------------------------------------------
@app.post("/submit")
def submit():
    """Save the order, hash it on-chain, and record a conflict if there is one."""
    body = request.get_json(silent=True) or {}
    if err := validate(body):
        return jsonify({"error": err}), 400

    result = run_check(body["org"], body["geometry"], body["start"], body["end"])
    has_conflict = bool(result["conflicts"])

    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO work_orders (org, geometry, start, end, status, conflicts) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (body["org"], json.dumps(body["geometry"]), body["start"], body["end"],
             "submitted", json.dumps(result["conflicts"])),
        )
        order_id = cur.lastrowid

    try:
        chain_id, tx_hash = chain.submit_work_order(
            record_payload({"id": order_id, **{k: body[k] for k in ("org", "geometry", "start", "end")}})
        )
    except Exception as e:
        # Chain unreachable: don't leave a half-saved order behind.
        with get_conn() as conn:
            conn.execute("DELETE FROM work_orders WHERE id = ?", (order_id,))
        return jsonify({"error": f"blockchain error: {e}"}), 502
    log_event("WorkOrderSubmitted", order_id, tx_hash)

    conflict_tx = None
    if has_conflict:
        conflict_tx = chain.record_conflict(
            chain_id, {"work_order_id": order_id, "conflicts": result["conflicts"]}
        )
        log_event("ConflictRecorded", order_id, conflict_tx)

    with get_conn() as conn:
        conn.execute(
            "UPDATE work_orders SET chain_id = ?, status = ? WHERE id = ?",
            (chain_id, "conflict" if has_conflict else "submitted", order_id),
        )

    return jsonify({"work_order_id": order_id, "tx_hash": tx_hash,
                    "conflict_tx_hash": conflict_tx, **result})


@app.post("/accept-suggestion")
def accept_suggestion():
    """Apply the reroute (new geometry) or window (new dates), resolve on-chain."""
    body = request.get_json(silent=True) or {}
    order = get_order(body.get("work_order_id"))
    kind = body.get("kind")
    if not order:
        return jsonify({"error": "unknown work_order_id"}), 404
    if order["chain_id"] is None:
        return jsonify({"error": "this order was never submitted on-chain"}), 400
    if kind not in ("reroute", "window"):
        return jsonify({"error": "kind must be 'reroute' or 'window'"}), 400

    wo = _row_to_order(order)
    result = run_check(wo["org"], wo["geometry"], wo["start"], wo["end"], exclude_id=wo["id"])

    if kind == "reroute":
        if not result["suggested_route"]:
            return jsonify({"error": "no reroute available for this order"}), 400
        wo["geometry"] = result["suggested_route"]["geometry"]
    else:
        if result["conflicts"]:
            # A shared dig window does not move you away from a gas pipe.
            return jsonify({"error": "a dig window does not fix an asset conflict; use reroute"}), 400
        if not result["coordination"]:
            return jsonify({"error": "no coordination match for this order"}), 400
        window = result["coordination"][0]["suggested_window"]
        wo["start"], wo["end"] = window["start"], window["end"]

    # Double-check the fix really is conflict-free before telling the chain.
    remaining = check_conflicts(wo["geometry"], load_assets())
    if remaining:
        return jsonify({"error": "fix still has conflicts", "conflicts": remaining}), 400

    tx_hash = chain.resolve_conflict(order["chain_id"], record_payload(wo))
    log_event("ConflictResolved", wo["id"], tx_hash)

    with get_conn() as conn:
        conn.execute(
            "UPDATE work_orders SET geometry = ?, start = ?, end = ?, status = ?, conflicts = ? "
            "WHERE id = ?",
            (json.dumps(wo["geometry"]), wo["start"], wo["end"], "resolved", "[]", wo["id"]),
        )
    return jsonify({"tx_hash": tx_hash, "work_order": {**wo, "status": "resolved"}})


@app.post("/approve")
def approve():
    """Agency approval. The CONTRACT refuses if a conflict is still open."""
    body = request.get_json(silent=True) or {}
    order = get_order(body.get("work_order_id"))
    if not order:
        return jsonify({"error": "unknown work_order_id"}), 404
    if order["chain_id"] is None:
        return jsonify({"error": "this order was never submitted on-chain"}), 400

    try:
        tx_hash = chain.approve_work_order(order["chain_id"], record_payload(_row_to_order(order)))
    except chain.ChainError as e:
        return chain_error(e)

    log_event("WorkOrderApproved", order["id"], tx_hash)
    with get_conn() as conn:
        conn.execute("UPDATE work_orders SET status = 'approved' WHERE id = ?", (order["id"],))
    return jsonify({"tx_hash": tx_hash})


# --- Tamper-proof check ---------------------------------------------------------
@app.get("/verify/<int:order_id>")
def verify(order_id):
    """Re-hash the DB record and compare with the hash stored on MST.
    If anyone edited the DB after the last on-chain event, verified = false."""
    order = get_order(order_id)
    if not order:
        return jsonify({"error": "unknown work_order_id"}), 404
    with get_conn() as conn:
        ev = conn.execute(
            "SELECT * FROM events WHERE work_order_id = ? AND event != 'ConflictRecorded' "
            "ORDER BY id DESC LIMIT 1",
            (order_id,),
        ).fetchone()
    if not ev:
        return jsonify({"error": "this order has nothing on-chain yet"}), 400

    db_hash = chain.hash_payload(record_payload(_row_to_order(order)))
    chain_hash = chain.read_event_hash(ev["tx_hash"], ev["event"])
    return jsonify(
        {
            "work_order_id": order_id,
            "verified": db_hash == chain_hash,
            "db_hash": "0x" + db_hash.hex().removeprefix("0x"),
            "chain_hash": "0x" + chain_hash.hex().removeprefix("0x") if chain_hash else None,
            "checked_against": ev["event"],
            "tx_hash": ev["tx_hash"],
            "explorer": explorer_link(ev["tx_hash"]),
        }
    )


@app.post("/demo/tamper")
def demo_tamper():
    """DEMO ONLY: secretly edit a work order's end date in the DB (not on-chain).
    Then call /verify/<id> to show the chain catches it."""
    body = request.get_json(silent=True) or {}
    order = get_order(body.get("work_order_id"))
    if not order:
        return jsonify({"error": "unknown work_order_id"}), 404
    with get_conn() as conn:
        conn.execute("UPDATE work_orders SET end = '2026-12-31' WHERE id = ?", (order["id"],))
    return jsonify({"tampered": True, "work_order_id": order["id"], "new_end": "2026-12-31"})


@app.get("/")
def index():
    """Friendly landing page instead of a 404."""
    try:
        chain_info = chain.info()
    except Exception as e:  # server still works for /check without the chain
        chain_info = {"error": f"chain not connected: {e}"}
    return jsonify(
        {
            "service": "RoadSync API",
            "chain": chain_info,
            "endpoints": [
                "GET /assets", "GET /work-orders", "POST /check", "POST /submit",
                "POST /accept-suggestion", "POST /approve", "GET /timeline",
                "GET /verify/<id>", "POST /demo/tamper",
            ],
        }
    )


if __name__ == "__main__":
    init_db()  # safe: creates tables / adds columns if missing
    app.run(debug=True, port=5000)
