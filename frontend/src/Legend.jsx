// Interactive legend: hover a layer to spotlight it on the map,
// click to hide or show it.
import { PAINT, ASSET_LABELS } from "./colors";

export default function Legend({ hidden, toggle, setHover }) {
  return (
    <div className="legend glass" role="group" aria-label="Map layers">
      <p className="legend-title">Underground</p>
      {Object.entries(ASSET_LABELS).map(([type, label]) => {
        const off = hidden.includes(type);
        return (
          <button
            key={type}
            className={`legend-row ${off ? "is-off" : ""}`}
            aria-pressed={!off}
            onClick={() => toggle(type)}
            onMouseEnter={() => setHover(type)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(type)}
            onBlur={() => setHover(null)}
          >
            <span className="swatch" style={{ background: PAINT[type] }} />
            {label}
          </button>
        );
      })}
      <p className="legend-title">Plans</p>
      <div className="legend-row is-static">
        <span className="swatch swatch-dashed" style={{ color: PAINT.proposed }} />
        Your trench
      </div>
      <div className="legend-row is-static">
        <span className="swatch swatch-dashed" style={{ color: PAINT.survey }} />
        Suggested route
      </div>
      <div className="legend-row is-static">
        <span className="swatch swatch-band" />
        Other crews' digs
      </div>
    </div>
  );
}
