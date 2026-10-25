// Shared builders for the tests. Courses are laid out in a local east-north frame (meters) around a
// fixed reference near Reno-Stead, so trajectories are easy to reason about.
import { COURSE_FORMAT, COURSE_VERSION, parseCourse, type Course, type GateType } from "../src/core/course/course";
import { fromLocal, type LonLat } from "../src/core/geo/geo";
import type { Fix } from "../src/core/race/fix";

export const REF: LonLat = { lon: -119.88, lat: 39.66 };

export interface GateSpec {
  type: GateType;
  x: number;
  y: number;
  heading: number;
  width?: number;
  turnSide?: "left" | "right";
  /** Highest allowed pass above the terrain, m. */
  top?: number;
  /** Lowest allowed pass above the terrain, m. */
  bottom?: number;
  /** Terrain elevation at the gate, m MSL. */
  ground?: number;
  /** Pylon model id. */
  pylon?: string;
}

export function makeCourse(gates: GateSpec[], extra: Record<string, unknown> = {}): Course {
  return parseCourse({
    format: COURSE_FORMAT,
    version: COURSE_VERSION,
    id: "test",
    name: "Test course",
    createdAt: "2026-10-18T00:00:00Z",
    updatedAt: "2026-10-18T00:00:00Z",
    gates: gates.map((g, i) => ({
      id: `g${i + 1}`,
      type: g.type,
      center: fromLocal({ x: g.x, y: g.y }, REF),
      widthM: g.width ?? 80,
      headingDeg: g.heading,
      turnSide: g.turnSide ?? null,
      topM: g.top ?? null,
      bottomM: g.bottom ?? null,
      groundElevM: g.ground ?? null,
      pylon: g.pylon ?? null,
    })),
    ...extra,
  });
}

/** Three gates in a straight line northbound at y = -500, 0, +500 (the old tool's test layout). */
export function straightCourse(extra: Record<string, unknown> = {}): Course {
  return makeCourse(
    [
      { type: "start", x: 0, y: -500, heading: 0 },
      { type: "gate", x: 0, y: 0, heading: 0 },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ],
    extra,
  );
}

/**
 * A fix at local (x, y) meters from REF. NOTE: the engine projects about the course centroid, not
 * REF; for these small layouts the difference is far below the tolerances asserted.
 */
export function fixAt(x: number, y: number, t: number, over: Partial<Fix> = {}): Fix {
  const p = fromLocal({ x, y }, REF);
  return {
    t,
    lon: p.lon,
    lat: p.lat,
    altMslM: 1500,
    aglM: null,
    trackDeg: 0,
    gsMs: 100,
    headingDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    ...over,
  };
}
