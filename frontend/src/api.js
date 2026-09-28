// All calls to the Flask backend live here. See API.md in the repo root.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Error that keeps the HTTP status and the backend's JSON body,
// so the UI can tell "contract refused (409)" apart from "server down".
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new ApiError(
      `Can't reach the backend at ${BASE_URL}. Start it with "python app.py".`,
      0,
      null
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status, data);
  }
  return data;
}

const post = (path, body) => request(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  info: () => request("/"),
  assets: () => request("/assets"),
  workOrders: () => request("/work-orders"),
  timeline: () => request("/timeline"),
  check: (order) => post("/check", order),
  submit: (order) => post("/submit", order),
  accept: (work_order_id, kind) => post("/accept-suggestion", { work_order_id, kind }),
  approve: (work_order_id) => post("/approve", { work_order_id }),
  verify: (id) => request(`/verify/${id}`),
  tamper: (work_order_id) => post("/demo/tamper", { work_order_id }),
};
