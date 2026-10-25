import { readFileSync } from "node:fs";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// Three build targets sharing the pure src/core. The preload is emitted as CommonJS (index.cjs) so
// the renderer can run with sandbox:true — Electron requires a CJS preload under the sandbox.

// The version is frozen into the bundle at build time. NOT app.getVersion(): when the main script
// is launched by path (as the e2e does) Electron finds no app package.json and reports its OWN
// version instead.
const APP_VERSION: string = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")).version;

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: { format: "cjs", entryFileNames: "index.cjs" },
      },
    },
  },
  renderer: {
    plugins: [react()],
    define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
    resolve: { dedupe: ["react", "react-dom"] },
  },
});
