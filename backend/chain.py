"""web3.py helpers: talk to the deployed RoadSync contract on MST testnet.

Only HASHES go on-chain. Each function sends one transaction and returns
the tx hash (hex string) once it is mined.
"""
import json
import os
import re
import threading
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import ContractLogicError

HERE = Path(__file__).parent
load_dotenv(HERE / ".env")

_lock = threading.Lock()  # one tx at a time, so nonces never clash
_state = {}               # w3, account, contract, chain_id (filled by init)


class ChainError(Exception):
    """A transaction was rejected. .reason holds the contract's message."""

    def __init__(self, reason):
        super().__init__(reason)
        self.reason = reason


def init(w3=None, account=None, address=None, abi=None):
    """Connect once. Arguments are only for tests; normally .env is used."""
    w3 = w3 or Web3(Web3.HTTPProvider(os.environ["MST_RPC_URL"]))
    account = account or w3.eth.account.from_key(os.environ["DEPLOYER_PRIVATE_KEY"])
    address = address or os.environ["CONTRACT_ADDRESS"]
    abi = abi or json.loads((HERE / "RoadSync.abi.json").read_text())
    _state.update(
        w3=w3,
        account=account,
        contract=w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi),
        chain_id=w3.eth.chain_id,
    )


def _get():
    if not _state:
        init()
    return _state


def hash_payload(payload):
    """Fingerprint of any JSON-able dict -> bytes32. Same data = same hash."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return Web3.keccak(text=canonical)

def _reason(e):
    """Pull 'Conflict unresolved' out of web3's longer error text."""
    msg = str(e.args[0] if e.args else e)
    m = re.search(r"revert(?:ed)?:?\s*(.+)", msg)
    reason = m.group(1) if m else msg
    return reason.split(": 0x")[0].split(",")[0].strip(" '\"")


def _send(fn):
    """Build, sign, send a contract call. Returns the mined receipt."""
    s = _get()
    w3, acct = s["w3"], s["account"]
    with _lock:
        try:
            # build_transaction also simulates the call, so a `require`
            # failure shows up HERE with the contract's reason string.
            tx = fn.build_transaction(
                {
                    "from": acct.address,
                    "nonce": w3.eth.get_transaction_count(acct.address, "pending"),
                    "chainId": s["chain_id"],
                    "gasPrice": w3.eth.gas_price,
                }
            )
        except Exception as e:  # different RPCs raise different error types
            if isinstance(e, ContractLogicError) or "revert" in str(e).lower():
                raise ChainError(_reason(e)) from e
            raise
        signed = acct.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise ChainError("Transaction reverted")
    return receipt


def _hex(receipt):
    h = receipt.transactionHash.hex()
    return h if h.startswith("0x") else "0x" + h


# --- The 4 contract actions --------------------------------------------------
def submit_work_order(payload):
    """Returns (on_chain_id, tx_hash)."""
    c = _get()["contract"]
    receipt = _send(c.functions.submitWorkOrder(hash_payload(payload)))
    event = c.events.WorkOrderSubmitted().process_receipt(receipt)[0]
    return event["args"]["id"], _hex(receipt)


def record_conflict(chain_id, payload):
    c = _get()["contract"]
    return _hex(_send(c.functions.recordConflict(chain_id, hash_payload(payload))))


def resolve_conflict(chain_id, payload):
    c = _get()["contract"]
    return _hex(_send(c.functions.resolveConflict(chain_id, hash_payload(payload))))


def approve_work_order(chain_id, payload):
    """Raises ChainError('Conflict unresolved') if the contract refuses."""
    c = _get()["contract"]
    return _hex(_send(c.functions.approveWorkOrder(chain_id, hash_payload(payload))))


# --- Reading back from the chain (for /verify) --------------------------------
def read_event_hash(tx_hash, event_name):
    """Fetch a mined tx from the chain and return the bytes32 hash its event stored."""
    s = _get()
    receipt = s["w3"].eth.get_transaction_receipt(tx_hash)
    events = getattr(s["contract"].events, event_name)().process_receipt(receipt)
    return events[0]["args"]["hash"] if events else None


def info():
    """Public facts for the / endpoint (never the key)."""
    s = _get()
    return {
        "chain_id": s["chain_id"],
        "contract": s["contract"].address,
        "agency": s["account"].address,
    }
