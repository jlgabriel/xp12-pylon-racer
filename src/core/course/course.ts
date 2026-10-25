// The course (pista): the shared document between the designer, the scenery exporter and the race
// engine. Validated with zod on every way in (disk, import, IPC) — the engine assumes a valid course.
//
// Gate roles are positional and checked here, so the engine never sees an impossible course:
// - gates[0] is always the start.
// - laps === 1: the last gate is the finish; no other finish/start.
// - laps > 1: there is NO finish gate — the start line closes each lap and the race ends on the
//   start-line crossing that completes the last lap.
import { z } from "zod";
import { PYLON_SIZES, pylonHeightFor } from "../export/pylons";

export const COURSE_FORMAT = "pylon-racer/course";
export const COURSE_VERSION = 1;

export const GATE_TYPES = ["start", "finish", "gate", "level", "knife", "inverted", "turn"] as const;
export type GateType = (typeof GATE_TYPES)[number];

const lonLat = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

export const gateSchema = z.object({
  id: z.string().min(1),
  type: z.enum(GATE_TYPES),
  center: lonLat,
  /** Distance between the two pylons (ignored for `turn`, which is a single pylon). */
  widthM: z.number().positive(),
  /** Direction of a correct pass through the gate, compass degrees. */
  headingDeg: z.number(),
  /** Pylon model id; null = the default for the gate type. */
  pylon: z.string().nullable().default(null),
  /** Terrain elevation at the gate center (DEM), meters MSL; null = unknown. */
  groundElevM: z.number().nullable().default(null),
  /** Highest allowed pass above the terrain, meters; null = no limit. */
  topM: z.number().positive().nullable().default(null),
  /** Lowest allowed pass above the terrain, meters; null = no limit. With topM, a height window. */
  bottomM: z.number().positive().nullable().default(null),
  /** `turn` only: the side the pylon must be kept on. */
  turnSide: z.enum(["left", "right"]).nullable().default(null),
});
export type Gate = z.infer<typeof gateSchema>;

export const rulesSchema = z.object({
  missedGatePenaltyS: z.number().min(0).default(10),
  /** A missed gate ends the run instead of adding time. */
  missedGateIsDnf: z.boolean().default(false),
  wrongDirectionPenaltyS: z.number().min(0).default(10),
  attitudePenaltyS: z.number().min(0).default(2),
  tooHighPenaltyS: z.number().min(0).default(2),
  tooLowPenaltyS: z.number().min(0).default(2),
  pylonHitPenaltyS: z.number().min(0).default(3),
  turnCutPenaltyS: z.number().min(0).default(10),
  levelToleranceDeg: z.number().min(0).max(90).default(10),
  knifeToleranceDeg: z.number().min(0).max(90).default(15),
  /** Inverted gates: the bank may be this far from 180°. */
  invertedToleranceDeg: z.number().min(0).max(90).default(20),
  /** Passing closer than this to a pylon's center counts as hitting it (aircraft as a point). */
  pylonHitRadiusM: z.number().positive().default(5),
  /** Pylons are this tall: passing above it is not a hit. Only for models whose height is unknown
   *  (krzysk1's); a model with a known height uses its own (export/pylons.ts). */
  pylonHeightM: z.number().positive().default(25),
  /** Every pylon of the course at this size (export/pylons.ts). Pylon Racer (Aerofly) drops it on
   *  open, like any key it does not know. */
  pylonSize: z.enum(PYLON_SIZES).default("standard"),
});
export type Rules = z.infer<typeof rulesSchema>;

export const courseSchema = z
  .object({
    format: z.literal(COURSE_FORMAT),
    version: z.literal(COURSE_VERSION),
    id: z.string().min(1),
    name: z.string().min(1),
    author: z.string().default(""),
    description: z.string().default(""),
    createdAt: z.string(),
    updatedAt: z.string(),
    laps: z.number().int().min(1).max(50).default(1),
    gates: z.array(gateSchema).min(2),
    rules: rulesSchema.default(rulesSchema.parse({})),
    // Courses of v0.4.0-pre and earlier carry a `medals` field: unknown keys are dropped on parse.
  })
  .superRefine((c, ctx) => {
    const problem = gateRoleProblem(c.gates, c.laps);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["gates"] });
    const window = heightWindowProblem(c.gates);
    if (window) ctx.addIssue({ code: "custom", message: window, path: ["gates"] });
    const ids = new Set<string>();
    for (const g of c.gates) {
      if (ids.has(g.id)) ctx.addIssue({ code: "custom", message: `Duplicate gate id ${g.id}`, path: ["gates"] });
      ids.add(g.id);
    }
  });
export type Course = z.infer<typeof courseSchema>;

/** Why this gate sequence cannot be raced, or null if it can. */
export function gateRoleProblem(gates: readonly Pick<Gate, "type">[], laps: number): string | null {
  if (gates.length < 2) return "A course needs at least two gates";
  if (gates[0]?.type !== "start") return "The first gate must be the start";
  const starts = gates.filter((g) => g.type === "start").length;
  if (starts !== 1) return "A course has exactly one start gate";
  const finishes = gates.filter((g) => g.type === "finish").length;
  if (laps === 1) {
    if (gates[gates.length - 1]?.type !== "finish") return "The last gate must be the finish";
    if (finishes !== 1) return "A single-lap course has exactly one finish gate";
  } else if (finishes !== 0) {
    return "A multi-lap course has no finish gate: the start line closes every lap";
  }
  return null;
}

/** A gate whose minimum height is not below its maximum can never be passed cleanly. */
export function heightWindowProblem(gates: readonly Pick<Gate, "topM" | "bottomM">[]): string | null {
  const i = gates.findIndex((g) => g.topM !== null && g.bottomM !== null && g.bottomM >= g.topM);
  return i < 0 ? null : `Gate ${i + 1}: the minimum height must be below the maximum`;
}

/** Parse untrusted JSON into a Course (throws ZodError). */
export function parseCourse(data: unknown): Course {
  return courseSchema.parse(data);
}

/**
 * The text that decides the course revision: everything that changes how a run is scored, nothing
 * cosmetic (name, description). Two runs are comparable only on the same revision. Keys
 * are emitted in a fixed order so the same course always gives the same string.
 */
export function revisionInput(c: Course): string {
  const r = c.rules;
  const rules: (number | boolean | string)[] = [
    r.missedGatePenaltyS,
    r.missedGateIsDnf,
    r.wrongDirectionPenaltyS,
    r.attitudePenaltyS,
    r.tooHighPenaltyS,
    r.pylonHitPenaltyS,
    r.turnCutPenaltyS,
    r.levelToleranceDeg,
    r.knifeToleranceDeg,
  ];
  // Rules added after v0.2 join the list only when they differ from their default, so the courses
  // (and the runs) of earlier versions keep their revision.
  const later = rulesSchema.parse({});
  for (const key of ["pylonHitRadiusM", "pylonHeightM", "tooLowPenaltyS", "invertedToleranceDeg", "pylonSize"] as const) {
    if (r[key] !== later[key]) rules.push(`${key}=${r[key]}`);
  }
  const gates = c.gates.map((g) => {
    const gate = [
      g.type,
      g.center.lon.toFixed(7),
      g.center.lat.toFixed(7),
      g.widthM.toFixed(2),
      g.headingDeg.toFixed(2),
      g.topM === null ? null : g.topM.toFixed(2),
      g.groundElevM === null ? null : g.groundElevM.toFixed(2),
      g.turnSide,
    ];
    // The pylon model is cosmetic, except for its height (at the course's pylon size): it joins only
    // when it differs from the course-wide one (so courses with krzysk1's models, of unknown height,
    // keep their revision).
    const pylonHeightM = pylonHeightFor(g, r);
    if (pylonHeightM !== r.pylonHeightM) gate.push(`pylonHeightM=${pylonHeightM.toFixed(2)}`);
    // Added in v0.6: only a gate that has one changes its revision.
    if (g.bottomM !== null) gate.push(`bottomM=${g.bottomM.toFixed(2)}`);
    return gate;
  });
  return JSON.stringify({ laps: c.laps, rules, gates });
}

/** Short, stable revision id (FNV-1a 64-bit, hex). Not a security hash — it only detects change. */
export function courseRevision(c: Course): string {
  return fnv1a64(revisionInput(c));
}

export function fnv1a64(text: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= BigInt(byte);
    h = (h * prime) & mask;
  }
  return h.toString(16).padStart(16, "0");
}

/** The gate the pilot must aim for at each step of a race: one lap expanded `laps` times. */
export function raceSequence(c: Pick<Course, "gates" | "laps">): number[] {
  const n = c.gates.length;
  if (c.laps === 1) return Array.from({ length: n }, (_, i) => i);
  const seq = [0];
  for (let lap = 0; lap < c.laps; lap++) {
    for (let i = 1; i < n; i++) seq.push(i);
    seq.push(0);
  }
  return seq;
}
