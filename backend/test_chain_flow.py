"""Full API + smart contract test on a LOCAL fake chain (no MST, no tokens).

One-time setup:  pip install "web3[tester]"
Run:             python test_chain_flow.py
"""
import json
import os
import tempfile

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")  # never touch the real DB

from eth_account import Account
from web3 import EthereumTesterProvider, Web3

import chain
import deploy
import seed
from app import app
from seed import DEMO_CLEAR_LINE, DEMO_TELECOM_LINE


def setup_chain():
    abi, bytecode = deploy.compile_contract()
    w3 = Web3(EthereumTesterProvider())
    acct = Account.create()
    w3.eth.send_transaction({"from": w3.eth.accounts[0], "to": acct.address,
                             "value": w3.to_wei(10, "ether")})
    address = deploy.deploy(w3, abi, bytecode, acct, w3.eth.chain_id)
    chain.init(w3=w3, account=acct, address=address, abi=abi)


def check(label, cond, got=None):
    print(("PASS: " if cond else "FAIL: ") + label + ("" if cond else f"  -> {got}"))
    assert cond


def main():
    setup_chain()
    seed.seed()
    c = app.test_client()
    body = {"org": "Airtel", "start": "2026-10-06", "end": "2026-10-08", "geometry": DEMO_TELECOM_LINE}

    r = c.post("/submit", json=body); j = r.json; wo = j["work_order_id"]
    check("submit records order + conflict on-chain", r.status_code == 200 and j["conflict_tx_hash"], j)

    r = c.post("/approve", json={"work_order_id": wo})
    check("contract refuses approval while conflict open", r.status_code == 409
          and r.json["error"] == "Conflict unresolved", r.json)

    r = c.post("/accept-suggestion", json={"work_order_id": wo, "kind": "window"})
    check("window cannot fix a pipe crossing", r.status_code == 400, r.json)

    r = c.post("/accept-suggestion", json={"work_order_id": wo, "kind": "reroute"})
    check("reroute resolves on-chain", r.status_code == 200, r.json)

    r = c.post("/approve", json={"work_order_id": wo})
    check("approval succeeds after fix", r.status_code == 200, r.json)

    r = c.post("/approve", json={"work_order_id": wo})
    check("double approval refused", r.status_code == 409, r.json)

    check("verify: untouched record matches chain", c.get(f"/verify/{wo}").json["verified"] is True)
    c.post("/demo/tamper", json={"work_order_id": wo})
    check("verify: tampered record is caught", c.get(f"/verify/{wo}").json["verified"] is False)

    r = c.post("/submit", json={**body, "geometry": DEMO_CLEAR_LINE}); w2 = r.json["work_order_id"]
    check("clear route: no conflict, coordination found",
          r.json["conflict_tx_hash"] is None and len(r.json["coordination"]) == 1, r.json)
    r = c.post("/accept-suggestion", json={"work_order_id": w2, "kind": "window"})
    check("window accepted, dates moved to MCC window", r.status_code == 200
          and r.json["work_order"]["start"] == "2026-10-05", r.json)
    check("clear route approves", c.post("/approve", json={"work_order_id": w2}).status_code == 200)

    events = [e["event"] for e in c.get("/timeline").json]
    check("timeline has all events", events.count("WorkOrderApproved") == 2, events)
    check("seeded order can't be approved (never on-chain)",
          c.post("/approve", json={"work_order_id": 1}).status_code == 400)
    check("bad input -> 400", c.post("/check", json={}).status_code == 400)
    check("index page works", c.get("/").status_code == 200)
    print("\nALL CHAIN FLOW TESTS PASSED")


if __name__ == "__main__":
    main()
