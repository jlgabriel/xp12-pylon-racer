// One ipcMain handler per RacerApi method, channel "racer:<method>". This is the app's single trust
// boundary: it owns every path and dialog, validates what comes in, and maps expected failures into
// RacerResult envelopes (a thrown error loses its fields crossing invoke).
import { app, BrowserWindow, clipboard, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions, type WebContents } from "electron";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ZodError } from "zod";
import { parseCourse, type Course } from "../core/course/course";
import { shirleyFile, shirleyFileName } from "../core/export/shirley";
import { COURSE_EXT, courseFileName, IMPORT_EXTS } from "../core/files/share";
import { classOfAircraft, isClassId } from "../core/ranking/classes";
import { rankRuns, summarizeCourse } from "../core/run/summaries";
import type { AppInfo, CourseSummary, DroppedFile, ImportReport, Prefs, RacerError, RacerResult, SaveResult } from "../shared/racerApi";
import { writeFileAtomic } from "./fsAtomic";
import { isInstallation } from "./findInstallations";
import { XplaneNotFoundError, type Installer } from "./installer";
import { log } from "./log";
import type { RaceController } from "./race";
import { courseFile, importFiles, MAX_IMPORT_BYTES } from "./sharing";
import { classChoicesOf, SAFE_ID, type Storage } from "./storage";
import { elevations, searchPlaces } from "./web";

declare const __APP_VERSION__: string;

const ok = <T>(value: T): RacerResult<T> => ({ ok: true, value });
const fail = (code: Exclude<RacerError["code"], "xplane-not-found">, message: string): RacerResult<never> => ({
  ok: false,
  error: { code, message },
});

export interface IpcDeps {
  storage: Storage;
  race: RaceController;
  installer: Installer;
  /** The X-Plane 12 folder in use (settings override, else the first usable one in Laminar's list),
   *  or "" when there is none. */
  xplaneDir: () => string;
  /** Its version from Log.txt, when it has run. */
  xplaneVersion: () => string | null;
  userData: string;
}

export interface IpcHandle {
  /** Files the OS asked us to open (a double-clicked .pylonrace): imported and pushed
   *  to the renderer, or held until the renderer takes them at startup. */
  openFiles(paths: readonly string[]): void;
}

export function registerIpc({ storage, race, installer, xplaneDir, xplaneVersion, userData }: IpcDeps): IpcHandle {
  const appInfo = (): AppInfo => {
    const s = storage.readSettings();
    return {
      version: __APP_VERSION__,
      pilot: s.pilot,
      pilots: [...new Set([...s.pilots, s.pilot])],
      xplaneDir: xplaneDir(),
      xplaneDirFound: installer.found(),
      xplaneVersion: xplaneVersion(),
      lastCourseId: s.lastCourseId,
      prefs: { onTop: s.onTop },
      classChoices: classChoicesOf(s),
    };
  };
  const summary = (c: Course): CourseSummary => summarizeCourse(c, storage.listRuns(), installer.list());
  const dialogParent = (sender: WebContents): BrowserWindow | undefined => BrowserWindow.fromWebContents(sender) ?? undefined;
  const withCourse = <T>(id: unknown, fn: (c: Course) => RacerResult<T>): RacerResult<T> => {
    if (typeof id !== "string" || !SAFE_ID.test(id)) return fail("not-found", "No such course");
    try {
      const c = storage.getCourse(id);
      return c ? fn(c) : fail("not-found", `No course ${id}`);
    } catch (e) {
      return fail("invalid-course", errorText(e));
    }
  };

  const withCourseAsync = async <T>(id: unknown, fn: (c: Course) => Promise<RacerResult<T>>): Promise<RacerResult<T>> => {
    const found = withCourse(id, (c) => ok(c));
    if (!found.ok) return found;
    try {
      return await fn(found.value);
    } catch (e) {
      return fail("io", errorText(e));
    }
  };
  const saveDialog = async (sender: WebContents, title: string, fileName: string, ext: string, kind: string) => {
    const opts: SaveDialogOptions = {
      title,
      defaultPath: path.join(app.getPath("documents"), fileName),
      filters: [{ name: kind, extensions: [ext] }],
    };
    const parent = dialogParent(sender);
    const pick = parent ? await dialog.showSaveDialog(parent, opts) : await dialog.showSaveDialog(opts);
    return pick.canceled || !pick.filePath ? null : pick.filePath;
  };
  const importPaths = (paths: readonly string[]): ImportReport => {
    const files: { name: string; data: Uint8Array }[] = [];
    const unreadable: string[] = [];
    for (const p of paths) {
      try {
        if (statSync(p).size > MAX_IMPORT_BYTES) throw new Error("too big");
        files.push({ name: path.basename(p), data: new Uint8Array(readFileSync(p)) });
      } catch (e) {
        log.warn(`import: couldn't read ${p}`, e);
        unreadable.push(`${path.basename(p)}: couldn't read the file.`);
      }
    }
    const r = importFiles(storage, files);
    return { ...r, lines: [...r.lines, ...unreadable], failed: r.failed + unreadable.length };
  };

  // Opened before the renderer listens (the launch itself, macOS open-file before ready) wait here.
  const opened: string[] = [];
  let rendererListens = false;
  const openFiles = (paths: readonly string[]): void => {
    if (paths.length === 0) return;
    if (!rendererListens) {
      opened.push(...paths);
      return;
    }
    const report = importPaths(paths);
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send("racer:imported", report);
  };

  // --- app ------------------------------------------------------------------------------------------

  ipcMain.handle("racer:getAppInfo", () => appInfo());

  ipcMain.handle("racer:setPilot", (_e, name: unknown) => {
    const pilot = typeof name === "string" ? name.trim().slice(0, 32) : "";
    if (pilot) {
      const s = storage.readSettings();
      storage.writeSettings({ pilot, pilots: [...new Set([...s.pilots, s.pilot, pilot])] });
      race.setPilot(pilot);
    }
    return appInfo();
  });

  ipcMain.handle("racer:removePilot", (_e, name: unknown) => {
    const s = storage.readSettings();
    if (typeof name === "string" && name !== s.pilot) storage.writeSettings({ pilots: s.pilots.filter((p) => p !== name) });
    return appInfo();
  });

  ipcMain.handle("racer:chooseXplaneDir", async (e) => {
    const opts: OpenDialogOptions = {
      title: "Choose your X-Plane 12 folder (the one that contains 'Custom Scenery')",
      ...(xplaneDir() ? { defaultPath: xplaneDir() } : {}),
      properties: ["openDirectory"],
    };
    const parent = dialogParent(e.sender);
    const pick = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
    const dir = pick.filePaths[0];
    let notXplane: string | null = null;
    if (!pick.canceled && dir) {
      if (isInstallation(dir)) {
        storage.writeSettings({ xplaneDir: dir });
        log.info(`X-Plane folder set to ${dir}`);
      } else {
        log.warn(`not an X-Plane installation (no Resources/default scenery): ${dir}`);
        notXplane = dir;
      }
    }
    return { app: appInfo(), notXplane };
  });

  ipcMain.handle("racer:setAircraftClass", (_e, aircraftId: unknown, classId: unknown) => {
    const s = storage.readSettings();
    const cls = isClassId(classId) ? classId : null;
    if (aircraftId === null) {
      storage.writeSettings({ noAircraftClass: cls });
    } else if (typeof aircraftId === "string" && aircraftId.length <= 64 && !classOfAircraft(aircraftId)) {
      const { [aircraftId]: _old, ...rest } = s.aircraftClasses;
      storage.writeSettings({ aircraftClasses: cls ? { ...rest, [aircraftId]: cls } : rest });
    }
    return appInfo();
  });

  ipcMain.handle("racer:setPrefs", (e, patch: unknown) => {
    const p = (typeof patch === "object" && patch !== null ? patch : {}) as Record<string, unknown>;
    const next: Partial<Prefs> = {};
    if (typeof p["onTop"] === "boolean") next.onTop = p["onTop"];
    const s = storage.writeSettings(next);
    const win = dialogParent(e.sender);
    if (win && next.onTop !== undefined) applyOnTop(win, s.onTop);
    return appInfo();
  });

  // --- courses --------------------------------------------------------------------------------------

  ipcMain.handle("racer:listCourses", () => {
    const runs = storage.listRuns();
    const installed = installer.list();
    return storage.listCourses().map((c) => summarizeCourse(c, runs, installed));
  });

  ipcMain.handle("racer:getCourse", (_e, id: unknown) => withCourse(id, (c) => ok(c)));

  ipcMain.handle("racer:importFiles", async (e): Promise<RacerResult<ImportReport>> => {
    const opts: OpenDialogOptions = {
      title: "Import courses",
      filters: [
        { name: "Pylon Racer files", extensions: [...IMPORT_EXTS] },
        { name: "All files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    };
    const parent = dialogParent(e.sender);
    const pick = parent ? await dialog.showOpenDialog(parent, opts) : await dialog.showOpenDialog(opts);
    if (pick.canceled || pick.filePaths.length === 0) return fail("cancelled", "Import cancelled");
    return ok(importPaths(pick.filePaths));
  });

  ipcMain.handle("racer:takeOpenedFiles", () => {
    rendererListens = true;
    return opened.length > 0 ? importPaths(opened.splice(0)) : null;
  });

  ipcMain.handle("racer:importDropped", (_e, files: unknown): RacerResult<ImportReport> => {
    if (!Array.isArray(files)) return fail("invalid-course", "Nothing to import");
    const valid = files.filter(
      (f): f is DroppedFile => typeof f === "object" && f !== null && typeof f.name === "string" && f.data instanceof Uint8Array,
    );
    return ok(importFiles(storage, valid.map((f) => ({ name: path.basename(f.name), data: f.data }))));
  });

  ipcMain.handle("racer:exportCourse", (e, id: unknown) =>
    withCourseAsync(id, async (c) => {
      const file = await saveDialog(e.sender, "Share course", courseFileName(c), COURSE_EXT, "Pylon Racer course");
      if (!file) return fail("cancelled", "Export cancelled");
      writeFileAtomic(file, courseFile(c));
      log.info(`course exported: ${c.id} to ${file}`);
      return ok(path.basename(file));
    }),
  );

  ipcMain.handle("racer:exportShirley", (e, id: unknown) =>
    withCourseAsync(id, async (c) => {
      const file = await saveDialog(e.sender, "Shirley challenge", shirleyFileName(c), "json", "Shirley challenge");
      if (!file) return fail("cancelled", "Export cancelled");
      const text = shirleyFile(c, storage.readSettings().pilot, storage.listRuns());
      writeFileAtomic(file, new TextEncoder().encode(text));
      // Shirley's Challenge Creator takes the challenge pasted in.
      clipboard.writeText(text);
      log.info(`Shirley challenge exported: ${c.id} to ${file}`);
      return ok(path.basename(file));
    }),
  );

  ipcMain.handle("racer:saveCourse", async (_e, draft: unknown): Promise<RacerResult<SaveResult>> => {
    const now = new Date().toISOString();
    let course: Course;
    try {
      const d = draft as Partial<Course>;
      const isNew = typeof d.id !== "string" || d.id === "";
      const existing = !isNew && typeof d.id === "string" ? storage.getCourse(d.id) : null;
      if (!isNew && !existing) return fail("not-found", `No course ${String(d.id)}`);
      course = parseCourse({
        ...d,
        id: isNew ? storage.newCourseId(String(d.name ?? "")) : d.id,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    } catch (err) {
      return fail("invalid-course", errorText(err));
    }

    const warnings: string[] = [];
    const missing = course.gates.filter((g) => g.groundElevM === null);
    if (missing.length > 0) {
      try {
        const elev = await elevations(missing.map((g) => g.center), userData, __APP_VERSION__);
        const byId = new Map(missing.map((g, i) => [g.id, Math.round(elev[i]! * 10) / 10]));
        course = { ...course, gates: course.gates.map((g) => (byId.has(g.id) ? { ...g, groundElevM: byId.get(g.id)! } : g)) };
      } catch (err) {
        log.warn("terrain elevation lookup failed", err);
        warnings.push("Couldn't look up the terrain elevation (no connection?). Save again later to add it.");
      }
    }

    try {
      storage.saveCourse(course);
      if (race.activeCourse?.id === course.id) race.select(course);
      log.info(`course saved: ${course.name} (${course.id}), ${course.gates.length} gates`);
      return ok({ course: summary(course), warnings });
    } catch (err) {
      return fail("io", errorText(err));
    }
  });

  ipcMain.handle("racer:duplicateCourse", (_e, id: unknown) =>
    withCourse(id, (c) => {
      const now = new Date().toISOString();
      const name = `Copy of ${c.name}`.slice(0, 80);
      const copy: Course = { ...structuredClone(c), id: storage.newCourseId(name), name, createdAt: now, updatedAt: now };
      storage.saveCourse(copy);
      return ok(summary(copy));
    }),
  );

  ipcMain.handle("racer:deleteCourse", (_e, id: unknown) =>
    withCourse(id, (c) => {
      const removed = installer.uninstall(c.id);
      storage.deleteCourse(c.id);
      log.info(`course deleted: ${c.name} (${c.id})${removed.length ? `, uninstalled ${removed.join(", ")}` : ""}`);
      return ok(undefined);
    }),
  );

  ipcMain.handle("racer:installCourse", (_e, id: unknown) =>
    withCourse(id, (c): RacerResult<CourseSummary> => {
      try {
        const pack = installer.install(c);
        log.info(
          `installed ${c.name} as ${pack.folderName}; scenery_packs.ini: ${pack.placement}` +
            `${pack.iniBackup ? `, backup ${pack.iniBackup}` : ""}${pack.warnings.length ? `; ${pack.warnings.join(" ")}` : ""}`,
        );
        return ok(summary(c));
      } catch (err) {
        if (err instanceof XplaneNotFoundError) {
          return { ok: false, error: { code: "xplane-not-found", message: err.message, dir: err.dir } };
        }
        log.error(`install failed for ${c.id}`, err);
        return fail("io", errorText(err));
      }
    }),
  );

  ipcMain.handle("racer:uninstallCourse", (_e, id: unknown) =>
    withCourse(id, (c) => {
      const removed = installer.uninstall(c.id);
      log.info(`uninstalled ${c.id}: ${removed.join(", ") || "nothing installed"}`);
      return ok(summary(c));
    }),
  );

  ipcMain.handle("racer:searchPlaces", async (_e, query: unknown) => {
    if (typeof query !== "string") return ok([]);
    try {
      return ok(await searchPlaces(query, __APP_VERSION__));
    } catch (err) {
      log.warn("place search failed", err);
      return fail("network", "Couldn't search right now. Check your connection.");
    }
  });

  // --- race -----------------------------------------------------------------------------------------

  ipcMain.handle("racer:selectCourse", (_e, id: unknown) =>
    withCourse(id, (c) => {
      race.select(c);
      storage.writeSettings({ lastCourseId: c.id });
      return ok(summary(c));
    }),
  );

  ipcMain.handle("racer:resetRace", () => race.reset());

  ipcMain.handle("racer:startDemo", () => (race.startDemo() ? ok(undefined) : fail("not-found", "Select a course first")));

  ipcMain.handle("racer:stopDemo", () => race.stopDemo());

  ipcMain.handle("racer:listRuns", (_e, courseId: unknown) => rankRuns(storage.listRuns().filter((r) => r.courseId === courseId)));

  ipcMain.handle("racer:getRun", (_e, id: unknown) => {
    if (typeof id !== "string") return fail("not-found", "No run id");
    try {
      const r = storage.getRun(id);
      return r ? ok(r) : fail("not-found", `No run ${id}`);
    } catch (e) {
      return fail("io", errorText(e));
    }
  });

  return { openFiles };
}

function errorText(e: unknown): string {
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "course"}: ${i.message}`).join("; ");
  if (e instanceof SyntaxError) return `Not valid JSON: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}

/** "screen-saver" is the level that stays above a borderless-windowed game on Windows. */
export function applyOnTop(win: BrowserWindow, on: boolean): void {
  win.setAlwaysOnTop(on, "screen-saver");
}
