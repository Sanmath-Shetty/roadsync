# RoadSync API (for the frontend)

Base URL: `http://localhost:5000` · JSON everywhere · coordinates are **[lng, lat]** · CORS is on.
Errors always come back as `{"error": "..."}`.

## Demo flow (in this order)
1. `GET /assets` + `GET /work-orders` → draw pipes/cables and other orgs' work on the map
2. Worker draws a line → `POST /check` → show conflicts (red dots), suggested route (green line), coordination
3. Worker clicks **Submit** → `POST /submit` → save `work_order_id`
4. (Optional drama) Agency clicks **Approve** now → `409 Conflict unresolved` from the smart contract
5. Worker clicks **Accept reroute** (or **Accept window**) → `POST /accept-suggestion`
6. Agency clicks **Approve** → `POST /approve` → success
7. `GET /timeline` → list of on-chain events with tx hashes
8. `GET /verify/<id>` → green "Verified on MST" badge (`/demo/tamper` then verify again → red)

Chain calls (`/submit`, `/accept-suggestion`, `/approve`) take a few seconds: **show a spinner**.

---

### GET /assets
GeoJSON FeatureCollection. `properties: {id, type}`, type = `water | gas | electric | fiber`.
Suggested colours: gas = yellow, water = blue, electric = red, fiber = orange.

### GET /work-orders
`[{id, org, geometry, start, end, status}]` · status = `submitted | conflict | resolved | approved`

### POST /check  (no blockchain, instant)
```json
{"org": "Airtel", "start": "2026-10-06", "end": "2026-10-08",
 "geometry": {"type": "LineString", "coordinates": [[74.843, 12.875], [74.847, 12.875]]}}
```
→
```json
{"conflicts": [{"asset_id": "gas-1", "type": "gas", "point": [74.845, 12.875]}],
 "suggested_route": {"geometry": {"type": "LineString", "coordinates": [[74.843, 12.875226], [74.847, 12.875226]]}, "offset_m": 25},
 "coordination": [{"order_id": 1, "org": "MCC (Mangalore City Corporation)", "start": "2026-10-05", "end": "2026-10-09",
                   "suggested_window": {"start": "2026-10-05", "end": "2026-10-09"}}]}
```
`suggested_route` is `null` when there is no conflict.

### POST /submit  (same body as /check)
→ everything /check returns, plus
`{"work_order_id": 2, "tx_hash": "0x…", "conflict_tx_hash": "0x…" | null}`

### POST /accept-suggestion
`{"work_order_id": 2, "kind": "reroute" | "window"}` → `{"tx_hash": "0x…", "work_order": {…updated…}}`
- `reroute`: geometry replaced by the safe route
- `window`: dates moved to the other org's window. **400** if there is still an asset conflict (use reroute).

### POST /approve
`{"work_order_id": 2}` → `{"tx_hash": "0x…"}`
**409** `{"error": "Conflict unresolved", "enforced_by": "smart contract"}` if not fixed yet. Show this nicely: it's the key demo moment.

### GET /timeline
`[{event, work_order_id, tx_hash, timestamp, explorer}]` · `explorer` is a link or `null`.

### GET /verify/<id>
`{"verified": true|false, "db_hash": "0x…", "chain_hash": "0x…", "checked_against": "WorkOrderApproved", "tx_hash": "0x…", "explorer": …}`

### POST /demo/tamper  (demo only)
`{"work_order_id": 2}` → secretly changes the order's end date in the DB. Call `/verify/<id>` after: `verified: false`.

### GET /
Service info: chain id, contract address, agency wallet, endpoint list.
