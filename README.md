# RoadSync

Before a utility digs a trench, RoadSync checks the route against underground assets and other
organizations' planned work, suggests a safer route or a shared dig window, and records every key
decision on the **MST Blockchain** as a hash. The smart contract refuses approval while a conflict
is unresolved. All data is synthetic (Mangalore).

**Contract (MST testnet, chain 91562037):** `0x58a25Ae76b410847ebAF65cA870Ce32512EcD788`

## Run the backend
```
cd backend
python -m venv venv
venv\Scripts\activate          (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         then fill in DEPLOYER_PRIVATE_KEY + CONTRACT_ADDRESS
python seed.py                 (also resets the demo data)
python app.py                  -> http://localhost:5000
```
Second terminal: `python demo_flow.py` runs the whole flow on MST.

## Tests
- `python test_engine.py` – geometry engine
- `python test_chain_flow.py` – full API + contract on a local fake chain (`pip install "web3[tester]"` once)

## Layout
- `contracts/RoadSync.sol` – smart contract
- `backend/engine.py` – conflicts, reroute, coordination (Shapely + UTM)
- `backend/chain.py` – web3.py calls to MST
- `backend/app.py` – Flask API (see `API.md`)
- `backend/deploy.py` – compile + deploy the contract
