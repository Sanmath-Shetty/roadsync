// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        // Whenever something imports exactly "leaflet-draw", use our wrapper instead
        find: /^leaflet-draw$/,
        replacement: fileURLToPath(new URL("./src/leafletDrawShim.js", import.meta.url)),
      },
    ],
  },
});