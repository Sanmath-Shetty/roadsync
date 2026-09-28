// src/DrawTool.jsx
import { FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css"; // styles for the toolbar
import L from "leaflet";

// Known bug fix: leaflet-draw v1.0.4 crashes on newer browsers with
// "type is not defined" when you finish drawing. This one line fixes it.
L.GeometryUtil = L.extend(L.GeometryUtil || {}, {
  readableDistance: (distance) => Math.round(distance) + " m",
});

// Props:
//   onDrawn(geometry) - called with a GeoJSON LineString when the user
//                       finishes drawing, or with null if they delete it
export default function DrawTool({ onDrawn }) {
  // Called when the user finishes drawing a line
  function handleCreated(e) {
    // Convert the Leaflet layer into GeoJSON: { type: "LineString", coordinates: [[lng, lat], ...] }
    const geometry = e.layer.toGeoJSON().geometry;
    onDrawn(geometry);
  }

  // Called when the user deletes their drawing with the trash button
  function handleDeleted() {
    onDrawn(null);
  }

  return (
    // FeatureGroup holds the drawn shapes so the toolbar can edit/delete them
    <FeatureGroup>
      <EditControl
        position="topright"
        onCreated={handleCreated}
        onDeleted={handleDeleted}
        draw={{
          polyline: { shapeOptions: { color: "#8e24aa", weight: 4 } }, // purple trench
          // turn off everything except the polyline
          polygon: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        }}
        edit={{ edit: false }} // keep only the delete button, for simplicity
      />
    </FeatureGroup>
  );
}