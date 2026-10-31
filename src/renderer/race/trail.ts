// The flown trail drawn on the minimap: the live fixes, thinned to one every TRAIL_STEP_M. A jump
// the engine would not judge as flight (the sim resetting the aircraft after a crash) starts a new
// stretch, so the map never draws a line the aircraft did not fly.
import { isJump } from "../../core/race/engine";
import type { Fix } from "../../core/race/fix";
import { haversine } from "../../core/geo/geo";

export interface TrailPoint {
  lon: number;
  lat: number;
  t: number;
  gsMs: number;
  /** First point after a jump: the path moves here instead of drawing a line. */
  jump: boolean;
}

/** A fix closer than this to the last point kept adds nothing the map can show. Kept by count, RPOS's
 *  ~30 Hz filled TRAIL_MAX in 80 s, and a 3-minute run showed only its end (flown 2026-10-31). */
export const TRAIL_STEP_M = 10;
/** 30 km of trail: the longest included course is 19 km. Past it, the oldest half goes. */
export const TRAIL_MAX = 3000;

/** The trail with this fix added, or the same array when the fix adds nothing. */
export function appendTrail(trail: readonly TrailPoint[], fix: Fix): readonly TrailPoint[] {
  const last = trail[trail.length - 1];
  const jump = last !== undefined && isJump(last, fix);
  if (last && !jump && haversine(last, fix) < TRAIL_STEP_M) return trail;
  const next = trail.length >= TRAIL_MAX ? trail.slice(-TRAIL_MAX / 2) : trail.slice();
  next.push({ lon: fix.lon, lat: fix.lat, t: fix.t, gsMs: fix.gsMs, jump });
  return next;
}
