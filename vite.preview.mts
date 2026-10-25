// Standalone Vite dev server for the RENDERER ONLY, for UI work in a plain browser
// (`npm run preview:renderer` → http://localhost:5298; Pylon Racer's own is on 5299, so both can run
// side by side). window.racer does not exist there; add
// `?mockracer` to install a fake bridge that runs the real core engine on a demo flight.
// Not part of the app build — the shipped renderer is built by electron.vite.config.ts.
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const APP_VERSION: string = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  root: "src/renderer",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  resolve: { dedupe: ["react", "react-dom"] },
  server: {
    port: 5298,
    strictPort: true,
    fs: { allow: [import.meta.dirname] }, // src/renderer imports reach ../core, ../shared
  },
});
