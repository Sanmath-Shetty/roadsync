"""Runs the full RoadSync demo against the running server (python app.py).
Run in a SECOND terminal:  python demo_flow.py
"""
import requests

API = "http://localhost:5000"
TRENCH = {
    "org": "Airtel",
    "start": "2026-10-06",
    "end": "2026-10-08",
    "geometry": {"type": "LineString", "coordinates": [[74.843, 12.875], [74.847, 12.875]]},
}


def call(step, method, path, body=None):
    r = requests.request(method, API + path, json=body, timeout=300)
    print(f"\n== {step}  [{r.status_code}]")
    print(r.json())
    return r.json()


print("Each step sends a real MST transaction, so it may take a few seconds...")
call("0. SERVER + CHAIN INFO", "GET", "/")
res = call("1. SUBMIT (gas conflict expected)", "POST", "/submit", TRENCH)
wo = res.get("work_order_id")
if wo is None:
    raise SystemExit("Submit failed, see error above.")

call("2. APPROVE before fix (contract should REFUSE, 409)", "POST", "/approve", {"work_order_id": wo})
call("3. ACCEPT REROUTE", "POST", "/accept-suggestion", {"work_order_id": wo, "kind": "reroute"})
call("4. APPROVE after fix (should succeed)", "POST", "/approve", {"work_order_id": wo})
call("5. VERIFY record vs chain (verified: True)", "GET", f"/verify/{wo}")
call("6. TAMPER with the DB (demo)", "POST", "/demo/tamper", {"work_order_id": wo})
call("7. VERIFY again (verified: False -> tampering caught)", "GET", f"/verify/{wo}")

print("\n== 8. TIMELINE")
for e in requests.get(API + "/timeline", timeout=30).json():
    print(f"  {e['event']:<20} order {e['work_order_id']}  {e['tx_hash']}")
