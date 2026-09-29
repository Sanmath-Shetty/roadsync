# RoadSync frontend

React + Vite + Leaflet. Talks to the Flask backend (see `../API.md`).

## Run
```
cd frontend
npm install
npm run dev          -> http://localhost:5173
```
The backend must be running (`cd backend && python app.py`).
To point at another backend, copy `.env.example` to `.env` and change `VITE_API_URL`.

## Demo script
0. The landing page shows the live map and a real conflict on the demo road. Hover the legend to spotlight a layer, click to hide it.
1. **Use demo trench** (or **Draw on map**: click points, double-click to finish).
2. **Check route**: gas crossing, pink safer route, MCC coordination.
3. **Submit to MST**: permit and conflict are written on-chain.
4. **Approve as agency**: refused by the contract (conflict still open).
5. **Accept 25 m reroute**, then **Approve as agency** again: approved.
6. **Verify against chain**: matches. **Tamper with database**, verify again: doesn't match.

Map colours follow the APWA locate-paint code used on real roads:
yellow gas, red electric, blue water, orange telecom, white proposed dig, pink survey.

## Files
- `src/App.jsx`: landing/desk views, the 5-step permit flow and all state
- `src/Landing.jsx`: the hero card with live stats
- `src/Legend.jsx`: interactive map layers
- `src/useSpecular.js`: the light that follows the pointer on glass panels
- `src/MapView.jsx`: map, assets, draw tool, conflict markers
- `src/Ledger.jsx`: on-chain history panel
- `src/api.js`: every backend call
- `src/styles.css`: all styling
