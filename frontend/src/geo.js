// Small geometry helpers. The API uses GeoJSON [lng, lat]; Leaflet wants [lat, lng].

export const toLatLngs = (geometry) => geometry.coordinates.map(([lng, lat]) => [lat, lng]);

export const toLineString = (latlngs) => ({
  type: "LineString",
  coordinates: latlngs.map(([lat, lng]) => [Number(lng.toFixed(6)), Number(lat.toFixed(6))]),
});

// Length of a GeoJSON LineString in metres (haversine, good enough for a street).
export function lengthMeters(geometry) {
  if (!geometry) return 0;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  let total = 0;
  const c = geometry.coordinates;
  for (let i = 1; i < c.length; i++) {
    const [lng1, lat1] = c[i - 1];
    const [lng2, lat2] = c[i];
    const a =
      Math.sin(rad(lat2 - lat1) / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}

// A trench along the demo road that crosses the gas line (same as backend seed).
export const DEMO_TRENCH = {
  type: "LineString",
  coordinates: [
    [74.843, 12.875],
    [74.847, 12.875],
  ],
};
