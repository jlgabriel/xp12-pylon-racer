// A synthetic flight through a course, used by the demo mode (try the app without the sim), by the
// tests, and for screenshots. It flies straight lines through the gate centers in race order, at a
// constant speed, with a lead-in before the start and a lead-out after the end; the bank angle is the
// coordinated-turn bank for the heading change, so attitude-dependent screens have something to show.
// It flies by the rules, so a demo run is clean: wings level through level gates, knife edge through
// knife gates, upside down through inverted gates, turn pylons rounded on their side, and inside
// every gate's height window.
import { raceSequence, type Course } from "../course/course";
import { destination, fromLocal, haversine, initialBearing, toLocal, wrap180, type LonLat } from "../geo/geo";
import type { Fix } from "../race/fix";

export interface DemoOptions {
  speedMs?: number;
  rateHz?: number;
  /** Height above the gates' terrain (or above sea level when the terrain is unknown). */
  heightM?: number;
  leadInM?: number;
  leadOutM?: number;
}

const G = 9.80665;
/** How far either side of a level or knife gate the demo holds the attitude. */
const ATTITUDE_ZONE_M = 60;

/** Where the demo flies through a gate: its center, or beside a turn pylon on the side to pass. */
function aimPoint(g: Course["gates"][number]): LonLat {
  if (g.type !== "turn") return g.center;
  const side = g.turnSide === "left" ? 90 : -90; // keep it on the left = fly to its right
  return destination(g.center, Math.min(g.widthM / 2, 60), g.headingDeg + side);
}

/** A height inside the gate's window: the demo's own when it fits, else the middle of the window. */
function heightFor(g: Pick<Course["gates"][number], "topM" | "bottomM">, preferred: number): number {
  const lo = g.bottomM ?? 0;
  const hi = g.topM ?? Infinity;
  if (preferred > lo && preferred < hi * 0.7) return preferred;
  return Number.isFinite(hi) ? (lo + hi) / 2 : lo + 20;
}

export function demoFlight(course: Course, opts: DemoOptions = {}): Fix[] {
  const speed = opts.speedMs ?? 80;
  const rate = opts.rateHz ?? 10;
  const height = opts.heightM ?? 30;
  const seq = raceSequence(course);
  const first = course.gates[seq[0]!]!;
  const last = course.gates[seq[seq.length - 1]!]!;

  const waypoints: LonLat[] = [destination(first.center, opts.leadInM ?? 400, first.headingDeg + 180)];
  for (const gi of seq) waypoints.push(aimPoint(course.gates[gi]!));
  waypoints.push(destination(last.center, opts.leadOutM ?? 300, last.headingDeg));

  const ref = waypoints[0]!;
  const pts = waypoints.map((w) => toLocal(w, ref));
  const lens = waypoints.slice(1).map((w, i) => haversine(waypoints[i]!, w));
  const totalLen = lens.reduce((a, b) => a + b, 0);
  const step = speed / rate;

  const raw: { p: LonLat; track: number }[] = [];
  for (let s = 0; s <= totalLen; s += step) {
    let rem = s;
    let i = 0;
    while (i < lens.length - 1 && rem > lens[i]!) rem -= lens[i++]!;
    const f = lens[i]! > 0 ? rem / lens[i]! : 0;
    const a = pts[i]!;
    const b = pts[i + 1]!;
    raw.push({
      p: fromLocal({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) }, ref),
      track: initialBearing(waypoints[i]!, waypoints[i + 1]!),
    });
  }

  const nearestGate = (p: LonLat): { gate: Course["gates"][number]; distanceM: number } => {
    let best = course.gates[0]!;
    for (const g of course.gates) if (haversine(g.center, p) < haversine(best.center, p)) best = g;
    return { gate: best, distanceM: haversine(best.center, p) };
  };

  return raw.map((r, i) => {
    const before = raw[Math.max(0, i - 2)]!.track;
    const after = raw[Math.min(raw.length - 1, i + 2)]!.track;
    const turnRate = (wrap180(after - before) * Math.PI) / 180 / (4 / rate); // rad/s over ±2 samples
    const turnRoll = Math.max(-80, Math.min(80, (Math.atan((speed * turnRate) / G) * 180) / Math.PI));
    const near = nearestGate(r.p);
    const atGate = near.distanceM < ATTITUDE_ZONE_M;
    const kind = atGate ? near.gate.type : null;
    const roll = kind === "level" ? 0 : kind === "knife" ? 90 : kind === "inverted" ? 180 : turnRoll;
    const agl = heightFor(near.gate, height);
    return {
      t: i / rate,
      lon: r.p.lon,
      lat: r.p.lat,
      altMslM: (near.gate.groundElevM ?? 0) + agl,
      aglM: agl,
      trackDeg: r.track,
      gsMs: speed,
      headingDeg: r.track,
      pitchDeg: 0,
      rollDeg: roll,
    };
  });
}
