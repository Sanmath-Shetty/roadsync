// src/MapView.jsx
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css"; // Leaflet's own styles. The map breaks without this.
import { MAP_CENTER, MAP_ZOOM, ASSET_COLORS } from "./mockData";

// Decide how each asset line looks, based on its type (gas, water, ...).
function assetStyle(feature) {
  return {
    color: ASSET_COLORS[feature.properties.type] || "gray",
    weight: 5,
    opacity: 0.9,
  };
}

// Runs once per asset. We use it to show the asset id when you hover over it.
function onEachAsset(feature, layer) {
  layer.bindTooltip(feature.properties.id + " (" + feature.properties.type + ")");
}

// Props:
//   assets   - the GeoJSON FeatureCollection from getAssets()
//   children - anything extra to draw inside the map (used in later files)
export default function MapView({ assets, children }) {
  return (
    <div className="map-wrap">
      <MapContainer center={MAP_CENTER} zoom={MAP_ZOOM} maxZoom={19}>
        {/* The OpenStreetMap background tiles */}
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Draw assets only after they have loaded (assets is null at first) */}
        {assets && (
          <GeoJSON
            key={assets.features.length}
            data={assets}
            style={assetStyle}
            onEachFeature={onEachAsset}
          />
        )}

        {children}
      </MapContainer>

      {/* Legend: a normal HTML box floating over the map (styled in App.css) */}
      <div className="legend">
        <strong>Assets</strong>
        {Object.entries(ASSET_COLORS).map(([type, color]) => (
          <div className="legend-row" key={type}>
            <span className="legend-swatch" style={{ background: color }}></span>
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}