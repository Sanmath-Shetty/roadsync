// src/mockData.js
// Fake data shaped EXACTLY like the Flask API responses.
// All coordinates are [lng, lat] (GeoJSON order), like the API contract.

// Map center is the only place we use [lat, lng] (Leaflet order).
// Placeholder near Hampankatta, Mangaluru. Replace with your road later.
export const MAP_CENTER = [12.9141, 74.856]; // [lat, lng]
export const MAP_ZOOM = 18;

// Colors used by the map AND the legend, so they always match.
export const ASSET_COLORS = {
  gas: "#e53935",      // red
  water: "#1e88e5",    // blue
  electric: "#f5c400", // yellow
  fiber: "#43a047",    // green
};

// GET /assets -> GeoJSON FeatureCollection
// Four lines run east-west (about 10 m apart), one gas branch runs north-south.
export const MOCK_ASSETS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "GAS-101", type: "gas" },
      geometry: {
        type: "LineString",
        coordinates: [[74.854, 12.91425], [74.858, 12.91425]],
      },
    },
    {
      type: "Feature",
      properties: { id: "WTR-202", type: "water" },
      geometry: {
        type: "LineString",
        coordinates: [[74.854, 12.91415], [74.858, 12.91415]],
      },
    },
    {
      type: "Feature",
      properties: { id: "ELC-303", type: "electric" },
      geometry: {
        type: "LineString",
        coordinates: [[74.854, 12.91405], [74.858, 12.91405]],
      },
    },
    {
      type: "Feature",
      properties: { id: "FBR-404", type: "fiber" },
      geometry: {
        type: "LineString",
        coordinates: [[74.854, 12.91395], [74.858, 12.91395]],
      },
    },
    {
      // North-south gas branch: a trench drawn east-west will cross it
      type: "Feature",
      properties: { id: "GAS-102", type: "gas" },
      geometry: {
        type: "LineString",
        coordinates: [[74.856, 12.9133], [74.856, 12.9152]],
      },
    },
  ],
};

// GET /work-orders -> other organizations' planned work
export const MOCK_WORK_ORDERS = [
  {
    id: "WO-2291",
    org: "MESCOM",
    geometry: {
      type: "LineString",
      coordinates: [[74.8565, 12.9138], [74.8575, 12.9138]],
    },
    start: "2026-10-12T09:00:00Z",
    end: "2026-10-14T17:00:00Z",
    status: "approved",
  },
];

// POST /check -> always the same answer while we use mock data
export const MOCK_CHECK_RESULT = {
  conflicts: [
    {
      asset_id: "GAS-102",
      type: "gas",
      point: [74.856, 12.9141], // where the trench crosses the asset
    },
  ],
  suggested_route: {
    geometry: {
      type: "LineString",
      coordinates: [[74.8552, 12.9147], [74.8568, 12.9147]],
    },
    offset_m: 6, // how far the new route is shifted
  },
  coordination: [
    {
      order_id: "WO-2291",
      org: "MESCOM",
      start: "2026-10-12T09:00:00Z",
      end: "2026-10-14T17:00:00Z",
      suggested_window: {
        start: "2026-10-12T09:00:00Z",
        end: "2026-10-13T17:00:00Z",
      },
    },
  ],
};

// GET /timeline -> events recorded on-chain
export const MOCK_TIMELINE = [
  {
    event: "WorkOrderSubmitted",
    work_order_id: "WO-2291",
    tx_hash: "0x9f3a1c7e4b2d8a60f1e5c3b7a9d2e4f6a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9",
    timestamp: "2026-09-25T14:02:00Z",
  },
  {
    event: "WorkOrderApproved",
    work_order_id: "WO-2291",
    tx_hash: "0x4b7e2a9c1d5f8306e2a4c6b8d0f1a3e57c9b1d3f5a7e9c0b2d4f6a8c0e1b3d5f",
    timestamp: "2026-09-26T10:30:00Z",
  },
];