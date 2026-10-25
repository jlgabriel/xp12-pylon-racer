// Pure edits for the course designer. A draft may be unfinished (fewer than two gates); it becomes a
// Course only through parseCourse() when saved. Roles stay positional, so every edit ends in
// normalizeRoles(): the first gate is the start, and on a single-lap course the last is the finish.
import { COURSE_FORMAT, COURSE_VERSION, gateRoleProblem, heightWindowProblem, rulesSchema, type Course, type Gate, type GateType } from "./course";
import { destination, fromLocal, haversine, initialBearing, lerpAngle, toLocal, wrap360, type LonLat } from "../geo/geo";

export type Draft = Omit<Course, "gates"> & { gates: Gate[] };

export const MIN_WIDTH_M = 10;
export const DEFAULT_WIDTH_M = 80;
/** Gate kinds the pilot chooses for a middle gate; start and finish come from the position. */
export const MIDDLE_KINDS: readonly GateType[] = ["gate", "level", "knife", "inverted", "turn"];

export function newDraft(id: string, author: string, nowIso: string): Draft {
  return {
    format: COURSE_FORMAT,
    version: COURSE_VERSION,
    id,
    name: "New course",
    author,
    description: "",
    createdAt: nowIso,
    updatedAt: nowIso,
    laps: 1,
    gates: [],
    rules: rulesSchema.parse({}),
  };
}

/** Start first; finish last on a single-lap course; no start/finish anywhere else. */
export function normalizeRoles(d: Draft): Draft {
  const n = d.gates.length;
  const gates = d.gates.map((g, i): Gate => {
    if (i === 0) return { ...g, type: "start" };
    if (d.laps === 1 && i === n - 1 && n > 1) return { ...g, type: "finish" };
    if (g.type === "start" || g.type === "finish") return { ...g, type: "gate" };
    return g;
  });
  return { ...d, gates };
}

/** Why the draft cannot be saved yet, or null. */
export function draftProblem(d: Draft): string | null {
  if (!d.name.trim()) return "Give the course a name";
  if (d.gates.length < 2) return "Add at least two gates: click the map to place them";
  return gateRoleProblem(d.gates, d.laps) ?? heightWindowProblem(d.gates);
}

/** The width a new gate copies from its neighbour: a turn pylon's widthM is how far out it may be
 *  passed, not a gate width. */
function widthAfter(g: Gate | undefined): number {
  return g && g.type !== "turn" ? g.widthM : DEFAULT_WIDTH_M;
}

function nextGateId(d: Draft): string {
  let n = d.gates.length + 1;
  const ids = new Set(d.gates.map((g) => g.id));
  while (ids.has(`g${n}`)) n++;
  return `g${n}`;
}

/** Append a gate at `at`. It faces away from the previous gate, which is how a pilot arrives. */
export function addGate(d: Draft, at: LonLat): Draft {
  const prev = d.gates[d.gates.length - 1];
  const heading = prev && haversine(prev.center, at) > 1 ? initialBearing(prev.center, at) : (prev?.headingDeg ?? 0);
  const gate: Gate = {
    id: nextGateId(d),
    type: "gate",
    center: at,
    widthM: widthAfter(prev),
    headingDeg: Math.round(heading),
    pylon: null,
    groundElevM: null,
    topM: null,
    bottomM: null,
    turnSide: null,
  };
  // The start had nothing to face when it was placed alone: point it at the second gate.
  const before = d.gates.length === 1 ? [{ ...d.gates[0]!, headingDeg: gate.headingDeg }] : d.gates;
  return normalizeRoles({ ...d, gates: [...before, gate] });
}

/**
 * Insert a gate halfway between this one and the next (on a multi-lap course the last gate's next
 * is the start), facing along that leg. Null when there is no next gate to go towards: the finish.
 */
export function insertGateAfter(d: Draft, id: string): Draft | null {
  const i = d.gates.findIndex((g) => g.id === id);
  const a = d.gates[i];
  const b = d.gates[i + 1] ?? (d.laps > 1 && d.gates.length > 1 ? d.gates[0] : undefined);
  if (!a || !b) return null;
  const at = fromLocal({ x: toLocal(b.center, a.center).x / 2, y: toLocal(b.center, a.center).y / 2 }, a.center);
  const heading = haversine(a.center, b.center) > 1 ? initialBearing(a.center, b.center) : a.headingDeg;
  const gate: Gate = {
    id: nextGateId(d),
    type: "gate",
    center: at,
    widthM: widthAfter(a),
    headingDeg: Math.round(wrap360(heading)) % 360,
    pylon: null,
    groundElevM: null,
    topM: null,
    bottomM: null,
    turnSide: null,
  };
  return normalizeRoles({ ...d, gates: [...d.gates.slice(0, i + 1), gate, ...d.gates.slice(i + 1)] });
}

/**
 * The heading a pilot flies through this gate on the way from the previous one to the next: the
 * bisector of the two legs, so neither turn is left too tight (Juan circled twice on a corner of
 * "KDAG from runway 4" whose gate faced the leg in). The start faces the first leg and the finish
 * the last; on a multi-lap course the start line also closes the lap. Null with fewer than 2 gates.
 */
export function suggestedHeading(d: Pick<Draft, "gates" | "laps">, id: string): number | null {
  const i = d.gates.findIndex((g) => g.id === id);
  if (i < 0 || d.gates.length < 2) return null;
  const loop = d.laps > 1;
  const at = d.gates[i]!.center;
  const prev = d.gates[i - 1] ?? (loop ? d.gates[d.gates.length - 1] : undefined);
  const next = d.gates[i + 1] ?? (loop ? d.gates[0] : undefined);
  const legIn = prev && haversine(prev.center, at) > 1 ? initialBearing(prev.center, at) : null;
  const legOut = next && haversine(at, next.center) > 1 ? initialBearing(at, next.center) : null;
  const h = legIn !== null && legOut !== null ? lerpAngle(legIn, legOut, 0.5) : (legIn ?? legOut);
  return h === null ? null : Math.round(wrap360(h)) % 360;
}

export function updateGate(d: Draft, id: string, patch: Partial<Gate>): Draft {
  return normalizeRoles({ ...d, gates: d.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
}

/** Moving a gate invalidates its terrain elevation; it is fetched again on save. */
export function moveGate(d: Draft, id: string, to: LonLat): Draft {
  return updateGate(d, id, { center: to, groundElevM: null });
}

export function removeGate(d: Draft, id: string): Draft {
  return normalizeRoles({ ...d, gates: d.gates.filter((g) => g.id !== id) });
}

export function moveGateInOrder(d: Draft, id: string, delta: -1 | 1): Draft {
  const i = d.gates.findIndex((g) => g.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= d.gates.length) return d;
  const gates = [...d.gates];
  [gates[i], gates[j]] = [gates[j]!, gates[i]!];
  return normalizeRoles({ ...d, gates });
}

export function setLaps(d: Draft, laps: number): Draft {
  return normalizeRoles({ ...d, laps: Math.max(1, Math.min(50, Math.round(laps))) });
}

/** Choose a middle gate's kind; a turn pylon gets a side to be kept on. */
export function setKind(d: Draft, id: string, type: GateType): Draft {
  const g = d.gates.find((x) => x.id === id);
  if (!g) return d;
  return updateGate(d, id, { type, turnSide: type === "turn" ? (g.turnSide ?? "left") : null });
}

/** Heading from the center towards a dragged handle. */
export function headingFromHandle(center: LonLat, handle: LonLat): number {
  return Math.round(wrap360(initialBearing(center, handle)));
}

/**
 * Width from a dragged pylon, "door" style: the distance from the center measured ALONG the gate
 * line (sideways wander of the drag does not widen the gate), mirrored to both sides.
 */
export function widthFromPylon(center: LonLat, headingDeg: number, pylon: LonLat): number {
  const p = toLocal(pylon, center);
  const r = ((headingDeg + 90) * Math.PI) / 180; // the gate line points to the pilot's right
  const along = Math.abs(p.x * Math.sin(r) + p.y * Math.cos(r));
  return Math.max(MIN_WIDTH_M, Math.round(2 * along));
}

/** Where the heading handle sits: ahead of the center along the pass direction. */
export function handleOf(g: Pick<Gate, "center" | "widthM" | "headingDeg">): LonLat {
  return destination(g.center, Math.max(40, g.widthM * 0.6), g.headingDeg);
}

/** A course to draft from (for editing an existing course or duplicating it). */
export function draftOf(c: Course): Draft {
  return structuredClone(c);
}
