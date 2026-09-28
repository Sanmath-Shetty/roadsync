// src/leafletDrawShim.js
// leaflet-draw is an old script with no "default export", which the new Vite
// refuses to import. This wrapper loads it properly and adds the missing export.
import L from "leaflet"; // loading Leaflet first makes it available as window.L
import "leaflet-draw/dist/leaflet.draw.js"; // leaflet-draw attaches itself to L
export default L;