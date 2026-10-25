// Everything the app keeps on disk, under userData:
//   courses/<id>.json   one native course per file
//   runs/<id>.json      one run per file (with its track)
//   settings.json       pilots, X-Plane folder override, last course, removed samples, chosen classes
// Files are validated on the way in; a file that fails is logged and skipped, never fatal. Run
// summaries are cached in memory after the first read (the tracks make run files large). The
// runs/imported/ folder of v0.4.0-pre (runs from .pylonrun files) is left alone and never read.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { courseRevision, parseCourse, type Course } from "../core/course/course";
import { SAMPLE_EARLIER_STAMPS, sampleCourses } from "../core/demo/sampleCourses";
import type { ClassChoices } from "../core/ranking/classes";
import { parseRun, type Run } from "../core/run/run";
import { summarizeRun } from "../core/run/summaries";
import type { RunSummary } from "../shared/racerApi";
import { writeFileAtomic } from "./fsAtomic";
import { log } from "./log";

const settingsSchema = z.object({
  /** The active pilot. */
  pilot: z.string().min(1).max(32).default("Pilot"),
  /** Every pilot of this computer (brothers who compete), the active one included once it changed. */
  pilots: z.array(z.string().min(1).max(32)).default([]),
  /** Overrides the X-Plane 12 folder found in Laminar's installation list. */
  xplaneDir: z.string().nullable().default(null),
  lastCourseId: z.string().nullable().default(null),
  /** Sample courses the user deleted: not seeded again. */
  removedSamples: z.array(z.string()).default([]),
  /** Keep the window above the simulator (one monitor, X-Plane windowed). */
  onTop: z.boolean().default(false),
  /** Classes chosen for aircraft the app does not know, by ICAO type code. */
  aircraftClasses: z.record(z.string(), z.string()).default({}),
  /** The class flown when X-Plane does not say which aircraft (its Web API off). */
  noAircraftClass: z.string().nullable().default(null),
});
export type Settings = z.infer<typeof settingsSchema>;

export function classChoicesOf(s: Settings): ClassChoices {
  return { aircraft: s.aircraftClasses, noAircraft: s.noAircraftClass };
}

/** File names are derived from ids; anything else in an id is refused rather than escaped. */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;

export class Storage {
  private readonly coursesDir: string;
  private readonly runsDir: string;
  private readonly settingsFile: string;
  private runCache: Map<string, RunSummary> | null = null;

  constructor(userData: string) {
    this.coursesDir = path.join(userData, "courses");
    this.runsDir = path.join(userData, "runs");
    this.settingsFile = path.join(userData, "settings.json");
  }

  /** Create the folders and seed any sample course that is missing and was not deleted by the user,
   *  so a sample added in a new version reaches existing installs too. A sample the user never saved
   *  (its stamp is one the app shipped, SAMPLE_EARLIER_STAMPS) takes the newer text of the same
   *  revision; its runs stay comparable. */
  init(): void {
    mkdirSync(this.coursesDir, { recursive: true });
    mkdirSync(this.runsDir, { recursive: true });
    const removed = new Set(this.readSettings().removedSamples);
    for (const c of sampleCourses()) {
      if (removed.has(c.id)) continue;
      let stored: Course | null = null;
      try {
        stored = this.getCourse(c.id);
      } catch {
        continue; // unreadable: leave it for the user, never overwrite
      }
      if (!stored) this.writeCourse(c);
      else if (
        stored.updatedAt !== c.updatedAt &&
        (SAMPLE_EARLIER_STAMPS[c.id] ?? []).includes(stored.updatedAt) &&
        courseRevision(stored) === courseRevision(c)
      ) {
        this.writeCourse(c);
      }
    }
  }

  // --- settings -----------------------------------------------------------------------------------

  readSettings(): Settings {
    try {
      return settingsSchema.parse(JSON.parse(readFileSync(this.settingsFile, "utf8")));
    } catch {
      return settingsSchema.parse({});
    }
  }

  writeSettings(patch: Partial<Settings>): Settings {
    const next = settingsSchema.parse({ ...this.readSettings(), ...patch });
    writeFileAtomic(this.settingsFile, JSON.stringify(next, null, 2) + "\n");
    return next;
  }

  // --- courses ------------------------------------------------------------------------------------

  private courseFile(id: string): string {
    return path.join(this.coursesDir, `${id}.json`);
  }

  listCourses(): Course[] {
    const out: Course[] = [];
    for (const name of safeReaddir(this.coursesDir)) {
      if (!name.endsWith(".json")) continue;
      try {
        out.push(parseCourse(JSON.parse(readFileSync(path.join(this.coursesDir, name), "utf8"))));
      } catch (e) {
        log.warn(`skipping unreadable course ${name}`, e);
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  getCourse(id: string): Course | null {
    if (!SAFE_ID.test(id)) return null;
    const file = this.courseFile(id);
    if (!existsSync(file)) return null;
    return parseCourse(JSON.parse(readFileSync(file, "utf8")));
  }

  /** A fresh id derived from the name: readable in file and folder names, never clashing. */
  newCourseId(name: string): string {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "course";
    let id = base;
    for (let n = 2; existsSync(this.courseFile(id)); n++) id = `${base}-${n}`;
    return id;
  }

  /**
   * Store an imported course. Re-importing the same course is a no-op; a DIFFERENT course whose id is
   * already taken gets a numbered id, so an import never overwrites a course that has runs.
   */
  addCourse(course: Course): Course {
    let id = SAFE_ID.test(course.id) ? course.id : "course";
    for (let n = 2; ; n++) {
      const existing = this.getCourse(id);
      if (!existing) break;
      if (courseRevision(existing) === courseRevision(course) && existing.name === course.name) return existing;
      id = `${course.id.slice(0, 70)}-${n}`;
    }
    const stored = { ...course, id };
    this.writeCourse(stored);
    return stored;
  }

  /** Write a course from the designer (create or overwrite by id). */
  saveCourse(course: Course): void {
    if (!SAFE_ID.test(course.id)) throw new Error(`Unsafe course id ${course.id}`);
    this.writeCourse(course);
  }

  deleteCourse(id: string): void {
    if (!SAFE_ID.test(id)) throw new Error(`Unsafe course id ${id}`);
    rmSync(this.courseFile(id), { force: true });
    if (sampleCourses().some((c) => c.id === id)) {
      const removed = new Set(this.readSettings().removedSamples).add(id);
      this.writeSettings({ removedSamples: [...removed] });
    }
  }

  private writeCourse(c: Course): void {
    writeFileAtomic(this.courseFile(c.id), JSON.stringify(c, null, 2) + "\n");
  }

  // --- runs ---------------------------------------------------------------------------------------

  listRuns(): RunSummary[] {
    if (!this.runCache) {
      this.runCache = new Map();
      for (const name of safeReaddir(this.runsDir)) {
        if (!name.endsWith(".json")) continue;
        try {
          const run = parseRun(JSON.parse(readFileSync(path.join(this.runsDir, name), "utf8")));
          this.runCache.set(run.id, summarizeRun(run));
        } catch (e) {
          log.warn(`skipping unreadable run ${name}`, e);
        }
      }
    }
    return [...this.runCache.values()];
  }

  getRun(id: string): Run | null {
    if (!SAFE_ID.test(id)) return null;
    const file = path.join(this.runsDir, `${id}.json`);
    return existsSync(file) ? parseRun(JSON.parse(readFileSync(file, "utf8"))) : null;
  }

  saveRun(run: Run): RunSummary {
    if (!SAFE_ID.test(run.id)) throw new Error(`Unsafe run id ${run.id}`);
    writeFileAtomic(path.join(this.runsDir, `${run.id}.json`), JSON.stringify(run) + "\n");
    const summary = summarizeRun(run);
    this.listRuns(); // make sure the cache exists before adding to it
    this.runCache!.set(run.id, summary);
    return summary;
  }
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
