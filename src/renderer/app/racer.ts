// The renderer's access to main (window.racer). Null in a plain browser without ?mockracer, and the
// UI must still render in that case — it is what keeps the browser preview usable.
import type { RacerApi } from "../../shared/racerApi";

export function getRacer(): RacerApi | null {
  return window.racer ?? null;
}
