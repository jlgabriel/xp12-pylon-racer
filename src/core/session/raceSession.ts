// One race attempt in progress: the engine, the recorder and the bookkeeping that turns a finished
// attempt into a Run. Pure (no I/O, no clock) so the Electron main process and the browser preview's
// mock bridge drive exactly the same code.
import type { Course } from "../course/course";
import { haversine } from "../geo/geo";
import { RaceEngine, type RaceEvent, type RaceSnapshot } from "../race/engine";
import type { Fix } from "../race/fix";
import { classOfAircraft, type AircraftClassId } from "../ranking/classes";
import { Recorder, buildRun, type Run, type SourceKind } from "../run/run";

export interface SourceInfo {
  kind: SourceKind;
  hz: number;
  aircraft: string | null;
}

export interface LiveState {
  courseId: string;
  race: RaceSnapshot;
  fix: Fix | null;
  nextGate: { index: number; distanceM: number } | null;
  /** The attempt was started by a demo flight: it never ranks, so it is never a "new best". */
  demo: boolean;
}

export interface FeedResult {
  events: RaceEvent[];
  /** Set once, on the update that ends the race. */
  run: Run | null;
}

export interface SessionContext {
  /** The active pilot when the session begins; setPilot changes it. */
  pilot: string;
  appVersion: string;
  newId: () => string;
  /** Wall-clock ISO time; injected so tests are deterministic. */
  nowIso: () => string;
  /** The class a run with this aircraft is ranked in, with the pilot's choices for aircraft the app
   *  does not know (and for UDP, which names none). Defaults to the built-in table only. */
  classOf?: (aircraftId: string | null) => AircraftClassId | null;
}

export class RaceSession {
  readonly engine: RaceEngine;
  private readonly recorder = new Recorder();
  private lastFix: Fix | null = null;
  private startedAt: string | null = null;
  private lastSource: SourceInfo | null = null;
  private aircraftSeen: string | null = null;
  private pilot: string;
  /** Who was flying when the race started: the run is theirs even if the pilot is switched mid-race. */
  private racePilot: string | null = null;
  /** The source that crossed the start line. */
  private raceSource: SourceKind | null = null;

  constructor(
    readonly course: Course,
    private readonly ctx: SessionContext,
  ) {
    this.engine = new RaceEngine(course);
    this.pilot = ctx.pilot;
  }

  /** Switch pilots on this computer: takes effect from the next start. */
  setPilot(pilot: string): void {
    this.pilot = pilot;
  }

  reset(): void {
    this.engine.reset();
    this.recorder.reset();
    this.lastFix = null;
    this.startedAt = null;
    this.aircraftSeen = null;
    this.racePilot = null;
    this.raceSource = null;
  }

  feed(fix: Fix, source: SourceInfo): FeedResult {
    this.lastFix = fix;
    this.lastSource = source;
    if (source.aircraft) this.aircraftSeen = source.aircraft;
    const before = this.engine.raceStatus;
    const events = this.engine.update(fix);
    const after = this.engine.raceStatus;
    if (before === "waiting" && after !== "waiting") {
      this.startedAt = this.ctx.nowIso();
      this.racePilot = this.pilot;
      this.raceSource = source.kind;
    }
    // The fix that ends a reset or a stop may be somewhere else entirely: it is not part of the track.
    const moved = events.some((e) => e.kind === "dnf" && e.reason !== "missed-gate");
    if (!moved) this.recorder.push(fix, after !== "waiting");

    let run: Run | null = null;
    if ((after === "finished" || after === "dnf") && before !== after) {
      run = buildRun(this.engine.snapshot(), this.recorder.track(), {
        id: this.ctx.newId(),
        courseName: this.course.name,
        pilot: this.racePilot ?? this.pilot,
        aircraftId: this.aircraftSeen,
        classId: (this.ctx.classOf ?? classOfAircraft)(this.aircraftSeen),
        source: source.kind,
        sourceHz: source.hz,
        startedAt: this.startedAt ?? this.ctx.nowIso(),
        appVersion: this.ctx.appVersion,
      });
    }
    return { events, run };
  }

  live(): LiveState {
    const gi = this.engine.nextGateIndex;
    const fix = this.lastFix;
    const gate = gi === null ? null : this.course.gates[gi];
    return {
      courseId: this.course.id,
      race: this.engine.snapshot(fix?.t),
      fix,
      nextGate: gi !== null && gate && fix ? { index: gi, distanceM: haversine(fix, gate.center) } : null,
      demo: this.raceSource === "demo",
    };
  }

  get source(): SourceInfo | null {
    return this.lastSource;
  }
}
