import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { courseRevision } from "../src/core/course/course";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { MARKER_FILE } from "../src/core/export/pack";
import { summarizeCourse } from "../src/core/run/summaries";
import { InstallError, Installer, XplaneNotFoundError } from "../src/main/installer";

const sprint = sampleCourses().find((c) => c.id === "munich-sprint")!;
const PACK = "XPR_munich-sprint";

// The shape of a real scenery_packs.ini (X-Plane 12.4.3), LF endings like the one on Juan's disk.
const INI = [
  "I",
  "1000 Version",
  "SCENERY",
  "",
  "SCENERY_PACK Custom Scenery/X-Plane Airports - KBTV Burlington/",
  "SCENERY_PACK *GLOBAL_AIRPORTS*",
  "SCENERY_PACK Custom Scenery/XP Object Placer Scenery/",
  "SCENERY_PACK Custom Scenery/zOrtho4XP_-34-071/",
  "",
].join("\n");

let xp: string;
let cs: string;
let installer: Installer;

beforeEach(() => {
  xp = mkdtempSync(path.join(tmpdir(), "racer-xp12-"));
  cs = path.join(xp, "Custom Scenery");
  mkdirSync(cs);
  writeFileSync(path.join(cs, "scenery_packs.ini"), INI, "latin1");
  installer = new Installer(() => xp, "0.1.0-test");
});

const ini = (): string[] => readFileSync(path.join(cs, "scenery_packs.ini"), "latin1").split("\n");

describe("installing a course", () => {
  it("writes the models the course uses, one DSF and the marker", () => {
    const got = installer.install(sprint);
    expect(got.folderName).toBe(PACK);
    const dir = path.join(cs, PACK);
    expect(readdirSync(dir).sort()).toEqual(["Earth nav data", MARKER_FILE, "objects"].sort());
    expect(readdirSync(path.join(dir, "objects")).sort()).toEqual(
      ["blue", "green", "home", "red"].flatMap((m) => [`pylon_${m}.obj`, `pylon_${m}.png`]).sort(),
    );
    const dsf = readFileSync(path.join(dir, "Earth nav data", "+40+010", "+48+011.dsf"));
    expect(dsf.subarray(0, 8).toString("latin1")).toBe("XPLNEDSF");
    expect(dsf.toString("latin1")).toContain("objects/pylon_red.obj");
    const marker = JSON.parse(readFileSync(path.join(dir, MARKER_FILE), "utf8"));
    expect(marker).toMatchObject({ app: "xp-pylon-racer", packName: PACK, courseId: "munich-sprint", revision: courseRevision(sprint) });
    expect(installer.list().map((p) => p.courseId)).toEqual(["munich-sprint"]);
  });

  it("lists the pack right below *GLOBAL_AIRPORTS*, after backing the ini up, and only once", () => {
    const got = installer.install(sprint);
    expect(got.placement).toBe("below-global-airports");
    expect(ini()[ini().indexOf("SCENERY_PACK *GLOBAL_AIRPORTS*") + 1]).toBe(`SCENERY_PACK Custom Scenery/${PACK}/`);
    expect(readFileSync(got.iniBackup!, "latin1")).toBe(INI);
    installer.install(sprint);
    expect(ini().filter((l) => l.includes(PACK))).toHaveLength(1);
    // Nothing else in the file moved.
    expect(ini().filter((l) => !l.includes(PACK))).toEqual(INI.split("\n"));
  });

  it("is out of date when a pylon model changed, even one of the same height", () => {
    installer.install(sprint);
    const state = (c: typeof sprint) => summarizeCourse(c, [], installer.list()).install.state;
    expect(state(sprint)).toBe("current");
    // Red → blue: both 15 m, so the revision does not change, but the pack does.
    const swapped = { ...sprint, gates: sprint.gates.map((g, i) => (i === 1 ? { ...g, pylon: "blue" } : g)) };
    expect(courseRevision(swapped)).toBe(courseRevision(sprint));
    expect(state(swapped)).toBe("outdated");
    expect(state({ ...sprint, name: "Renamed" })).toBe("current");
  });

  it("leaves no staging folder behind", () => {
    installer.install(sprint);
    expect(readdirSync(cs).filter((n) => n.includes("racer"))).toEqual([]);
  });

  it("refuses when there is no X-Plane folder", () => {
    expect(() => new Installer(() => "", "x").install(sprint)).toThrow(XplaneNotFoundError);
    expect(() => new Installer(() => path.join(xp, "nope"), "x").install(sprint)).toThrow(XplaneNotFoundError);
  });

  it("installs without an ini, which X-Plane writes itself at startup", () => {
    const bare = mkdtempSync(path.join(tmpdir(), "racer-xp12-"));
    mkdirSync(path.join(bare, "Custom Scenery"));
    const got = new Installer(() => bare, "x").install(sprint);
    expect(got.placement).toBe("no-ini");
    expect(existsSync(path.join(bare, "Custom Scenery", "scenery_packs.ini"))).toBe(false);
  });
});

describe("uninstalling", () => {
  it("removes the folder and its ini line, nothing else", () => {
    installer.install(sprint);
    expect(installer.uninstall("munich-sprint")).toEqual([PACK]);
    expect(existsSync(path.join(cs, PACK))).toBe(false);
    expect(readFileSync(path.join(cs, "scenery_packs.ini"), "latin1")).toBe(INI);
  });
});

describe("never touching what is not ours", () => {
  it("refuses to overwrite a folder of the same name that has no marker", () => {
    mkdirSync(path.join(cs, PACK));
    writeFileSync(path.join(cs, PACK, "keep.txt"), "mine");
    expect(() => installer.install(sprint)).toThrow(InstallError);
    expect(readFileSync(path.join(cs, PACK, "keep.txt"), "utf8")).toBe("mine");
  });

  it("keeps other packs, even with our name pattern but no marker", () => {
    mkdirSync(path.join(cs, "XPR_lookalike"));
    mkdirSync(path.join(cs, "X-Plane Landmarks - Paris"));
    installer.install(sprint);
    installer.uninstall("munich-sprint");
    expect(readdirSync(cs).filter((n) => !n.startsWith("scenery_packs.ini")).sort()).toEqual(["X-Plane Landmarks - Paris", "XPR_lookalike"]);
  });

  it("does not trust a marker inside a folder whose name it could not have made", () => {
    const foreign = path.join(cs, "Someone Else");
    mkdirSync(foreign);
    writeFileSync(path.join(foreign, MARKER_FILE), JSON.stringify({ app: "xp-pylon-racer", packName: "x", courseId: "munich-sprint" }));
    installer.uninstall("munich-sprint");
    expect(existsSync(foreign)).toBe(true);
  });

  it("does not take Pylon Racer's (Aerofly) marker for its own", () => {
    const old = path.join(cs, "XPR_munich-sprint");
    mkdirSync(old);
    writeFileSync(path.join(old, MARKER_FILE), JSON.stringify({ app: "pylon-racer", courseId: "munich-sprint" }));
    expect(installer.list()).toEqual([]);
    expect(() => installer.install(sprint)).toThrow(InstallError);
  });
});
