// The race engine: gate passes, order, timing, penalties.
//
// A pass is detected geometrically: the aircraft's path segment (previous fix → current fix) is
// intersected with the gate line in a local planar frame. That does not depend on how close a
// sample fell to the gate, so it works at the ~5 Hz of the UDP feed (and at 1 Hz), and the pass
// instant is interpolated along the segment, so times are sub-sample.
//
// The race is a sequence of steps (course.raceSequence): one lap, repeated `laps` times, with the
// start line closing each lap of a multi-lap course. Passing a step further ahead than the current
// one counts every step in between as missed.
//
// How a gate was passed is judged at the pass instant (interpolated):
// - level / knife / inverted gates: the bank against the course's tolerance
// - any gate with a top or a bottom: the height above the terrain (the sim's AGL, else MSL minus the
//   gate's DEM)
// - pylons: flying closer than pylonHitRadiusM to a pylon's center, below its height (the model's
//   own when known, else pylonHeightM), is a hit
//   (once per pylon and lap); checked on every segment, not only at passes
// - turn pylons: crossing the half-line on the WRONG side of the pylon still counts the step, with
//   the turn-cut penalty instead of a missed gate
// A height that cannot be known (no AGL from the source and no DEM at the gate) is never penalized.
//
// A jump between two consecutive fixes that no aircraft could fly (AFS4 resets the aircraft after a
// crash — a pylon has collision — or the pilot moves it) is not flight: that segment is never judged,
// and a race in progress ends as a DNF ("reset") at the last fix that moved before the jump. See isJump.
//
// An aircraft that does not move for STILL_S during a race ends it too, as a DNF ("stopped") at the
// moment it stopped: after a crash AFS4 holds the aircraft on its crash menu, still streaming that same
// frozen fix, until the pilot picks an option (flight test 2026-10-23: 37 s of identical fixes), and
// pausing the sim mid-race is not allowed (Juan's call). A silent feed counts the same way.
import { courseRevision, raceSequence, type Course, type Gate, type Rules } from "../course/course";
import {
  centroid,
  forwardUnit,
  lerpAngle,
  pylonsOfGate,
  destination,
  haversine,
  segmentIntersection,
  toLocal,
  type LonLat,
  type Xy,
} from "../geo/geo";
import { pylonHeightFor } from "../export/pylons";
import type { Fix } from "./fix";

export type RaceStatus = "waiting" | "running" | "finished" | "dnf";

/**
 * Why a race did not finish: a missed gate under missedGateIsDnf, the sim moved the aircraft, or the
 * aircraft stood still (a crash or a pause; they look the same from here).
 */
export const DNF_REASONS = ["missed-gate", "reset", "stopped"] as const;
export type DnfReason = (typeof DNF_REASONS)[number];

export const PENALTY_KINDS = ["missed-gate", "wrong-direction", "attitude", "too-high", "too-low", "pylon-hit", "turn-cut"] as const;
export type PenaltyKind = (typeof PENALTY_KINDS)[number];

export interface Penalty {
  kind: PenaltyKind;
  step: number;
  gateIndex: number;
  /** Race time (raw) at which it was assessed. */
  elapsed: number;
  seconds: number;
  /** What was measured: bank ° (attitude), m above the terrain (too-high, too-low), m from the pylon (pylon-hit). */
  measured: number | null;
}

export interface Pass {
  step: number;
  gateIndex: number;
  /** Lap this pass belongs to, 1-based (the closing start-line pass belongs to the lap it closes). */
  lap: number;
  /** Source time of the pass (interpolated). */
  t: number;
  /** Raw seconds since the start pass. */
  elapsed: number;
  altMslM: number;
  aglM: number | null;
  rollDeg: number;
  gsMs: number;
  /** Signed distance from the gate center along the gate line, meters (negative = left side). */
  offsetM: number;
}

export type RaceEvent =
  | { kind: "started"; pass: Pass }
  | { kind: "pass"; pass: Pass }
  | { kind: "lap"; lap: number; lapTime: number; pass: Pass }
  | { kind: "penalty"; penalty: Penalty }
  | { kind: "finished"; pass: Pass; total: number }
  | { kind: "dnf"; reason: DnfReason; elapsed: number };

export interface RaceSnapshot {
  courseId: string;
  revision: string;
  status: RaceStatus;
  /** Set when status is "dnf". */
  dnfReason: DnfReason | null;
  /** Index into `sequence` of the next step to fly. */
  step: number;
  sequence: number[];
  laps: number;
  /** Current lap, 1-based (laps when finished). */
  lap: number;
  raw: number;
  penaltyTotal: number;
  total: number;
  passes: Pass[];
  penalties: Penalty[];
  lapTimes: number[];
}

interface GateLine {
  a: Xy;
  b: Xy;
  fwd: Xy;
  widthM: number;
  /** Turn pylons: the half-line on the wrong side of the pylon. */
  cut: { a: Xy; b: Xy } | null;
  /** Pylon positions: two for a gate, one for a turn pylon. */
  pylons: Xy[];
}

/** Something that happens along one path segment, at fraction f of it. */
type Happening =
  | { kind: "cross" | "cut"; gateIndex: number; f: number; u: number; forward: boolean }
  | { kind: "near"; gateIndex: number; pylon: number; f: number; distanceM: number };

/** Where a gate's pass line lies, in lon/lat. Shared with the map so what is drawn is what is judged. */
export function gatePassLine(g: Gate): { a: LonLat; b: LonLat } {
  if (g.type === "turn") {
    // A turn pylon is passed by crossing the half-line from the pylon out to the side the aircraft
    // must fly. Keeping the pylon on your LEFT means flying to its right.
    const side = g.turnSide === "left" ? 90 : -90;
    return { a: g.center, b: destination(g.center, g.widthM, g.headingDeg + side) };
  }
  const { left, right } = pylonsOfGate(g.center, g.widthM, g.headingDeg);
  return { a: left, b: right };
}

/** The wrong side of a turn pylon: the mirror of its pass line. */
export function turnCutLine(g: Gate): { a: LonLat; b: LonLat } {
  const side = g.turnSide === "left" ? -90 : 90;
  return { a: g.center, b: destination(g.center, g.widthM, g.headingDeg + side) };
}

/** Height above the terrain, or null when it cannot be known. */
export function heightAboveGround(f: Pick<Fix, "aglM" | "altMslM">, g: Pick<Gate, "groundElevM">): number | null {
  if (f.aglM !== null) return f.aglM;
  return g.groundElevM !== null ? f.altMslM - g.groundElevM : null;
}

export function penaltySeconds(r: Rules, kind: PenaltyKind): number {
  switch (kind) {
    case "missed-gate":
      return r.missedGatePenaltyS;
    case "wrong-direction":
      return r.wrongDirectionPenaltyS;
    case "attitude":
      return r.attitudePenaltyS;
    case "too-high":
      return r.tooHighPenaltyS;
    case "too-low":
      return r.tooLowPenaltyS;
    case "pylon-hit":
      return r.pylonHitPenaltyS;
    case "turn-cut":
      return r.turnCutPenaltyS;
  }
}

export class RaceEngine {
  readonly course: Course;
  readonly revision: string;
  readonly sequence: number[];
  readonly ref: LonLat;
  private readonly lines: GateLine[];

  private status: RaceStatus = "waiting";
  private dnfReason: DnfReason | null = null;
  private step = 0;
  private prev: Fix | null = null;
  private last: Fix | null = null;
  /** Time of the last fix whose position differed from the one before it. */
  private movedT: number | null = null;
  private startT: number | null = null;
  private endT: number | null = null;
  private passes: Pass[] = [];
  private penalties: Penalty[] = [];
  private lapTimes: number[] = [];
  private lapStartElapsed = 0;
  private wrongWayPenalized = new Set<number>();
  private pylonsHit = new Set<string>();

  constructor(course: Course) {
    this.course = course;
    this.revision = courseRevision(course);
    this.sequence = raceSequence(course);
    this.ref = centroid(course.gates.map((g) => g.center));
    const local = (p: LonLat): Xy => toLocal(p, this.ref);
    this.lines = course.gates.map((g) => {
      const { a, b } = gatePassLine(g);
      const turn = g.type === "turn";
      const cut = turn ? turnCutLine(g) : null;
      const { left, right } = pylonsOfGate(g.center, g.widthM, g.headingDeg);
      return {
        a: local(a),
        b: local(b),
        fwd: forwardUnit(g.headingDeg),
        widthM: g.widthM,
        cut: cut ? { a: local(cut.a), b: local(cut.b) } : null,
        pylons: turn ? [local(g.center)] : [local(left), local(right)],
      };
    });
  }

  reset(): void {
    this.status = "waiting";
    this.dnfReason = null;
    this.step = 0;
    this.prev = null;
    this.last = null;
    this.movedT = null;
    this.startT = null;
    this.endT = null;
    this.passes = [];
    this.penalties = [];
    this.lapTimes = [];
    this.lapStartElapsed = 0;
    this.wrongWayPenalized = new Set();
    this.pylonsHit = new Set();
  }

  get raceStatus(): RaceStatus {
    return this.status;
  }

  /** Index of the gate the pilot should fly next, or null when the race is over. */
  get nextGateIndex(): number | null {
    if (this.status === "finished" || this.status === "dnf") return null;
    return this.sequence[this.step] ?? null;
  }

  raw(nowT?: number): number {
    if (this.startT === null) return 0;
    const end = this.endT ?? nowT ?? this.last?.t ?? this.startT;
    return Math.max(0, end - this.startT);
  }

  penaltyTotal(): number {
    return this.penalties.reduce((s, p) => s + p.seconds, 0);
  }

  total(nowT?: number): number {
    return this.raw(nowT) + this.penaltyTotal();
  }

  /** Feed one fix; returns the events it produced, in time order. */
  update(fix: Fix): RaceEvent[] {
    const prev = this.prev;
    if (prev !== null && fix.t <= prev.t) return []; // duplicate or out-of-order sample
    this.last = fix;
    this.prev = fix;
    const movedT = this.movedT;
    if (prev === null || fix.lon !== prev.lon || fix.lat !== prev.lat) this.movedT = fix.t;
    if (prev === null || this.status === "finished" || this.status === "dnf") return [];
    // Both end the attempt when the aircraft stopped moving, not at the last (frozen) fix.
    if (this.status === "running" && movedT !== null && fix.t - movedT >= STILL_S) return [this.endAsDnf("stopped", movedT)];
    if (isJump(prev, fix)) {
      // Waiting: the new position is simply where the aircraft is now. Racing: the attempt is over.
      if (this.status !== "running") return [];
      return [this.endAsDnf("reset", movedT ?? prev.t)];
    }

    // Which crossings count is decided one by one, in time order, because one sample can start the
    // race and pass the next gates too.
    const events: RaceEvent[] = [];
    for (const h of this.happenings(toLocal(prev, this.ref), toLocal(fix, this.ref))) {
      if (this.isOver()) break; // something earlier in this same segment ended the race
      const at = interpolate(prev, fix, h.f);
      if (h.kind === "near") {
        events.push(...this.judgeNearPylon(h.gateIndex, h.pylon, h.distanceM, at));
        continue;
      }
      const line = this.lines[h.gateIndex]!;
      if (h.kind === "cut") {
        if (h.forward && this.status === "running" && this.sequence[this.step] === h.gateIndex) {
          events.push(...this.handlePass(this.step, at, -h.u * line.widthM, true));
        }
      } else if (h.forward) {
        const turn = this.course.gates[h.gateIndex]!.type === "turn";
        const offsetM = turn ? h.u * line.widthM : (h.u - 0.5) * line.widthM;
        const step = this.findStep(h.gateIndex);
        if (step !== null) events.push(...this.handlePass(step, at, offsetM, false));
      } else if (this.status === "running" && this.sequence[this.step] === h.gateIndex && !this.wrongWayPenalized.has(this.step)) {
        this.wrongWayPenalized.add(this.step);
        events.push(this.addPenalty("wrong-direction", this.step, h.gateIndex, at.t, null));
      }
    }
    return events;
  }

  snapshot(nowT?: number): RaceSnapshot {
    const lap = Math.min(this.course.laps, this.lapTimes.length + 1);
    return {
      courseId: this.course.id,
      revision: this.revision,
      status: this.status,
      dnfReason: this.dnfReason,
      step: this.step,
      sequence: this.sequence,
      laps: this.course.laps,
      lap,
      raw: this.raw(nowT),
      penaltyTotal: this.penaltyTotal(),
      total: this.total(nowT),
      passes: [...this.passes],
      penalties: [...this.penalties],
      lapTimes: [...this.lapTimes],
    };
  }

  // ------------------------------------------------------------------------------------------------

  private isOver(): boolean {
    return this.status === "finished" || this.status === "dnf";
  }

  /** Every line crossed and every close pass of a pylon along p→c, in time order. */
  private happenings(p: Xy, c: Xy): Happening[] {
    const move = { x: c.x - p.x, y: c.y - p.y };
    const len2 = move.x * move.x + move.y * move.y;
    const radius = this.course.rules.pylonHitRadiusM;
    const out: Happening[] = [];
    for (let gi = 0; gi < this.lines.length; gi++) {
      const line = this.lines[gi]!;
      const forward = move.x * line.fwd.x + move.y * line.fwd.y > 0;
      const x = segmentIntersection(p, c, line.a, line.b);
      if (x) out.push({ kind: "cross", gateIndex: gi, f: x.t, u: x.u, forward });
      if (line.cut) {
        const y = segmentIntersection(p, c, line.cut.a, line.cut.b);
        if (y) out.push({ kind: "cut", gateIndex: gi, f: y.t, u: y.u, forward });
      }
      line.pylons.forEach((q, pylon) => {
        // closest approach of the segment to the pylon
        const f = len2 > 0 ? Math.max(0, Math.min(1, ((q.x - p.x) * move.x + (q.y - p.y) * move.y) / len2)) : 0;
        const d = Math.hypot(p.x + f * move.x - q.x, p.y + f * move.y - q.y);
        if (d < radius) out.push({ kind: "near", gateIndex: gi, pylon, f, distanceM: d });
      });
    }
    return out.sort((a, b) => a.f - b.f);
  }

  private endAsDnf(reason: DnfReason, t: number): RaceEvent {
    this.status = "dnf";
    this.dnfReason = reason;
    this.endT = t;
    return { kind: "dnf", reason, elapsed: this.raw(t) };
  }

  private findStep(gateIndex: number): number | null {
    if (this.status === "waiting") return gateIndex === this.sequence[0] ? 0 : null;
    for (let s = this.step; s < this.sequence.length; s++) if (this.sequence[s] === gateIndex) return s;
    return null;
  }

  private handlePass(step: number, at: Fix, offsetM: number, cut: boolean): RaceEvent[] {
    const events: RaceEvent[] = [];
    if (this.status === "waiting") {
      this.startT = at.t;
      this.status = "running";
      const pass = this.makePass(0, at, offsetM);
      this.passes.push(pass);
      this.step = 1;
      events.push({ kind: "started", pass }, ...this.judgePass(pass, at));
      return events;
    }

    for (let s = this.step; s < step; s++) {
      if (this.course.rules.missedGateIsDnf) {
        events.push(this.endAsDnf("missed-gate", at.t));
        return events;
      }
      events.push(this.addPenalty("missed-gate", s, this.sequence[s]!, at.t, null));
    }

    const pass = this.makePass(step, at, offsetM);
    this.passes.push(pass);
    this.step = step + 1;
    events.push({ kind: "pass", pass });
    if (cut) events.push(this.addPenalty("turn-cut", step, pass.gateIndex, at.t, null));
    events.push(...this.judgePass(pass, at));

    const closesLap = this.course.laps > 1 && step > 0 && this.sequence[step] === 0;
    if (closesLap) {
      const lapTime = pass.elapsed - this.lapStartElapsed;
      this.lapStartElapsed = pass.elapsed;
      this.lapTimes.push(lapTime);
      events.push({ kind: "lap", lap: this.lapTimes.length, lapTime, pass });
    } else if (this.course.laps === 1 && step === this.sequence.length - 1) {
      this.lapTimes.push(pass.elapsed);
    }

    if (this.step >= this.sequence.length) {
      this.status = "finished";
      this.endT = at.t;
      events.push({ kind: "finished", pass, total: this.total() });
    }
    return events;
  }

  /** Attitude and height at a pass. */
  private judgePass(pass: Pass, at: Fix): RaceEvent[] {
    const gate = this.course.gates[pass.gateIndex]!;
    const r = this.course.rules;
    const events: RaceEvent[] = [];
    const bank = Math.abs(pass.rollDeg);
    const wrongAttitude =
      (gate.type === "level" && bank > r.levelToleranceDeg) ||
      (gate.type === "knife" && Math.abs(bank - 90) > r.knifeToleranceDeg) ||
      (gate.type === "inverted" && 180 - bank > r.invertedToleranceDeg);
    if (wrongAttitude) events.push(this.addPenalty("attitude", pass.step, pass.gateIndex, at.t, pass.rollDeg));
    const height = heightAboveGround(at, gate);
    if (gate.topM !== null && height !== null && height > gate.topM) {
      events.push(this.addPenalty("too-high", pass.step, pass.gateIndex, at.t, height));
    }
    if (gate.bottomM !== null && height !== null && height < gate.bottomM) {
      events.push(this.addPenalty("too-low", pass.step, pass.gateIndex, at.t, height));
    }
    return events;
  }

  /** A close pass of a pylon while racing: a hit unless above the pylon. Once per pylon and lap. */
  private judgeNearPylon(gateIndex: number, pylon: number, distanceM: number, at: Fix): RaceEvent[] {
    if (this.status !== "running") return [];
    const gate = this.course.gates[gateIndex]!;
    const height = heightAboveGround(at, gate);
    if (height !== null && height >= pylonHeightFor(gate, this.course.rules)) return [];
    const lap = Math.min(this.course.laps, this.lapTimes.length + 1);
    const key = `${gateIndex}:${pylon}:${lap}`;
    if (this.pylonsHit.has(key)) return [];
    this.pylonsHit.add(key);
    return [this.addPenalty("pylon-hit", Math.min(this.step, this.sequence.length - 1), gateIndex, at.t, distanceM)];
  }

  private makePass(step: number, at: Fix, offsetM: number): Pass {
    return {
      step,
      gateIndex: this.sequence[step]!,
      lap: Math.min(this.course.laps, this.lapTimes.length + 1),
      t: at.t,
      elapsed: this.startT === null ? 0 : at.t - this.startT,
      altMslM: at.altMslM,
      aglM: at.aglM,
      rollDeg: at.rollDeg,
      gsMs: at.gsMs,
      offsetM,
    };
  }

  private addPenalty(kind: PenaltyKind, step: number, gateIndex: number, t: number, measured: number | null): RaceEvent {
    const penalty: Penalty = { kind, step, gateIndex, elapsed: this.raw(t), seconds: penaltySeconds(this.course.rules, kind), measured };
    this.penalties.push(penalty);
    return { kind: "penalty", penalty };
  }
}

/**
 * Below this, a move between two fixes is never a jump. A real sample moves 2–10 m at 40 Hz and
 * 20–60 m at 5 Hz, and the hub can stamp two DLL lines only 0.1 ms apart, so a speed test alone
 * would fire on timestamp jitter.
 */
export const JUMP_MIN_M = 250;
/**
 * Racing with no change of position for this long is a DNF. At 40 Hz the DLL repeats a position for
 * 25–50 ms (the sim updates slower), and a scenery-loading stutter lasts under a second.
 */
export const STILL_S = 3;
/** Slack over the faster ground speed reported at either end, for noise and for speeding up mid-gap. */
export const JUMP_SPEED_FACTOR = 1.5;
export const JUMP_SPEED_SLACK_MS = 20;

/** What isJump needs of a fix; the minimap's trail keeps just this. */
export type JumpSample = Pick<Fix, "lon" | "lat" | "t" | "gsMs">;

/**
 * Whether a → b is a teleport rather than flight: farther than JUMP_MIN_M and farther than the
 * ground speed reported at both ends could have carried the aircraft in the time between them.
 *
 * Judged against the reported ground speed rather than a fixed ceiling (e.g. 300 m/s) because AFS4
 * has jets that fly faster than that, and because after a crash the sim may sit frozen for a while
 * before the reset arrives: a 3 km jump 20 s later is only 150 m/s, yet the aircraft reported 0.
 * (The DLL keeps streaming the frozen fix meanwhile, so in practice the jump lands between two
 * fixes a few ms apart.)
 * A real gap in the feed keeps the straight-line distance at or below speed × time; the faster end
 * is the bound (not the mean), so braking hard across a gap is never taken for a jump.
 */
export function isJump(a: JumpSample, b: JumpSample): boolean {
  const d = haversine(a, b);
  if (d <= JUMP_MIN_M) return false;
  const dt = b.t - a.t;
  const reachable = JUMP_SPEED_FACTOR * Math.max(a.gsMs, b.gsMs) + JUMP_SPEED_SLACK_MS;
  return d > reachable * dt;
}

/** The aircraft state a fraction f of the way from a to b. Angles take the short way round. */
export function interpolate(a: Fix, b: Fix, f: number): Fix {
  const lin = (x: number, y: number): number => x + (y - x) * f;
  return {
    t: lin(a.t, b.t),
    lon: lin(a.lon, b.lon),
    lat: lin(a.lat, b.lat),
    altMslM: lin(a.altMslM, b.altMslM),
    aglM: a.aglM !== null && b.aglM !== null ? lin(a.aglM, b.aglM) : (b.aglM ?? a.aglM),
    trackDeg: lerpAngle(a.trackDeg, b.trackDeg, f),
    gsMs: lin(a.gsMs, b.gsMs),
    headingDeg: lerpAngle(a.headingDeg, b.headingDeg, f),
    pitchDeg: lin(a.pitchDeg, b.pitchDeg),
    rollDeg: lerpAngle(a.rollDeg, b.rollDeg, f),
  };
}
