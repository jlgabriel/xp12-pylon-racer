import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installMockBridge } from "./dev/mockBridge";
import "leaflet/dist/leaflet.css";
// Bundled fonts (OFL-1.1, see THIRD_PARTY_NOTICES.md): nothing is fetched at run time.
import "@fontsource-variable/inter";
import "@fontsource/barlow-semi-condensed/latin-600.css";
import "@fontsource/barlow-semi-condensed/latin-700.css";
import "@fontsource/barlow-semi-condensed/latin-700-italic.css";
import "./theme/tokens.css";
import "./theme/base.css";
import "./app.css";

// DEV ONLY: ?mockracer installs a fake bridge for the browser preview. `import.meta.env.DEV` is a
// build-time `false` in production, so this branch and the mock are tree-shaken out.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("mockracer")) {
  installMockBridge();
}

// A dropped file must never become a navigation (main blocks it too).
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
