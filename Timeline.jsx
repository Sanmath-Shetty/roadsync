// src/Timeline.jsx
// Shows the list of events recorded on the blockchain.
// Props: events (array from getTimeline(), or null while loading)

// Turn "2026-09-25T14:02:00Z" into "25 Sep, 7:32 pm" (local time)
function formatTime(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Shorten a long hash: 0x9f3a1c7e...a3b5c7d9
function shortHash(hash) {
  return hash.slice(0, 10) + "..." + hash.slice(-8);
}

export default function Timeline({ events }) {
  return (
    <div className="panel">
      <h2>Timeline</h2>

      {/* events is null until the first load finishes */}
      {!events && <p>Loading...</p>}
      {events && events.length === 0 && <p>No events yet.</p>}

      {/* [...events].reverse() puts the newest event first,
          without changing the original array */}
      {events &&
        [...events].reverse().map((e) => (
          <div className="timeline-item" key={e.tx_hash}>
            <strong>{e.event}</strong> · {e.work_order_id}
            <div>{formatTime(e.timestamp)}</div>
            {/* title shows the full hash when you hover over it */}
            <span className="tx-hash" title={e.tx_hash}>
              {shortHash(e.tx_hash)}
            </span>
          </div>
        ))}
    </div>
  );
}