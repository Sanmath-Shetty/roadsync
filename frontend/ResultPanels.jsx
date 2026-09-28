// src/ResultPanels.jsx
// Simple display components. They receive data as props and show it.

// Turn "2026-10-12T09:00:00Z" into a readable date like "12 Oct 2026"
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Red alert naming each conflicting asset.
// Props: conflicts (array from /check), suggested (the suggested_route or null),
//        accepted (true after the user accepts), onAccept (function)
export function ConflictAlert({ conflicts, suggested, accepted, onAccept }) {
  // No conflicts: show a green "all clear" message instead
  if (conflicts.length === 0) {
    return (
      <div className="panel ok">
        <h2>No conflicts found</h2>
        <p>This route is clear of known underground assets.</p>
      </div>
    );
  }

  return (
    <div className="panel alert">
      <h2>Conflict Alert</h2>
      {conflicts.map((c) => (
        <p key={c.asset_id}>
          Crosses <strong>{c.asset_id}</strong> ({c.type} line)
        </p>
      ))}

      {/* Only show the suggestion if the backend sent one */}
      {suggested && !accepted && (
        <>
          <p>
            Safer route available, shifted by {suggested.offset_m} m
            (dashed green line on the map).
          </p>
          <button className="btn btn-success" onClick={onAccept}>
            Accept suggestion
          </button>
        </>
      )}

      {accepted && <p>✔ Suggestion accepted and recorded on-chain.</p>}
    </div>
  );
}

// Blue card for each coordination match (another org digging nearby).
// Props: matches (the coordination array from /check)
export function CoordinationCards({ matches }) {
  return (
    <>
      {matches.map((m) => (
        <div className="panel card" key={m.order_id}>
          <h2>Coordination match</h2>
          <p>
            <strong>{m.org}</strong> plans work nearby ({m.order_id}),{" "}
            {formatDate(m.start)} to {formatDate(m.end)}.
          </p>
          <p>
            Suggested shared window: {formatDate(m.suggested_window.start)} to{" "}
            {formatDate(m.suggested_window.end)}.
          </p>
        </div>
      ))}
    </>
  );
}