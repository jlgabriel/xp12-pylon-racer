// DEV ONLY (tree-shaken from production): a fake window.racer for the browser preview
// (`npm run preview:renderer`, then open with ?mockracer). It runs the REAL core — sample courses,
// race session, demo flight — in the page, so the race screen can be exercised without Electron or
// the simulator. Runs live in memory and vanish on reload.
import { courseRevision, parseCourse, type Course } from "../../core/course/course";
import { demoFlight } from "../../core/demo/demoFlight";
import { sampleCourses } from "../../core/demo/sampleCourses";
import { packFolderName, packSceneryId } from "../../core/export/pack";
import { shirleyFile, shirleyFileName } from "../../core/export/shirley";
import { courseFileName, packCourse, unpack } from "../../core/files/share";
import type { ZipCodec } from "../../core/files/zip";
import { destination } from "../../core/geo/geo";
import type { Run } from "../../core/run/run";
import { rankRuns, summarizeCourse, summarizeRun } from "../../core/run/summaries";
import { classOfAircraft, isClassId, resolveClass, type ClassChoices } from "../../core/ranking/classes";
import { RaceSession } from "../../core/session/raceSession";
import type { AppInfo, ImportReport, LiveUpdate, Prefs, RacerApi, RacerResult, RunSummary, TelemetryStatus } from "../../shared/racerApi";

/** No synchronous deflate in a browser: the preview writes stored (uncompressed) ZIPs and can only
 *  read those back. The real app reads and writes both. */
const storeOnly: ZipCodec = {
  deflateRaw: (d) => d,
  inflateRaw: () => {
    throw new Error("Compressed files open in the app, not in the preview");
  },
};

/** The preview's "save dialog": the browser downloads the file. */
function download(name: string, data: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/zip" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function installMockBridge(): void {
  const courses = new Map<string, Course>(sampleCourses().map((c) => [c.id, c]));
  const runs = new Map<string, Run>();
  const liveListeners = new Set<(u: LiveUpdate) => void>();
  const savedListeners = new Set<(r: RunSummary) => void>();
  let pilot = "Preview";
  let pilots: string[] = [];
  let lastCourseId: string | null = null;
  let prefs: Prefs = { onTop: false };
  let classChoices: ClassChoices = { aircraft: {}, noAircraft: null };
  // ?aircraft=C172 flies the demo in another aircraft (another class); ?aircraft=none flies it with no
  // aircraft name (X-Plane's Web API off); ?aircraft=my_plane is an aircraft the app does not know.
  const aircraftParam = new URLSearchParams(window.location.search).get("aircraft");
  const demoAircraft = aircraftParam === "none" ? null : (aircraftParam ?? "Extra");
  let session: RaceSession | null = null;
  let demo: number | null = null;
  /** courseId → what was installed: a pretend Custom Scenery. */
  const installed = new Map<string, { revision: string; sceneryId: string }>();

  const summaries = (): RunSummary[] => [...runs.values()].map((r) => summarizeRun(r));
  const installedRefs = () => [...installed].map(([courseId, i]) => ({ courseId, ...i, folderName: packFolderName(courseId) }));
  const summary = (c: Course) => summarizeCourse(c, summaries(), installedRefs());
  const info = (): AppInfo => ({
    version: __APP_VERSION__,
    pilot,
    pilots: [...new Set([...pilots, pilot])],
    xplaneDir: "(preview)",
    xplaneDirFound: true,
    xplaneVersion: "12.4.3-r2",
    lastCourseId,
    prefs,
    classChoices,
  });
  const notFound = (id: string): RacerResult<never> => ({ ok: false, error: { code: "not-found", message: id } });
  const ok = <T>(value: T): RacerResult<T> => ({ ok: true, value });

  // ?shared: another program keeps taking X-Plane's RPOS, so the stream comes and goes every 3 s.
  // ?replay: X-Plane streams, but is playing a replay. Both show X-Plane as if it were running; the
  // demo still flies (and wins, as in the hub).
  const query = new URLSearchParams(window.location.search);
  const shared = query.has("shared");
  const replay = query.has("replay");
  // &display: our plugin shows the race inside X-Plane.
  const displayStatus = query.has("display") ? { connected: true, plugin: "0.1.0-h3", xplane: 12431 } : { connected: false, plugin: null, xplane: null };
  const telemetry = (): TelemetryStatus => {
    const streaming = replay || (shared && Math.floor(performance.now() / 3000) % 2 === 0);
    return {
      active: demo !== null ? "demo" : streaming ? "rpos" : null,
      aircraft: demo !== null || streaming ? demoAircraft : null,
      rpos: { ageS: streaming ? 0.03 : shared ? 2.5 : null, hz: streaming ? 29 : 0, error: null, shared },
      replay,
      webApi: { ok: streaming, error: null },
      demo: { running: demo !== null },
    };
  };
  const push = (): void => {
    const u: LiveUpdate = { telemetry: telemetry(), live: session?.live() ?? null, display: displayStatus };
    liveListeners.forEach((l) => l(u));
  };
  const stopDemo = (): void => {
    if (demo !== null) window.clearInterval(demo);
    demo = null;
  };
  window.setInterval(push, 500);

  const api: RacerApi = {
    getAppInfo: async () => info(),
    setPilot: async (name) => {
      const next = name.trim().slice(0, 32);
      if (next) {
        pilots = [...new Set([...pilots, pilot, next])];
        pilot = next;
        session?.setPilot(next);
      }
      return info();
    },
    removePilot: async (name) => {
      if (name !== pilot) pilots = pilots.filter((p) => p !== name);
      return info();
    },
    chooseXplaneDir: async () => ({ app: info(), notXplane: null }),
    setAircraftClass: async (aircraftId, classId) => {
      const cls = isClassId(classId) ? classId : null;
      if (aircraftId === null) classChoices = { ...classChoices, noAircraft: cls };
      else if (!classOfAircraft(aircraftId)) {
        const { [aircraftId]: _old, ...rest } = classChoices.aircraft;
        classChoices = { ...classChoices, aircraft: cls ? { ...rest, [aircraftId]: cls } : rest };
      }
      return info();
    },
    setPrefs: async (patch) => {
      prefs = { ...prefs, ...patch };
      return info();
    },
    listCourses: async () => [...courses.values()].sort((a, b) => a.name.localeCompare(b.name)).map(summary),
    saveCourse: async (draft) => {
      try {
        const now = new Date().toISOString();
        const id = draft.id || `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${courses.size + 1}`;
        // The real app looks the terrain up on Open-Meteo; the preview pretends it is flat at 588 m.
        const c = parseCourse({ ...draft, id, updatedAt: now, gates: draft.gates.map((g) => ({ ...g, groundElevM: g.groundElevM ?? 588 })) });
        courses.set(c.id, c);
        return ok({ course: summary(c), warnings: [] });
      } catch (e) {
        return { ok: false, error: { code: "invalid-course", message: String(e) } };
      }
    },
    duplicateCourse: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      const copy = { ...structuredClone(c), id: `${c.id}-copy-${courses.size + 1}`, name: `Copy of ${c.name}` };
      courses.set(copy.id, copy);
      return ok(summary(copy));
    },
    deleteCourse: async (id) => {
      courses.delete(id);
      installed.delete(id);
      return ok(undefined);
    },
    installCourse: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      installed.set(id, { revision: courseRevision(c), sceneryId: packSceneryId(c) });
      return ok(summary(c));
    },
    uninstallCourse: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      installed.delete(id);
      return ok(summary(c));
    },
    searchPlaces: async (q) =>
      ok(q.toLowerCase().includes("dag") ? [{ label: "Barstow-Daggett Airport (KDAG), California", lon: -116.787, lat: 34.8537 }] : []),
    getCourse: async (id) => {
      const c = courses.get(id);
      return c ? ok(c) : { ok: false, error: { code: "not-found", message: id } };
    },
    importFiles: async () => ({ ok: false, error: { code: "cancelled", message: "No file dialog in the preview" } }),
    importDropped: async (files) => {
      const report: ImportReport = { courseId: null, lines: [], failed: 0 };
      for (const f of files) {
        try {
          const u = unpack(f.data, storeOnly, new Date().toISOString());
          const course = courses.get(u.id) ?? (courses.set(u.id, u), u);
          report.courseId = course.id;
          report.lines.push(`${course.name}: course added.`);
        } catch (e) {
          report.failed++;
          report.lines.push(`${f.name}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      return ok(report);
    },
    exportCourse: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      download(courseFileName(c), packCourse(c, storeOnly));
      return ok(courseFileName(c));
    },
    exportShirley: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      download(shirleyFileName(c), new TextEncoder().encode(shirleyFile(c, pilot, summaries())));
      return ok(shirleyFileName(c));
    },
    takeOpenedFiles: async () => null,
    onImported: () => () => undefined,
    selectCourse: async (id) => {
      const c = courses.get(id);
      if (!c) return notFound(id);
      lastCourseId = id;
      stopDemo();
      session = new RaceSession(c, {
        pilot,
        appVersion: __APP_VERSION__,
        newId: () => crypto.randomUUID(),
        nowIso: () => new Date().toISOString(),
        classOf: (aircraftId) => resolveClass(aircraftId, classChoices),
      });
      push();
      return ok(summary(c));
    },
    resetRace: async () => {
      stopDemo();
      session?.reset();
      push();
    },
    startDemo: async () => {
      if (!session) return { ok: false, error: { code: "not-found", message: "Select a course first" } };
      stopDemo();
      session.reset();
      const s = session;
      // ?sloppy flies the demo badly on purpose (banked and high), to see the penalties on screen.
      // ?reset crashes halfway: the sim puts the aircraft back on a runway 3 km away, stopped.
      // ?freeze crashes halfway too, but sits 5 s first, streaming the same frozen fix (what Aerofly
      // did on its crash menu; what X-Plane does after a crash is still to be seen).
      // ?ranked feeds the demo as if it came from the sim, so its runs rank and become your best, at
      // a pace that wanders from run to run (to see the live delta and the splits against the best).
      const query = new URLSearchParams(window.location.search);
      const sloppy = query.has("sloppy");
      const ranked = query.has("ranked");
      // ?fast=8 plays the demo eight times faster (screenshots of long courses).
      const fast = Math.max(1, Number(query.get("fast")) || 1);
      const phase = Math.random() * 2 * Math.PI;
      const warp = (t: number): number => (ranked ? t + 1.5 * Math.sin(t / 4 + phase) - 1.5 * Math.sin(phase) : t);
      const flown = demoFlight(s.course, { rateHz: 20 });
      const runway = destination(flown[0]!, 3000, 180);
      const crash = Math.floor(flown.length / 2);
      const menu = query.has("freeze") ? 5 * 20 : 0;
      const fixes = flown.map((f, i) => {
        if ((query.has("reset") || menu) && i > crash + menu) return { ...f, ...runway, gsMs: 0, aglM: 0, rollDeg: 0, pitchDeg: 0 };
        if (menu && i > crash) return { ...flown[crash]!, t: f.t };
        const g = { ...f, t: warp(f.t) };
        return sloppy ? { ...g, rollDeg: g.rollDeg + 35, altMslM: g.altMslM + 30, aglM: g.aglM === null ? null : g.aglM + 30 } : g;
      });
      const t0 = performance.now() / 1000;
      let i = 0;
      demo = window.setInterval(() => {
        const elapsed = (performance.now() / 1000 - t0) * fast;
        while (i < fixes.length && fixes[i]!.t <= elapsed) {
          const f = fixes[i++]!;
          const { run } = s.feed({ ...f, t: t0 + f.t }, { kind: ranked ? "rpos" : "demo", hz: 20, aircraft: demoAircraft });
          if (run) {
            runs.set(run.id, run);
            savedListeners.forEach((l) => l(summarizeRun(run)));
          }
        }
        if (i >= fixes.length) stopDemo();
        push();
      }, 50);
      return ok(undefined);
    },
    stopDemo: async () => {
      stopDemo();
      push();
    },
    listRuns: async (courseId) => rankRuns(summaries().filter((r) => r.courseId === courseId)),
    getRun: async (id) => {
      const r = runs.get(id);
      return r ? ok(r) : { ok: false, error: { code: "not-found", message: id } };
    },
    onLive: (l) => {
      liveListeners.add(l);
      return () => liveListeners.delete(l);
    },
    onRunSaved: (l) => {
      savedListeners.add(l);
      return () => savedListeners.delete(l);
    },
  };
  window.racer = api;
}
