/// <reference types="vite/client" />
import type { RacerApi } from "../shared/racerApi";

declare global {
  interface Window {
    // Injected by the preload inside Electron; undefined in the browser preview unless ?mockracer
    // installs the mock. Every call site goes through getRacer().
    racer?: RacerApi;
  }
  const __APP_VERSION__: string;
}
