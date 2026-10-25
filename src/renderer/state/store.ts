// The renderer's state. Main owns the race and the files; this mirrors what main pushes (live
// updates, saved runs), what the screens asked for (course list, the selected course, its runs) and
// the designer's unsaved draft.
import { create } from "zustand";
import { courseRevision, type Course } from "../../core/course/course";
import { draftOf, draftProblem, newDraft, type Draft } from "../../core/course/edit";
import { resolveClass } from "../../core/ranking/classes";
import { currentClass, pilotBest, type ClassKey } from "../../core/ranking/ranking";
import type { Run } from "../../core/run/run";
import type { AppInfo, CourseSummary, ImportReport, LiveUpdate, Prefs, RunSummary } from "../../shared/racerApi";
import { getRacer } from "../app/racer";
import { appendTrail, type TrailPoint } from "../race/trail";

export interface Message {
  kind: "info" | "error";
  text: string;
  /** Offer the X-Plane folder chooser next to the message. */
  chooseXplane?: boolean;
}

let initStarted = false;

interface State {
  bridge: boolean;
  app: AppInfo | null;
  courses: CourseSummary[];
  selected: Course | null;
  runs: RunSummary[];
  /** The class of the aircraft flying now (with the pilot's choices); undefined until telemetry says. */
  flyingClass: ClassKey | undefined;
  /** The class the ranking shows when the pilot picked one; null = follow the class flown. */
  rankPick: { cls: ClassKey } | null;
  /** The active pilot's best finished run of the selected course revision, in the class flown. */
  bestRun: Run | null;
  /** The best run as it was when the current attempt was armed: what this attempt races against.
   *  It stays put when the attempt itself becomes the new best, so it is never compared to itself. */
  targetRun: Run | null;
  update: LiveUpdate | null;
  trail: readonly TrailPoint[];
  message: Message | null;

  view: "race" | "design";
  /** The designer's working copy; an empty id means a course not saved yet. */
  draft: Draft | null;
  draftDirty: boolean;
  selectedGateId: string | null;
  /** Bumped to ask the map to bring a gate into view (selection from the list). */
  focusRequest: { id: string; n: number } | null;
  saving: boolean;
  busy: boolean;

  init(): Promise<void>;
  select(id: string): Promise<void>;
  importFiles(): Promise<void>;
  /** Files dropped on the window. */
  importDropped(files: readonly File[]): Promise<void>;
  exportCourse(): Promise<void>;
  exportShirley(): Promise<void>;
  resetRace(): Promise<void>;
  startDemo(): Promise<void>;
  stopDemo(): Promise<void>;
  setPilot(name: string): Promise<void>;
  removePilot(name: string): Promise<void>;
  /** The class an aircraft the app does not know (or no aircraft name, aircraftId null) is ranked in. */
  setAircraftClass(aircraftId: string | null, classId: string | null): Promise<void>;
  pickRankClass(cls: ClassKey | undefined): void;
  chooseXplaneDir(): Promise<void>;
  setPrefs(patch: Partial<Prefs>): Promise<void>;
  dismissMessage(): void;

  newCourse(): void;
  editCourse(): void;
  closeDesigner(): void;
  editDraft(fn: (d: Draft) => Draft): void;
  selectGate(id: string | null): void;
  focusGate(id: string): void;
  saveDraft(): Promise<void>;
  duplicateCourse(): Promise<void>;
  deleteCourse(): Promise<void>;
  installCourse(): Promise<void>;
  uninstallCourse(): Promise<void>;
}

export const useStore = create<State>((set, get) => {
  const refreshCourseData = async (arm: boolean): Promise<void> => {
    const racer = getRacer();
    const course = get().selected;
    if (!racer) return;
    const courses = await racer.listCourses();
    if (!course) {
      set({ courses });
      return;
    }
    const revision = courseRevision(course);
    const runs = (await racer.listRuns(course.id)).filter((r) => r.courseRevision === revision);
    const pilot = get().app?.pilot ?? "";
    const best = pilotBest(runs, pilot, currentClass(runs, pilot, get().flyingClass));
    const bestRun = best ? await racer.getRun(best.id) : null;
    const value = bestRun?.ok ? bestRun.value : null;
    set(arm ? { courses, runs, bestRun: value, targetRun: value } : { courses, runs, bestRun: value });
  };

  /** Follow the class flown now: the best (and, before the start, the target) is in that class. A
   *  demo flight is not flying: it never ranks, so it leaves the class (and the ranking tab) alone. */
  const updateFlyingClass = (): void => {
    const s = get();
    const t = s.update?.telemetry;
    if (!t?.active || t.active === "demo" || !s.app) return;
    const cls = resolveClass(t.aircraft, s.app.classChoices);
    if (cls === s.flyingClass) return;
    set({ flyingClass: cls });
    const status = s.update?.live?.race.status;
    if (status !== "running") void refreshCourseData(status === undefined || status === "waiting");
  };

  /** Unsaved designer changes are only dropped with the user's consent. */
  const mayLeaveDraft = (): boolean => !get().draftDirty || window.confirm("Discard your unsaved changes to this course?");

  /** Say what an import did and open the course it brought (or refresh the lists). */
  const afterImport = async (r: ImportReport): Promise<void> => {
    const allFailed = r.failed > 0 && r.failed === r.lines.length;
    const message: Message = { kind: allFailed ? "error" : "info", text: r.lines.join("\n") };
    if (r.courseId && r.courseId !== get().selected?.id && get().view !== "design") await get().select(r.courseId);
    else await refreshCourseData(false);
    set({ message });
  };

  const afterInstallChange = (summary: CourseSummary): void => {
    set({ courses: get().courses.map((c) => (c.id === summary.id ? summary : c)) });
  };

  return {
    bridge: false,
    app: null,
    courses: [],
    selected: null,
    runs: [],
    flyingClass: undefined,
    rankPick: null,
    bestRun: null,
    targetRun: null,
    update: null,
    trail: [],
    message: null,
    view: "race",
    draft: null,
    draftDirty: false,
    selectedGateId: null,
    focusRequest: null,
    saving: false,
    busy: false,

    async init() {
      const racer = getRacer();
      // Once per page: React's dev StrictMode runs effects twice, which would subscribe twice.
      if (!racer || initStarted) return;
      initStarted = true;
      const app = await racer.getAppInfo();
      set({ bridge: true, app });
      racer.onLive((update) => {
        const fix = update.live?.fix;
        // The trail starts over at the start line: the flight out to it (taxi, take-off, the turn
        // to line up) is not part of the race.
        const started = get().update?.live?.race.status === "waiting" && update.live?.race.status === "running";
        const trail = fix ? appendTrail(started ? [] : get().trail, fix) : get().trail;
        set(trail !== get().trail ? { update, trail } : { update });
        updateFlyingClass();
      });
      racer.onRunSaved(() => void refreshCourseData(false));
      racer.onImported((r) => void afterImport(r));
      const courses = await racer.listCourses();
      set({ courses });
      const first = courses.find((c) => c.id === app.lastCourseId) ?? courses[0];
      if (first) await get().select(first.id);
      const opened = await racer.takeOpenedFiles();
      if (opened) await afterImport(opened);
    },

    async select(id) {
      const racer = getRacer();
      if (!racer || !mayLeaveDraft()) return;
      const [sel, course] = await Promise.all([racer.selectCourse(id), racer.getCourse(id)]);
      if (!sel.ok || !course.ok) {
        set({ message: { kind: "error", text: !sel.ok ? sel.error.message : course.ok ? "" : course.error.message } });
        return;
      }
      set({ selected: course.value, trail: [], runs: [], rankPick: null, bestRun: null, targetRun: null, view: "race", draft: null, draftDirty: false });
      await refreshCourseData(true);
    },

    async importFiles() {
      const racer = getRacer();
      if (!racer) return;
      const r = await racer.importFiles();
      if (!r.ok) {
        if (r.error.code !== "cancelled") set({ message: { kind: "error", text: `Couldn't import. ${r.error.message}` } });
        return;
      }
      await afterImport(r.value);
    },

    async importDropped(files) {
      const racer = getRacer();
      if (!racer || files.length === 0) return;
      const data = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
      const r = await racer.importDropped(data);
      if (!r.ok) {
        set({ message: { kind: "error", text: `Couldn't import. ${r.error.message}` } });
        return;
      }
      await afterImport(r.value);
    },

    async exportCourse() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      const r = await racer.exportCourse(c.id);
      if (!r.ok) {
        if (r.error.code !== "cancelled") set({ message: { kind: "error", text: `Couldn't share the course. ${r.error.message}` } });
        return;
      }
      set({ message: { kind: "info", text: `Saved ${r.value}. Send it to other pilots: they open it with Import… or drop it on Pylon Racer.` } });
    },

    async exportShirley() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      const r = await racer.exportShirley(c.id);
      if (!r.ok) {
        if (r.error.code !== "cancelled") set({ message: { kind: "error", text: `Couldn't export for Shirley. ${r.error.message}` } });
        return;
      }
      set({
        message: {
          kind: "info",
          text: `Saved ${r.value} and copied it: paste it into Shirley's Challenge Creator (airplane.team/fly/create), then keep this app open on this course while you fly.`,
        },
      });
    },

    async resetRace() {
      await getRacer()?.resetRace();
      set({ trail: [], targetRun: get().bestRun });
    },

    async startDemo() {
      const r = await getRacer()?.startDemo();
      if (r && !r.ok) set({ message: { kind: "error", text: r.error.message } });
      set({ trail: [], targetRun: get().bestRun });
    },

    async stopDemo() {
      await getRacer()?.stopDemo();
    },

    async setPilot(name) {
      const racer = getRacer();
      if (!racer) return;
      set({ app: await racer.setPilot(name) });
      // The new pilot races against their own best; an attempt already under way keeps its target.
      await refreshCourseData(get().update?.live?.race.status !== "running");
    },

    async removePilot(name) {
      const racer = getRacer();
      if (!racer) return;
      set({ app: await racer.removePilot(name) });
    },

    async setAircraftClass(aircraftId, classId) {
      const racer = getRacer();
      if (!racer) return;
      set({ app: await racer.setAircraftClass(aircraftId, classId) });
      updateFlyingClass();
    },

    pickRankClass(cls) {
      set({ rankPick: cls === undefined ? null : { cls } });
    },

    async chooseXplaneDir() {
      const racer = getRacer();
      if (!racer) return;
      const app = await racer.chooseXplaneDir();
      set({ app, message: app.xplaneDirFound ? null : get().message, courses: await racer.listCourses() });
    },

    async setPrefs(patch) {
      const racer = getRacer();
      if (!racer) return;
      set({ app: await racer.setPrefs(patch) });
    },

    dismissMessage() {
      set({ message: null });
    },

    // --- designer -----------------------------------------------------------------------------------

    newCourse() {
      if (!mayLeaveDraft()) return;
      const draft = newDraft("", get().app?.pilot ?? "", new Date().toISOString());
      set({ view: "design", draft, draftDirty: false, selectedGateId: null });
    },

    editCourse() {
      const c = get().selected;
      if (!c) return;
      set({ view: "design", draft: draftOf(c), draftDirty: false, selectedGateId: null });
    },

    closeDesigner() {
      if (!mayLeaveDraft()) return;
      set({ view: "race", draft: null, draftDirty: false, selectedGateId: null });
    },

    editDraft(fn) {
      const d = get().draft;
      if (d) set({ draft: fn(d), draftDirty: true });
    },

    selectGate(id) {
      set({ selectedGateId: id });
    },

    focusGate(id) {
      set({ selectedGateId: id, focusRequest: { id, n: (get().focusRequest?.n ?? 0) + 1 } });
    },

    async saveDraft() {
      const racer = getRacer();
      const draft = get().draft;
      if (!racer || !draft) return;
      const problem = draftProblem(draft);
      if (problem) {
        set({ message: { kind: "error", text: problem } });
        return;
      }
      set({ saving: true });
      try {
        const r = await racer.saveCourse(draft as Course);
        if (!r.ok) {
          set({ message: { kind: "error", text: `Couldn't save the course. ${r.error.message}` } });
          return;
        }
        set({ draftDirty: false });
        await get().select(r.value.course.id);
        const outdated = r.value.course.install.state === "outdated";
        const notes = [...r.value.warnings, ...(outdated ? ["The pylons installed in X-Plane are from before this change: reinstall them."] : [])];
        set({ message: notes.length ? { kind: "info", text: notes.join(" ") } : { kind: "info", text: "Course saved." } });
      } finally {
        set({ saving: false });
      }
    },

    async duplicateCourse() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      const r = await racer.duplicateCourse(c.id);
      if (!r.ok) {
        set({ message: { kind: "error", text: r.error.message } });
        return;
      }
      await get().select(r.value.id);
      get().editCourse();
    },

    async deleteCourse() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      const installed = get().courses.find((s) => s.id === c.id)?.install.state !== "none";
      const ok = window.confirm(
        `Delete "${c.name}"?${installed ? " Its pylons will be removed from X-Plane." : ""} Your runs on it are kept.`,
      );
      if (!ok) return;
      const r = await racer.deleteCourse(c.id);
      if (!r.ok) {
        set({ message: { kind: "error", text: r.error.message } });
        return;
      }
      set({ selected: null, view: "race", draft: null, draftDirty: false });
      const courses = await racer.listCourses();
      set({ courses });
      if (courses[0]) await get().select(courses[0].id);
    },

    async installCourse() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      set({ busy: true });
      try {
        const r = await racer.installCourse(c.id);
        if (!r.ok) {
          set({
            message:
              r.error.code === "xplane-not-found"
                ? { kind: "error", text: r.error.dir ? `X-Plane 12 wasn't found at ${r.error.dir}.` : "No X-Plane 12 installation was found.", chooseXplane: true }
                : { kind: "error", text: `Couldn't install the pylons. ${r.error.message}` },
          });
          return;
        }
        afterInstallChange(r.value);
        set({ message: { kind: "info", text: "Pylons installed. X-Plane reads scenery at startup: restart it to see them." } });
      } finally {
        set({ busy: false });
      }
    },

    async uninstallCourse() {
      const racer = getRacer();
      const c = get().selected;
      if (!racer || !c) return;
      const r = await racer.uninstallCourse(c.id);
      if (!r.ok) {
        set({ message: { kind: "error", text: r.error.message } });
        return;
      }
      afterInstallChange(r.value);
      set({ message: { kind: "info", text: "Pylons removed from X-Plane." } });
    },
  };
});
