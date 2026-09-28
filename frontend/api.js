// src/api.js
// ALL backend calls live in this file.
//
// TO SWITCH TO THE REAL BACKEND, change ONLY the BASE_URL line below:
//   const BASE_URL = "mock";                   // use fake data (no backend needed)
//   const BASE_URL = "http://localhost:5000";  // use the real Flask API
const BASE_URL = "mock";

import {
  MOCK_ASSETS,
  MOCK_WORK_ORDERS,
  MOCK_CHECK_RESULT,
  MOCK_TIMELINE,
} from "./mockData";

const USE_MOCK = BASE_URL === "mock";

// ---------- Helpers ----------

// Pretend the network takes a moment, so loading states look realistic.
const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

// Make a fake 32-byte transaction hash like 0xabc123...
function fakeTxHash() {
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += Math.floor(Math.random() * 16).toString(16);
  }
  return hash;
}

// Send a request to the real Flask API and return the JSON reply.
async function request(path, options = {}) {
  const response = await fetch(BASE_URL + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    throw new Error("API error " + response.status + " on " + path);
  }
  return response.json();
}

// Shortcut for POST requests with a JSON body.
function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

// In mock mode, the timeline grows as the user does things.
// We keep our own copy so the original mock data is never changed.
const mockTimeline = [...MOCK_TIMELINE];

function addMockEvent(event, work_order_id) {
  const tx_hash = fakeTxHash();
  mockTimeline.push({
    event,
    work_order_id,
    tx_hash,
    timestamp: new Date().toISOString(),
  });
  return tx_hash;
}

// ---------- API functions (one per endpoint) ----------

// GET /assets -> GeoJSON FeatureCollection
export async function getAssets() {
  if (USE_MOCK) {
    await wait();
    return MOCK_ASSETS;
  }
  return request("/assets");
}

// GET /work-orders -> list of planned work by other organizations
export async function getWorkOrders() {
  if (USE_MOCK) {
    await wait();
    return MOCK_WORK_ORDERS;
  }
  return request("/work-orders");
}

// POST /check -> { conflicts, suggested_route, coordination }
// `trench` looks like { org, geometry, start, end }
export async function checkRoute(trench) {
  if (USE_MOCK) {
    await wait(700);
    addMockEvent("ConflictRecorded", "WO-NEW");
    return MOCK_CHECK_RESULT;
  }
  return post("/check", trench);
}

// POST /accept-suggestion -> { tx_hash }
// kind is "reroute" or "window"
export async function acceptSuggestion(work_order_id, kind) {
  if (USE_MOCK) {
    await wait();
    return { tx_hash: addMockEvent("ConflictResolved", work_order_id) };
  }
  return post("/accept-suggestion", { work_order_id, kind });
}

// POST /submit -> { work_order_id, tx_hash }
export async function submitWorkOrder(trench) {
  if (USE_MOCK) {
    await wait();
    const work_order_id = "WO-" + Math.floor(3000 + Math.random() * 1000);
    const tx_hash = addMockEvent("WorkOrderSubmitted", work_order_id);
    return { work_order_id, tx_hash };
  }
  return post("/submit", trench);
}

// POST /approve -> { tx_hash }  (the agency does this, not the worker)
export async function approveWorkOrder(work_order_id) {
  if (USE_MOCK) {
    await wait();
    return { tx_hash: addMockEvent("WorkOrderApproved", work_order_id) };
  }
  return post("/approve", { work_order_id });
}

// GET /timeline -> list of on-chain events
export async function getTimeline() {
  if (USE_MOCK) {
    await wait(200);
    return [...mockTimeline];
  }
  return request("/timeline");
}