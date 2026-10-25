// Import a course.json made by the earlier pylon-race tool (the web editor at
// jlgabriel.github.io/afs4-pylon-race). Its shape: schema_version "0.1", course_id, course_name,
// gates[] with sequence + type start|checkpoint|finish + either center/width_m/orientation_deg or
// left_pylon/right_pylon, rules with *_penalty_seconds. Unknown fields are ignored.
import { z } from "zod";
import { COURSE_FORMAT, COURSE_VERSION, parseCourse, type Course, type Gate } from "./course";
import { haversine, initialBearing, wrap360, type LonLat } from "../geo/geo";

const pt = z.object({ lon: z.number(), lat: z.number() });

const rctGate = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().optional(),
  type: z.string().default("checkpoint"),
  sequence: z.number().optional(),
  center: pt.nullish(),
  width_m: z.number().optional(),
  orientation_deg: z.number().optional(),
  left_pylon: pt.nullish(),
  right_pylon: pt.nullish(),
  pylon: z.string().nullish(),
  max_agl_m: z.number().nullish(),
});

const rctCourse = z.object({
  schema_version: z.union([z.string(), z.number()]).optional(),
  course_id: z.string().optional(),
  course_name: z.string().optional(),
  gates: z.array(rctGate).min(2),
  rules: z
    .object({
      missed_gate_penalty_seconds: z.number().optional(),
      wrong_direction_penalty_seconds: z.number().optional(),
    })
    .partial()
    .optional(),
});

/** True when `data` looks like an old-tool course.json rather than a native course. */
export function isRctCourse(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d["format"] !== COURSE_FORMAT && Array.isArray(d["gates"]) && ("course_id" in d || "schema_version" in d);
}

/** Convert an old-tool course.json to a native Course. `now` is an ISO timestamp. */
export function importRctCourse(data: unknown, now: string): Course {
  const rct = rctCourse.parse(data);
  const ordered = rct.gates
    .map((g, i) => ({ g, order: g.sequence ?? (typeof g.id === "number" ? g.id : i) }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.g);

  const gates: Gate[] = ordered.map((g, i) => {
    const { center, widthM, headingDeg } = geometryOf(g, i);
    return {
      id: `g${i + 1}`,
      type: g.type === "start" ? "start" : g.type === "finish" ? "finish" : "gate",
      center,
      widthM,
      headingDeg,
      pylon: g.pylon ?? null,
      groundElevM: null,
      // The old tool's max_agl_m was a placeholder (80 m on every gate), never a rule.
      topM: null,
      bottomM: null,
      turnSide: null,
    };
  });

  const rules: Record<string, number> = {};
  const r = rct.rules ?? {};
  if (r.missed_gate_penalty_seconds !== undefined) rules["missedGatePenaltyS"] = r.missed_gate_penalty_seconds;
  if (r.wrong_direction_penalty_seconds !== undefined) rules["wrongDirectionPenaltyS"] = r.wrong_direction_penalty_seconds;

  return parseCourse({
    format: COURSE_FORMAT,
    version: COURSE_VERSION,
    id: slugId(rct.course_id ?? rct.course_name ?? "imported"),
    name: rct.course_name ?? rct.course_id ?? "Imported course",
    author: "",
    description: "Imported from a pylon-race course.json",
    createdAt: now,
    updatedAt: now,
    laps: 1,
    gates,
    rules,
  });
}

function geometryOf(g: z.infer<typeof rctGate>, i: number): { center: LonLat; widthM: number; headingDeg: number } {
  if (g.center) {
    return { center: { lon: g.center.lon, lat: g.center.lat }, widthM: g.width_m ?? 80, headingDeg: g.orientation_deg ?? 0 };
  }
  if (g.left_pylon && g.right_pylon) {
    const l = g.left_pylon;
    const r = g.right_pylon;
    return {
      center: { lon: (l.lon + r.lon) / 2, lat: (l.lat + r.lat) / 2 },
      widthM: haversine(l, r),
      // The gate line runs left→right; the pass direction is perpendicular to it.
      headingDeg: wrap360(initialBearing(l, r) - 90),
    };
  }
  throw new Error(`Gate ${i + 1} has neither a center nor two pylons`);
}

function slugId(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "imported";
}
