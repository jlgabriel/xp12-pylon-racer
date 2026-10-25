// Installs a course's pylons into X-Plane 12 as a scenery pack (Custom Scenery/XPR_<id>/) and lists
// it in scenery_packs.ini, right below *GLOBAL_AIRPORTS*. The app only ever creates, replaces or
// removes folders that BOTH have a name it could have produced AND contain its marker file: Custom
// Scenery holds everybody else's scenery too.
//
// The careful parts come from XOP's installPack (src/node/installPack.ts there, XOP 1.0–1.4): build
// beside the target and swap; every path through containedJoin; back the ini up before touching it
// and only ever add or remove our own line; a locked file is somebody else's program, not X-Plane
// (measured: X-Plane locks nothing it has read). X-Plane reads scenery_packs.ini at startup, so a new
// install shows up after restarting the simulator.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { z } from "zod";
import { courseRevision, type Course } from "../core/course/course";
import { MARKER_FILE, isOurPackFolderName, planPack, type PackMarker } from "../core/export/pack";
import { insertSceneryPack, removeSceneryPack, type Placement } from "../core/install/sceneryPacksIni";
import { containedJoin } from "./containedPath";

const CUSTOM_SCENERY = "Custom Scenery";
const INI_NAME = "scenery_packs.ini";

/** Ownership hangs on three fields and never on more: a stricter test in a later version would
 *  orphan every pack already installed (XOP's packContract rule). Unknown fields are ignored. */
const markerSchema = z.object({
  app: z.literal("xp-pylon-racer"),
  packName: z.string().min(1),
  courseId: z.string().min(1),
  courseName: z.string().default(""),
  revision: z.string().default(""),
  sceneryId: z.string().default(""),
  installedAt: z.string().default(""),
  appVersion: z.string().default(""),
});

export interface InstalledPack extends PackMarker {
  folderName: string;
}

export interface InstallResult extends InstalledPack {
  /** The scenery_packs.ini line, and what happened to it. */
  line: string;
  placement: Placement | "no-ini";
  iniBackup: string | null;
  warnings: string[];
}

export class XplaneNotFoundError extends Error {
  constructor(readonly dir: string) {
    super(dir ? `X-Plane 12 not found at ${dir}` : "No X-Plane 12 installation found");
  }
}

export class InstallError extends Error {}

function rethrowLocked(error: unknown, what: string): never {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
    throw new InstallError(`${what} could not be written: another program has it open (a backup, sync or antivirus tool is the usual cause). Close it and try again.`);
  }
  throw error;
}

export class Installer {
  constructor(
    /** The X-Plane 12 folder (the one holding Custom Scenery), or "" when none was found. */
    private readonly xplaneDir: () => string,
    private readonly appVersion: string,
  ) {}

  customScenery(): string {
    return path.join(this.xplaneDir(), CUSTOM_SCENERY);
  }

  found(): boolean {
    return this.xplaneDir() !== "" && existsSync(this.customScenery());
  }

  list(): InstalledPack[] {
    if (!this.found()) return [];
    const root = this.customScenery();
    let names: string[];
    try {
      names = readdirSync(root);
    } catch {
      return [];
    }
    const out: InstalledPack[] = [];
    for (const folderName of names) {
      if (!isOurPackFolderName(folderName)) continue;
      const marker = readMarker(path.join(root, folderName));
      if (marker) out.push({ ...marker, folderName });
    }
    return out;
  }

  install(course: Course): InstallResult {
    if (!this.found()) throw new XplaneNotFoundError(this.xplaneDir());
    const root = this.customScenery();
    const plan = planPack(course, {
      deflate: (b) => new Uint8Array(deflateSync(b)),
      md5: (b) => new Uint8Array(createHash("md5").update(b).digest()),
      appVersion: this.appVersion,
    });
    const packRoot = containedJoin(root, plan.packFolder);
    if (packRoot === null || path.dirname(packRoot) !== root) throw new InstallError(`"${plan.packFolder}" is not a usable pack name.`);
    if (existsSync(packRoot) && !readMarker(packRoot)) {
      throw new InstallError(`"${plan.packFolder}" already exists in Custom Scenery and was not made by XP Pylon Racer. Move it out of the way first.`);
    }

    const marker: PackMarker = {
      app: "xp-pylon-racer",
      packName: plan.packFolder,
      courseId: course.id,
      courseName: course.name,
      revision: courseRevision(course),
      sceneryId: plan.sceneryId,
      installedAt: new Date().toISOString(),
      appVersion: this.appVersion,
    };

    // Build beside the target and swap, so a failure part-way cannot leave a half-written pack that
    // X-Plane would happily load.
    const staging = `${packRoot}.racer-new`;
    rmSync(staging, { recursive: true, force: true });
    try {
      for (const file of plan.files) {
        const target = containedJoin(staging, file.path);
        if (target === null) throw new InstallError(`Refusing to write outside the pack: ${file.path}`);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, file.bytes);
      }
      writeFileSync(path.join(staging, MARKER_FILE), JSON.stringify(marker, null, 2) + "\n", "utf8");
      for (const old of this.list()) {
        if (old.courseId === course.id && old.folderName !== plan.packFolder) this.removeFolder(old.folderName);
      }
      rmSync(packRoot, { recursive: true, force: true });
      renameSync(staging, packRoot);
    } catch (e) {
      rmSync(staging, { recursive: true, force: true });
      rethrowLocked(e, `The folder "${plan.packFolder}"`);
    }

    const ini = this.addIniLine(plan.packFolder);
    return { ...marker, folderName: plan.packFolder, ...ini };
  }

  /** Remove every pack this app installed for the course, folder and ini line. Returns the folder
   *  names removed. */
  uninstall(courseId: string): string[] {
    const removed: string[] = [];
    for (const pack of this.list()) {
      if (pack.courseId !== courseId) continue;
      this.removeFolder(pack.folderName);
      this.removeIniLine(pack.folderName);
      removed.push(pack.folderName);
    }
    return removed;
  }

  private removeFolder(folderName: string): void {
    const dir = containedJoin(this.customScenery(), folderName);
    if (dir === null || !readMarker(dir)) return;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (e) {
      rethrowLocked(e, `The folder "${folderName}"`);
    }
  }

  private addIniLine(packFolder: string): Pick<InstallResult, "line" | "placement" | "iniBackup" | "warnings"> {
    const iniPath = path.join(this.customScenery(), INI_NAME);
    const line = `SCENERY_PACK Custom Scenery/${packFolder}/`;
    if (!existsSync(iniPath)) {
      // X-Plane writes this file at startup and finds the pack on its own, at the bottom of the list.
      // Creating the file would mean inventing the rest of somebody's scenery order.
      return { line, placement: "no-ini", iniBackup: null, warnings: [`There is no ${INI_NAME} yet: X-Plane will find the pack by itself when it starts.`] };
    }
    const edit = insertSceneryPack(readFileSync(iniPath, "latin1"), packFolder);
    if (!edit.changed) {
      const warnings = edit.placement === "disabled-by-user" ? [`${INI_NAME} lists this pack as switched off; that was left alone.`] : [];
      return { line: edit.line, placement: edit.placement, iniBackup: null, warnings };
    }
    const backup = path.join(this.customScenery(), `${INI_NAME}.before_${packFolder}.bak`);
    this.writeIni(iniPath, backup, edit.text);
    const warnings = edit.placement === "appended" ? [`${INI_NAME} has no *GLOBAL_AIRPORTS* line, so the pack went at the end of the list.`] : [];
    return { line: edit.line, placement: edit.placement, iniBackup: backup, warnings };
  }

  private removeIniLine(packFolder: string): void {
    const iniPath = path.join(this.customScenery(), INI_NAME);
    if (!existsSync(iniPath)) return;
    const edit = removeSceneryPack(readFileSync(iniPath, "latin1"), packFolder);
    if (edit.changed) this.writeIni(iniPath, path.join(this.customScenery(), `${INI_NAME}.before_remove_${packFolder}.bak`), edit.text);
  }

  private writeIni(iniPath: string, backup: string, text: string): void {
    try {
      copyFileSync(iniPath, backup);
      const tmp = `${iniPath}.racer-tmp`;
      writeFileSync(tmp, text, "latin1");
      renameSync(tmp, iniPath);
    } catch (e) {
      rethrowLocked(e, INI_NAME);
    }
  }
}

function readMarker(dir: string): PackMarker | null {
  try {
    return markerSchema.parse(JSON.parse(readFileSync(path.join(dir, MARKER_FILE), "utf8")));
  } catch {
    return null;
  }
}
