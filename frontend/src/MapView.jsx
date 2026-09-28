// The map: underground assets painted in APWA colours, other orgs' planned
// work, the trench being drawn, the suggested reroute and conflict markers.
import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { PAINT, ASSET_LABELS } from "./colors";
import { toLatLngs } from "./geo";

const START_VIEW = [12.875, 74.845]; // Mangaluru demo road

// Keep the map clear of the floating history panel on wide screens.
const fitOptions = () =>
  window.innerWidth > 900
    ? { paddingTopLeft: [60, 60], paddingBottomRight: [400, 60], maxZoom: 19 }
    : { padding: [30, 30], maxZoom: 19 };

// Zoom to the assets once they load, then follow whatever the user is working on.
function Camera({ assets, focus }) {
  const map = useMap();
  useEffect(() => {
    if (!assets?.features?.length) return;
    const bounds = L.latLngBounds(assets.features.flatMap((f) => toLatLngs(f.geometry)));
    // Let the layout settle first, otherwise Leaflet measures a 0-size map and zooms way out.
    const t = setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(bounds, fitOptions());
    }, 100);
    return () => clearTimeout(t);
  }, [assets, map]);

  useEffect(() => {
    if (!focus?.length) return;
    const points = focus.flatMap((g) => toLatLngs(g));
    map.invalidateSize();
    map.flyToBounds(L.latLngBounds(points).pad(0.12), { ...fitOptions(), duration: 0.8 });
  }, [focus, map]);
  return null;
}

// Click to add points, double-click (or "Finish") to end, Esc to cancel.
function DrawLayer({ drawing, points, setPoints, onFinish, onCancel }) {
  const [cursor, setCursor] = useState(null);
  const map = useMapEvents({
    click(e) {
      if (drawing) setPoints((p) => [...p, [e.latlng.lat, e.latlng.lng]]);
    },
    dblclick() {
      if (drawing) onFinish();
    },
    mousemove(e) {
      if (drawing) setCursor([e.latlng.lat, e.latlng.lng]);
    },
  });

  useEffect(() => {
    const el = map.getContainer();
    el.classList.toggle("is-drawing", drawing);
    drawing ? map.doubleClickZoom.disable() : map.doubleClickZoom.enable();
    if (!drawing) setCursor(null);
    const onKey = (e) => drawing && e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, map, onCancel]);

  if (!drawing || points.length === 0) return null;
  const preview = cursor ? [...points, cursor] : points;
  return (
    <>
      <Polyline positions={preview} pathOptions={{ color: PAINT.proposed, weight: 4, dashArray: "2 10", lineCap: "round" }} />
      {points.map((p, i) => (
        <Marker key={i} position={p} icon={vertexIcon} interactive={false} />
      ))}
    </>
  );
}

const vertexIcon = L.divIcon({ className: "vertex", iconSize: [12, 12] });

const conflictIcon = (color) =>
  L.divIcon({
    className: "",
    html: `<div class="conflict-mark" style="--c:${color}"><span></span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

// One asset = a soft wide glow + a crisp paint stroke.
function AssetLine({ feature }) {
  const color = PAINT[feature.properties.type] || "#999";
  const positions = toLatLngs(feature.geometry);
  return (
    <>
      <Polyline positions={positions} pathOptions={{ color, weight: 14, opacity: 0.18 }} interactive={false} />
      <Polyline positions={positions} pathOptions={{ color, weight: 4, opacity: 0.95 }}>
        <Tooltip sticky className="map-tip">
          <b>{ASSET_LABELS[feature.properties.type]}</b> {feature.properties.id}
        </Tooltip>
      </Polyline>
    </>
  );
}

export default function MapView({
  assets,
  workOrders,
  myOrderId,
  trench,
  original,
  suggested,
  conflicts,
  drawing,
  draftPoints,
  setDraftPoints,
  onFinishDraw,
  onCancelDraw,
  focus,
}) {
  const others = useMemo(
    () => (workOrders || []).filter((w) => w.id !== myOrderId && w.status !== "rejected"),
    [workOrders, myOrderId]
  );

  return (
    <div className="map-wrap">
      <MapContainer center={START_VIEW} zoom={17} maxZoom={20} zoomControl={false} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={20}
        />
        <Camera assets={assets} focus={focus} />

        {/* Other organisations' planned work: wide translucent band */}
        {others.map((w) => (
          <Polyline
            key={w.id}
            positions={toLatLngs(w.geometry)}
            pathOptions={{ color: "#c9b8ff", weight: 22, opacity: 0.22, lineCap: "butt" }}
          >
            <Tooltip sticky className="map-tip">
              <b>{w.org}</b> planned work, {w.start} to {w.end}
            </Tooltip>
          </Polyline>
        ))}

        {assets?.features.map((f) => <AssetLine key={f.properties.id} feature={f} />)}

        {/* Original trench after a reroute: faint ghost */}
        {original && (
          <Polyline positions={toLatLngs(original)} pathOptions={{ color: PAINT.proposed, weight: 3, opacity: 0.3, dashArray: "4 8" }} />
        )}

        {/* Suggested safer route: survey pink, marching dashes */}
        {suggested && (
          <Polyline
            positions={toLatLngs(suggested.geometry)}
            pathOptions={{ color: PAINT.survey, weight: 5, dashArray: "12 10", className: "marching" }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="map-tip tip-survey">
              Safer route, {suggested.offset_m} m over
            </Tooltip>
          </Polyline>
        )}

        {/* The proposed trench: white-lined, like a real excavation mark */}
        {trench && (
          <>
            <Polyline positions={toLatLngs(trench)} pathOptions={{ color: "#000", weight: 10, opacity: 0.35 }} interactive={false} />
            <Polyline positions={toLatLngs(trench)} pathOptions={{ color: PAINT.proposed, weight: 5, dashArray: "14 8" }} />
          </>
        )}

        {conflicts?.map((c) => (
          <Marker key={c.asset_id} position={[c.point[1], c.point[0]]} icon={conflictIcon(PAINT[c.type])}>
            <Tooltip direction="right" offset={[18, 0]} className="map-tip tip-danger">
              Crosses {ASSET_LABELS[c.type].toLowerCase()} line {c.asset_id}
            </Tooltip>
          </Marker>
        ))}

        <DrawLayer
          drawing={drawing}
          points={draftPoints}
          setPoints={setDraftPoints}
          onFinish={onFinishDraw}
          onCancel={onCancelDraw}
        />
      </MapContainer>

      <div className="legend" aria-label="Map legend">
        {Object.entries(ASSET_LABELS).map(([type, label]) => (
          <div className="legend-row" key={type}>
            <span className="swatch" style={{ background: PAINT[type] }} />
            {label}
          </div>
        ))}
        <div className="legend-row">
          <span className="swatch swatch-dashed" style={{ color: PAINT.proposed }} />
          Your trench
        </div>
        <div className="legend-row">
          <span className="swatch swatch-dashed" style={{ color: PAINT.survey }} />
          Suggested route
        </div>
        <div className="legend-row">
          <span className="swatch swatch-band" />
          Other orgs' work
        </div>
      </div>

      {drawing && (
        <div className="draw-hint" role="status">
          Click to place points. Double-click to finish, Esc to cancel.
        </div>
      )}
    </div>
  );
}
