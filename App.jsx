// src/App.jsx
import { useState, useEffect } from "react";
import { Polyline } from "react-leaflet";
import "./App.css";
import MapView from "./MapView";
import DrawTool from "./DrawTool";
import { ConflictAlert, CoordinationCards } from "./ResultPanels";
import Timeline from "./Timeline";
import { getAssets, getTimeline, checkRoute, acceptSuggestion, submitWorkOrder } from "./api";

// Demo values. Later these could come from a login or a form.
const ORG = "DemoTelecom";
const START = "2026-10-15T09:00:00Z";
const END = "2026-10-16T17:00:00Z";

// GeoJSON uses [lng, lat] but Leaflet's Polyline wants [lat, lng].
// This is the one place where we swap.
function toLatLng(geometry) {
  return geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

export default function App() {
  const [assets, setAssets] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [trench, setTrench] = useState(null);     // the line the user drew (GeoJSON)
  const [result, setResult] = useState(null);     // answer from /check
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(null); // { work_order_id, tx_hash }
  const [busy, setBusy] = useState(false);        // true while waiting for the API

  // Load assets and timeline once when the page opens
  useEffect(() => {
    getAssets().then(setAssets);
    refreshTimeline();
  }, []);

  function refreshTimeline() {
    getTimeline().then(setTimeline);
  }

  // When the user draws (or deletes) a line, clear all old results
  function handleDrawn(geometry) {
    setTrench(geometry);
    setResult(null);
    setAccepted(false);
    setSubmitted(null);
  }

  async function handleCheck() {
    setBusy(true);
    const data = await checkRoute({ org: ORG, geometry: trench, start: START, end: END });
    setResult(data);
    setBusy(false);
    refreshTimeline();
  }

  async function handleAccept() {
    setBusy(true);
    // "WO-NEW" is a placeholder id for now (see the note below)
    await acceptSuggestion("WO-NEW", "reroute");
    setAccepted(true);
    setBusy(false);
    refreshTimeline();
  }

  async function handleSubmit() {
    setBusy(true);
    // If the user accepted the safer route, submit that one instead
    const geometry = accepted ? result.suggested_route.geometry : trench;
    const reply = await submitWorkOrder({ org: ORG, geometry, start: START, end: END });
    setSubmitted(reply);
    setBusy(false);
    refreshTimeline();
  }

  // Submit is allowed once we have a check result, and any conflict is resolved
  const hasConflicts = result && result.conflicts.length > 0;
  const canSubmit = result && !submitted && (!hasConflicts || accepted);

  return (
    <div className="app">
      <div className="sidebar">
        <h1>RoadSync</h1>
        <p className="subtitle">Check a trench before you dig</p>

        {!trench && <p>Use the line tool (top right of the map) to draw a trench.</p>}

        <button className="btn" disabled={!trench || busy} onClick={handleCheck}>
          {busy && !result ? "Checking..." : "Check route"}
        </button>

        {result && (
          <>
            <ConflictAlert
              conflicts={result.conflicts}
              suggested={result.suggested_route}
              accepted={accepted}
              onAccept={handleAccept}
            />
            <CoordinationCards matches={result.coordination} />
          </>
        )}

        <button
          className="btn btn-success"
          disabled={!canSubmit || busy}
          onClick={handleSubmit}
        >
          Submit work order
        </button>

        {submitted && (
          <div className="panel ok">
            <h2>Work order submitted</h2>
            <p>{submitted.work_order_id}</p>
            <span className="tx-hash">{submitted.tx_hash}</span>
          </div>
        )}

        <Timeline events={timeline} />
      </div>

      <MapView assets={assets}>
        <DrawTool onDrawn={handleDrawn} />

        {/* Suggested route: dashed green line, only if the backend sent one */}
        {result && result.suggested_route && (
          <Polyline
            positions={toLatLng(result.suggested_route.geometry)}
            pathOptions={{ color: "#2e7d32", weight: 5, dashArray: "10 10" }}
          />
        )}
      </MapView>
    </div>
  );
}