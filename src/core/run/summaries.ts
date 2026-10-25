// Small views over courses and runs for lists. Pure, shared by main and the preview's mock bridge.
import { courseRevision, raceSequence, type Course } from "../course/course";
import { packSceneryId } from "../export/pack";
import { haversine } from "../geo/geo";
import type { CourseSummary, RunSummary, SketchPoint } from "../../shared/racerApi";
import type { Run } from "./run";

export function summarizeRun(r: Run): RunSummary {
  return {
    id: r.id,
    courseId: r.courseId,
    courseRevision: r.courseRevision,
    status: r.result.status,
    dnfReason: r.result.dnfReason,
    total: r.result.total,
    raw: r.result.raw,
    penaltyTotal: r.result.penaltyTotal,
    aircraftId: r.aircraft.id,
    classId: r.aircraft.classId,
    source: r.source.kind,
    sourceHz: r.source.hz,
    pilot: r.pilot,
    startedAt: r.startedAt,
  };
}

/** Length of one lap through the gate centers. */
export function lapLength(c: Course): number {
  const seq = raceSequence({ gates: c.gates, laps: 1 });
  if (c.laps > 1) seq.push(0);
  let len = 0;
  for (let i = 1; i < seq.length; i++) len += haversine(c.gates[seq[i - 1]!]!.center, c.gates[seq[i]!]!.center);
  return len;
}

export interface InstalledRef {
  courseId: string;
  revision: string;
  /** What was installed (PackPlan.sceneryId). */
  sceneryId?: string;
  folderName: string;
}

export function summarizeCourse(c: Course, runs: readonly RunSummary[], installed: readonly InstalledRef[] = []): CourseSummary {
  const revision = courseRevision(c);
  const mine = runs.filter((r) => r.courseId === c.id && r.courseRevision === revision);
  const finished = mine.filter((r) => r.status === "finished" && r.source !== "demo").map((r) => r.total);
  const pack = installed.find((p) => p.courseId === c.id);
  return {
    install: pack
      ? { state: isCurrent(pack, c, revision) ? "current" : "outdated", folderName: pack.folderName }
      : { state: "none", folderName: null },
    id: c.id,
    name: c.name,
    author: c.author,
    gates: c.gates.length,
    laps: c.laps,
    revision,
    lapLengthM: lapLength(c),
    bestTotal: finished.length > 0 ? Math.min(...finished) : null,
    runs: mine.length,
    sketch: courseSketch(c),
  };
}

/** The gate centers fitted into a unit square, north up, keeping the course's proportions and
 *  centered on the short side. Enough to draw a thumbnail of the route. */
export function courseSketch(c: Pick<Course, "gates">): SketchPoint[] {
  if (c.gates.length === 0) return [];
  const lat0 = (c.gates.reduce((s, g) => s + g.center.lat, 0) / c.gates.length) * (Math.PI / 180);
  const pts = c.gates.map((g) => ({ x: g.center.lon * Math.cos(lat0), y: -g.center.lat }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const span = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) || 1;
  const dx = (1 - (Math.max(...xs) - x0) / span) / 2;
  const dy = (1 - (Math.max(...ys) - y0) / span) / 2;
  const r = (v: number): number => Math.round(v * 1000) / 1000;
  return c.gates.map((g, i) => ({ x: r((pts[i]!.x - x0) / span + dx), y: r((pts[i]!.y - y0) / span + dy), type: g.type }));
}

/** The installed pylons match the course: same revision and, when the folder says, the same pylons
 *  (a model swapped for one of the same height keeps the revision but not the scenery). */
function isCurrent(pack: InstalledRef, c: Course, revision: string): boolean {
  return pack.revision === revision && (pack.sceneryId === undefined || pack.sceneryId === packSceneryId(c));
}

/** Runs of a course revision, best first: finished by total, then DNFs by date. */
export function rankRuns(runs: readonly RunSummary[]): RunSummary[] {
  return [...runs].sort((a, b) => {
    if (a.status !== b.status) return a.status === "finished" ? -1 : 1;
    if (a.status === "finished") return a.total - b.total;
    return b.startedAt.localeCompare(a.startedAt);
  });
}
