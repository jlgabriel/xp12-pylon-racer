// The race controller: the active course, the attempt in progress, and the push of live state to
// the window. Runs in main so the timing never depends on the renderer keeping up; the renderer only
// draws what it receives.
import { randomUUID } from "node:crypto";
import type { Course } from "../core/course/course";
import { resolveClass } from "../core/ranking/classes";
import { summarizeCourse } from "../core/run/summaries";
import { RaceSession } from "../core/session/raceSession";
import type { CourseSummary, LiveUpdate, RunSummary } from "../shared/racerApi";
import { log } from "./log";
import type { DisplayLink } from "./display";
import { classChoicesOf, type Storage } from "./storage";
import type { TelemetryHub } from "./telemetry";

declare const __APP_VERSION__: string;

const LIVE_PUSH_MS = 50; // ~20 Hz to the screen; the engine itself sees every fix
const IDLE_PUSH_MS = 500; // telemetry status keeps updating with no fixes at all

export interface Sink {
  live(u: LiveUpdate): void;
  runSaved(r: RunSummary): void;
}

export class RaceController {
  private session: RaceSession | null = null;
  private sink: Sink | null = null;
  private lastPush = 0;
  private idleTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly storage: Storage,
    private readonly hub: TelemetryHub,
    private readonly display: DisplayLink,
  ) {
    hub.onFix((fix, source) => {
      if (!this.session) return;
      const { run } = this.session.feed(fix, source);
      if (run) {
        try {
          const summary = this.storage.saveRun(run);
          log.info(`run saved: ${run.courseName} ${run.result.status} ${run.result.total.toFixed(2)} s (${source.kind})`);
          this.sink?.runSaved(summary);
        } catch (e) {
          log.error("could not save the run", e);
        }
        this.push(true);
      } else {
        this.push(false);
      }
    });
  }

  attach(sink: Sink): void {
    this.sink = sink;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => this.push(false), IDLE_PUSH_MS);
  }

  detach(): void {
    this.sink = null;
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
  }

  select(course: Course): CourseSummary {
    this.hub.stopDemo();
    this.session = new RaceSession(course, {
      pilot: this.storage.readSettings().pilot,
      appVersion: __APP_VERSION__,
      newId: () => randomUUID(),
      nowIso: () => new Date().toISOString(),
      classOf: (aircraftId) => resolveClass(aircraftId, classChoicesOf(this.storage.readSettings())),
    });
    log.info(`course selected: ${course.name} (${course.id})`);
    this.push(true);
    return summarizeCourse(course, this.storage.listRuns());
  }

  /** The pilot of the attempts from now on (the one in progress keeps whoever started it). */
  setPilot(pilot: string): void {
    this.session?.setPilot(pilot);
  }

  get activeCourse(): Course | null {
    return this.session?.course ?? null;
  }

  reset(): void {
    this.hub.stopDemo();
    this.session?.reset();
    this.push(true);
  }

  startDemo(): boolean {
    const course = this.session?.course;
    if (!course) return false;
    this.session!.reset();
    this.hub.startDemo(course, () => this.push(true));
    this.push(true);
    return true;
  }

  stopDemo(): void {
    this.hub.stopDemo();
    this.push(true);
  }

  private push(force: boolean): void {
    if (!this.sink) return;
    const t = Date.now();
    if (!force && t - this.lastPush < LIVE_PUSH_MS) return;
    this.lastPush = t;
    const u: LiveUpdate = { telemetry: this.hub.status(), live: this.session?.live() ?? null, display: this.display.status() };
    this.sink.live(u);
    this.display.send(u, this.session?.course ?? null);
  }
}
