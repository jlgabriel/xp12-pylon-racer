import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { isOurPackFolderName, packFolderName, packPylons, packSceneryId, planPack } from "../src/core/export/pack";
import { DEFAULT_PYLON, PYLONS, pylonFor, pylonHeightFor, pylonHitRadiusFor, pylonLabel, sizedPylon } from "../src/core/export/pylons";
import { haversine } from "../src/core/geo/geo";
import { makeCourse } from "./helpers";

const sprint = sampleCourses().find((c) => c.id === "munich-sprint")!;
const DEPS = {
  deflate: (b: Uint8Array) => new Uint8Array(deflateSync(b)),
  md5: (b: Uint8Array) => new Uint8Array(createHash("md5").update(b).digest()),
  appVersion: "0.1.0-test",
};

describe("pack folder name", () => {
  it("is XPR_ and the course id", () => {
    expect(packFolderName("munich-sprint")).toBe("XPR_munich-sprint");
    expect(packFolderName("Hello World..2")).toBe("XPR_hello-world-2");
  });

  it("recognizes only folder names the app could have made", () => {
    expect(isOurPackFolderName("XPR_munich-sprint")).toBe(true);
    expect(isOurPackFolderName("XPR_H1_Pylons")).toBe(false); // the probe's: upper case
    expect(isOurPackFolderName("XP Object Placer Scenery")).toBe(false);
    expect(isOurPackFolderName("XPR_../x")).toBe(false);
    expect(isOurPackFolderName("XPR_")).toBe(false);
  });
});

describe("the pylons", () => {
  it("stand where the Aerofly exporter put them, to 7 decimals (golden)", () => {
    // The .tsl that Pylon Racer's predecessor wrote for the same gates. Only positions are compared:
    // the rest of that file is Aerofly's and did not come across.
    const golden = readFileSync(new URL("fixtures/rct_munich_sprint.tsl", import.meta.url), "utf8");
    const want = [...golden.matchAll(/position\]\[(-?[\d.]+) (-?[\d.]+) 0\]/g)].map((m) => `${m[1]} ${m[2]}`);
    const got = packPylons(sprint).map(({ object: o }) => `${o.position.lon.toFixed(7)} ${o.position.lat.toFixed(7)}`);
    expect(got).toEqual(want);
  });

  it("are two per gate and one per turn pylon, each half the gate width from the center", () => {
    const c = makeCourse([
      { type: "start", x: 0, y: -500, heading: 0 },
      { type: "turn", x: 0, y: 0, heading: 0, turnSide: "left" },
      { type: "gate", x: 0, y: 200, heading: 0 },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ]);
    const pylons = packPylons(c);
    expect(pylons).toHaveLength(7);
    expect(haversine(pylons[0]!.object.position, pylons[1]!.object.position)).toBeCloseTo(c.gates[0]!.widthM, 3);
    expect(pylons.map((p) => p.object.rotation).every((r) => r === 0)).toBe(true);
  });
});

describe("the plan", () => {
  it("bundles each model the course uses once, an .obj and its .png, and one DSF per tile", () => {
    const plan = planPack(sprint, DEPS);
    expect(plan.packFolder).toBe("XPR_munich-sprint");
    expect(plan.pylonCount).toBe(10);
    expect(plan.files.map((f) => f.path)).toEqual([
      ...["blue", "green", "home", "red"].flatMap((m) => [`objects/pylon_${m}.obj`, `objects/pylon_${m}.png`]),
      "Earth nav data/+40+010/+48+011.dsf",
    ]);
  });

  it("points every OBJECT_DEF at a file the pack carries", () => {
    const plan = planPack(sprint, DEPS);
    const dsf = Buffer.from(plan.files.find((f) => f.path.endsWith(".dsf"))!.bytes).toString("latin1");
    const paths = new Set(plan.files.map((f) => f.path));
    const defs = [...dsf.matchAll(/objects\/pylon_[a-z0-9-]+\.obj/g)].map((m) => m[0]);
    expect(defs.length).toBeGreaterThan(0);
    for (const d of defs) expect(paths.has(d)).toBe(true);
  });

  it("names each .obj's texture as the .png beside it", () => {
    const plan = planPack(sprint, DEPS);
    for (const f of plan.files.filter((x) => x.path.endsWith(".obj"))) {
      const texture = /^TEXTURE\t(.+)$/m.exec(Buffer.from(f.bytes).toString("latin1"))![1];
      expect(plan.files.some((x) => x.path === `objects/${texture}`)).toBe(true);
    }
  });

  it("splits a course that crosses a tile edge into one DSF per tile", () => {
    const c = makeCourse([
      { type: "start", x: 0, y: 0, heading: 90 },
      { type: "finish", x: 3000, y: 0, heading: 90 },
    ]);
    // makeCourse centers on a fixed origin; move it astride the 12° meridian.
    const moved = { ...c, gates: c.gates.map((g, i) => ({ ...g, center: { lon: i === 0 ? 11.99 : 12.01, lat: 48.5 } })) };
    const dsfs = planPack(moved, DEPS).files.filter((f) => f.path.endsWith(".dsf")).map((f) => f.path);
    expect(dsfs).toEqual(["Earth nav data/+40+010/+48+011.dsf", "Earth nav data/+40+010/+48+012.dsf"]);
  });

  it("carries the tall models under their own names, built twice as tall", () => {
    const tall = { ...sprint, rules: { ...sprint.rules, pylonSize: "tall" as const } };
    const plan = planPack(tall, DEPS);
    expect(plan.files.map((f) => f.path)).toEqual([
      ...["blue", "green", "home", "red"].flatMap((m) => [`objects/pylon_${m}_tall.obj`, `objects/pylon_${m}_tall.png`]),
      "Earth nav data/+40+010/+48+011.dsf",
    ]);
    const red = Buffer.from(plan.files.find((f) => f.path === "objects/pylon_red_tall.obj")!.bytes).toString("latin1");
    const heights = [...red.matchAll(/^VT\t\S+\t(\S+)\t/gm)].map((m) => Number(m[1]));
    expect(Math.max(...heights)).toBe(30);
    expect(red).toMatch(/^TEXTURE\tpylon_red_tall\.png$/m);
    const dsf = Buffer.from(plan.files.find((f) => f.path.endsWith(".dsf"))!.bytes).toString("latin1");
    expect(dsf).toContain("objects/pylon_red_tall.obj");
    expect(packSceneryId(tall)).not.toBe(packSceneryId(sprint));
  });

  it("has a scenery id that follows the pylons and not the name", () => {
    expect(packSceneryId({ ...sprint, name: "Renamed" })).toBe(packSceneryId(sprint));
    const moved = { ...sprint, gates: sprint.gates.map((g, i) => (i === 0 ? { ...g, center: { ...g.center, lon: g.center.lon + 1e-4 } } : g)) };
    expect(packSceneryId(moved)).not.toBe(packSceneryId(sprint));
  });
});

describe("pylon models", () => {
  it("every gate type has a default that exists", () => {
    for (const id of Object.values(DEFAULT_PYLON)) expect(PYLONS.some((p) => p.id === id)).toBe(true);
  });

  it("an unknown id falls back to the type's default", () => {
    expect(pylonFor({ type: "start", pylon: "nope" }).id).toBe("green");
    expect(pylonFor({ type: "gate", pylon: "blue" }).id).toBe("blue");
  });

  it("keeps every id Pylon Racer (Aerofly) stores in course files", () => {
    expect(PYLONS.map((p) => p.id)).toEqual(["red", "green", "blue", "home", "home2", "rgb", "rb", "rodeo-reno", "rodeo-18", "rodeo-25"]);
  });

  it("knows every model's height, so the course-wide pylon height is never used", () => {
    for (const p of PYLONS) {
      expect(pylonHeightFor({ type: "gate", pylon: p.id }, { pylonHeightM: 999, pylonSize: "standard" })).toBe(p.heightM);
    }
    expect(PYLONS.find((p) => p.id === "rodeo-25")!.heightM).toBe(25);
  });

  it("are twice as tall and as wide at the tall size, with the same paint", () => {
    for (const p of PYLONS) {
      const tall = sizedPylon(p, "tall");
      expect([tall.heightM, tall.baseRadiusM, tall.topRadiusM]).toEqual([2 * p.heightM, 2 * p.baseRadiusM, 2 * p.topRadiusM]);
      expect(tall.bands).toEqual(p.bands);
      expect(tall.id).toBe(p.id);
      expect(pylonHeightFor({ type: "gate", pylon: p.id }, { pylonHeightM: 25, pylonSize: "tall" })).toBe(2 * p.heightM);
    }
    expect(sizedPylon(PYLONS[0]!, "standard")).toBe(PYLONS[0]);
  });

  it("widen the hit distance by as much as the pylon widened, so a hit is never inside it", () => {
    const rules = { pylonHitRadiusM: 5 };
    expect(pylonHitRadiusFor({ type: "gate", pylon: "red" }, { ...rules, pylonSize: "standard" })).toBe(5);
    expect(pylonHitRadiusFor({ type: "gate", pylon: "red" }, { ...rules, pylonSize: "tall" })).toBeCloseTo(6.2, 9);
    for (const p of PYLONS) {
      const r = pylonHitRadiusFor({ type: "gate", pylon: p.id }, { ...rules, pylonSize: "tall" });
      expect(r - sizedPylon(p, "tall").baseRadiusM).toBeCloseTo(5 - p.baseRadiusM, 9);
    }
  });

  it("show their real height in a picker at the tall size", () => {
    const red = PYLONS[0]!;
    expect(pylonLabel(red, "standard")).toBe("Red 15 m");
    expect(pylonLabel(red, "tall")).toBe("Red 15 m → 30 m");
  });

  it("has a sane shape and paint for every model", () => {
    for (const p of PYLONS) {
      expect(p.topRadiusM).toBeLessThan(p.baseRadiusM);
      expect(p.bands.length).toBeGreaterThan(0);
      for (const c of p.bands) for (const v of c) expect(v >= 0 && v <= 255).toBe(true);
    }
  });
});
