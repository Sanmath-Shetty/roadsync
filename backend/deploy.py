"""Compile + deploy RoadSync.sol to the MST testnet. Run: python deploy.py

Needs in .env: MST_RPC_URL, MST_CHAIN_ID, DEPLOYER_PRIVATE_KEY (testnet demo key!)
Writes: RoadSync.abi.json (for chain.py) and prints CONTRACT_ADDRESS for .env.
The deploying wallet becomes the contract's `agency` (the only approver).
"""
import json
import os
from pathlib import Path

import solcx
from dotenv import load_dotenv
from web3 import Web3

SOL_FILE = Path(__file__).parent.parent / "contracts" / "RoadSync.sol"
ABI_FILE = Path(__file__).parent / "RoadSync.abi.json"
SOLC_VERSION = "0.8.19"


def compile_contract():
    """Returns (abi, bytecode). Downloads the compiler the first time."""
    solcx.install_solc(SOLC_VERSION)
    out = solcx.compile_files(
        [str(SOL_FILE)],
        output_values=["abi", "bin"],
        solc_version=SOLC_VERSION,
        evm_version="paris",  # older EVM target = safest for any EVM testnet
    )
    contract = next(v for k, v in out.items() if k.endswith(":RoadSync"))
    return contract["abi"], contract["bin"]


def deploy(w3, abi, bytecode, account, chain_id):
    """Send the deploy transaction, wait for it, return the contract address."""
    RoadSync = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx = RoadSync.constructor().build_transaction(
        {
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "chainId": chain_id,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print("Deploy tx sent:", tx_hash.hex(), "- waiting...")
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt.status != 1:
        raise SystemExit("Deploy FAILED (reverted). Check gas / balance.")
    return receipt.contractAddress


def main():
    load_dotenv()
    rpc, chain_id, key = (os.getenv(k) for k in ("MST_RPC_URL", "MST_CHAIN_ID", "DEPLOYER_PRIVATE_KEY"))
    if not (rpc and chain_id and key):
        raise SystemExit("Fill MST_RPC_URL, MST_CHAIN_ID, DEPLOYER_PRIVATE_KEY in .env first.")

    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        raise SystemExit(f"Can't reach RPC: {rpc}")
    if w3.eth.chain_id != int(chain_id):
        raise SystemExit(f"Chain ID mismatch: RPC says {w3.eth.chain_id}, .env says {chain_id}")

    account = w3.eth.account.from_key(key)
    balance = w3.from_wei(w3.eth.get_balance(account.address), "ether")
    print(f"Deployer: {account.address}  balance: {balance}")
    if balance == 0:
        raise SystemExit("Balance is 0. Get test tokens from the MST faucet first.")

    print("Compiling...")
    abi, bytecode = compile_contract()
    ABI_FILE.write_text(json.dumps(abi, indent=2))
    print(f"ABI saved to {ABI_FILE.name}")

    address = deploy(w3, abi, bytecode, account, int(chain_id))
    print("\nDEPLOYED! Add this line to .env:")
    print(f"CONTRACT_ADDRESS={address}")


if __name__ == "__main__":
    main()
