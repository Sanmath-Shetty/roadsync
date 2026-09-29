// On-chain history: every event RoadSync wrote to MST, newest first.
import { useState } from "react";

const EVENT_TEXT = {
  WorkOrderSubmitted: "Permit submitted",
  ConflictRecorded: "Conflict recorded",
  ConflictResolved: "Conflict resolved",
  WorkOrderApproved: "Approved by agency",
};

const shortHash = (h) => `${h.slice(0, 8)}…${h.slice(-6)}`;

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export default function Ledger({ events, freshCount }) {
  // Start collapsed on phones so the map stays visible.
  const [open, setOpen] = useState(() => window.innerWidth > 900);
  const list = events ? [...events].reverse() : [];

  return (
    <aside className={`ledger glass ${open ? "" : "is-closed"}`} aria-label="On-chain history">
      <button className="ledger-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>On-chain history</span>
        <span className="ledger-count">{events ? events.length : "…"}</span>
      </button>

      {open && (
        <ol className="ledger-list">
          {!events && <li className="ledger-empty">Loading…</li>}
          {events?.length === 0 && (
            <li className="ledger-empty">Nothing on-chain yet. Submit a permit to write the first record.</li>
          )}
          {list.map((e, i) => (
            <li key={e.tx_hash} className={`ledger-item ev-${e.event} ${i < freshCount ? "is-fresh" : ""}`}>
              <div className="ledger-row">
                <strong>{EVENT_TEXT[e.event] || e.event}</strong>
                <span className="ledger-time">{formatTime(e.timestamp)}</span>
              </div>
              <div className="ledger-row">
                <span className="ledger-order">Permit #{e.work_order_id}</span>
                {e.explorer ? (
                  <a className="hash" href={e.explorer} target="_blank" rel="noreferrer" title={e.tx_hash}>
                    {shortHash(e.tx_hash)}
                  </a>
                ) : (
                  <span className="hash" title={e.tx_hash}>{shortHash(e.tx_hash)}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
