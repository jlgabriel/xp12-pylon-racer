// The flown trail drawn on the minimap: the live fixes, thinned to the distinct positions. A jump
// the engine would not judge as flight (the sim resetting the aircraft after a crash) starts a new
// stretch, so the map never draws a line the aircraft did not fly.
import { isJump } from "../../core/race/engine";
import type { Fix } from "../../core/race/fix";

export interface TrailPoint {
  lon: number;
  lat: number;
  t: number;
  gsMs: number;
  /** First point after a jump: the path moves here instead of drawing a line. */
  jump: boolean;
}

export const TRAIL_MAX = 2400;

/** The trail with this fix added, or the same array when the position did not change. */
export function appendTrail(trail: readonly TrailPoint[], fix: Fix): readonly TrailPoint[] {
  const last = trail[trail.length - 1];
  if (last && last.lon === fix.lon && last.lat === fix.lat) return trail;
  const next = trail.length >= TRAIL_MAX ? trail.slice(-TRAIL_MAX / 2) : trail.slice();
  next.push({ lon: fix.lon, lat: fix.lat, t: fix.t, gsMs: fix.gsMs, jump: last !== undefined && isJump(last, fix) });
  return next;
}
