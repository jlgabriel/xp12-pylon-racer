import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { courseRevision, courseSchema, gateRoleProblem, raceSequence } from "../src/core/course/course";
import { importRctCourse, isRctCourse } from "../src/core/course/importRct";
import { haversine, pylonsOfGate } from "../src/core/geo/geo";
import { makeCourse, straightCourse } from "./helpers";

/** courseRevision(straightCourse()) as computed by XP Pylon Racer 0.1.0. It is not Pylon Racer's
 *  (Aerofly) value, and is not meant to be: every pylon here has a known height (15 m for the
 *  default red), which is part of how a course is scored and so of its revision. */
const V02_STRAIGHT_REVISION = "be371fc6882b64e5";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`fixtures/${name}`, import.meta.url), "utf8"));

describe("gate roles", () => {
  it("accepts start…finish for one lap", () => {
    expect(gateRoleProblem([{ type: "start" }, { type: "gate" }, { type: "finish" }], 1)).toBeNull();
  });

  it("rejects a course that does not open with the start", () => {
    expect(gateRoleProblem([{ type: "gate" }, { type: "start" }, { type: "finish" }], 1)).toMatch(/first gate/);
  });

  it("rejects a single-lap course without a finish at the end", () => {
    expect(gateRoleProblem([{ type: "start" }, { type: "finish" }, { type: "gate" }], 1)).toMatch(/last gate/);
  });

  it("rejects a finish gate on a multi-lap course", () => {
    expect(gateRoleProblem([{ type: "start" }, { type: "gate" }, { type: "finish" }], 3)).toMatch(/multi-lap/);
    expect(gateRoleProblem([{ type: "start" }, { type: "gate" }, { type: "level" }], 3)).toBeNull();
  });

  it("drops the medals of older course files", () => {
    const old = { ...straightCourse(), medals: { ga: { gold: 1, silver: 2, bronze: 3 } } };
    expect(courseSchema.parse(old)).not.toHaveProperty("medals");
  });

  it("the zod schema enforces the same rule", () => {
    expect(() => makeCourse([{ type: "gate", x: 0, y: 0, heading: 0 }, { type: "finish", x: 0, y: 100, heading: 0 }])).toThrow();
  });
});

describe("race sequence", () => {
  it("is the gates in order for one lap", () => {
    expect(raceSequence({ gates: straightCourse().gates, laps: 1 })).toEqual([0, 1, 2]);
  });

  it("repeats the lap and closes each one on the start line", () => {
    const gates = straightCourse().gates.slice(0, 2);
    expect(raceSequence({ gates: [...gates, gates[1]!], laps: 2 })).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });
});

describe("revision", () => {
  it("is stable for the same course and ignores cosmetic fields", () => {
    const a = straightCourse();
    const b = { ...straightCourse(), name: "Renamed", description: "x", author: "Rodeo" };
    expect(courseRevision(a)).toBe(courseRevision(b));
  });

  it("changes when a gate moves or a rule changes", () => {
    const a = straightCourse();
    const moved = makeCourse([
      { type: "start", x: 0, y: -500, heading: 0 },
      { type: "gate", x: 5, y: 0, heading: 0 },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ]);
    expect(courseRevision(moved)).not.toBe(courseRevision(a));
    const harsher = straightCourse({ rules: { missedGatePenaltyS: 30 } });
    expect(courseRevision(harsher)).not.toBe(courseRevision(a));
  });

  it("keeps the v0.2 revision while the rules added in v0.3 stay at their defaults", () => {
    // Pinned from v0.2: runs saved then must still match their course.
    expect(courseRevision(straightCourse())).toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(straightCourse({ rules: { pylonHitRadiusM: 5, pylonHeightM: 25 } }))).toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(straightCourse({ rules: { pylonHitRadiusM: 8 } }))).not.toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(straightCourse({ rules: { pylonHeightM: 40 } }))).not.toBe(V02_STRAIGHT_REVISION);
  });

  it("keeps the v0.2 revision with the v0.6 rules at their defaults and no height floors", () => {
    expect(courseRevision(straightCourse({ rules: { tooLowPenaltyS: 2, invertedToleranceDeg: 20 } }))).toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(straightCourse({ rules: { tooLowPenaltyS: 5 } }))).not.toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(straightCourse({ rules: { invertedToleranceDeg: 30 } }))).not.toBe(V02_STRAIGHT_REVISION);
    const floored = makeCourse([
      { type: "start", x: 0, y: -500, heading: 0 },
      { type: "gate", x: 0, y: 0, heading: 0, bottom: 40 },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ]);
    expect(courseRevision(floored)).not.toBe(V02_STRAIGHT_REVISION);
  });

  it("counts a gate's pylon model only through its height, when it differs from the course's", () => {
    const withPylon = (pylon: string, rules: Record<string, unknown> = {}) =>
      makeCourse(
        [
          { type: "start", x: 0, y: -500, heading: 0 },
          { type: "gate", x: 0, y: 0, heading: 0, pylon },
          { type: "finish", x: 0, y: 500, heading: 0 },
        ],
        { rules },
      );
    // A model as tall as the default red (15 m): no change.
    expect(courseRevision(withPylon("blue"))).toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(withPylon("rgb"))).toBe(V02_STRAIGHT_REVISION);
    // A taller model changes how the course is scored.
    expect(courseRevision(withPylon("rodeo-25"))).not.toBe(V02_STRAIGHT_REVISION);
    expect(courseRevision(withPylon("rodeo-18"))).toBe(courseRevision(withPylon("rodeo-18")));
    expect(courseRevision(withPylon("rodeo-25"))).not.toBe(courseRevision(withPylon("rodeo-18")));
  });
});

describe("import from the old pylon-race tool", () => {
  it("recognizes its course.json and converts it", () => {
    const data = fixture("munich_multicolor.json");
    expect(isRctCourse(data)).toBe(true);
    const c = importRctCourse(data, "2026-10-18T00:00:00Z");
    expect(c.name).toBe("Munich Multicolor (pylon test)");
    expect(c.id).toBe("munich-multicolor");
    expect(c.gates.map((g) => g.type)).toEqual(["start", "gate", "gate", "gate", "finish"]);
    expect(c.gates.map((g) => g.pylon)).toEqual(["green", "red", "blue", "red", "home"]);
    expect(c.gates[0]!.headingDeg).toBe(90);
    // The old tool's penalties are kept: they are the course author's choice.
    expect(c.rules.missedGatePenaltyS).toBe(3);
    expect(c.rules.wrongDirectionPenaltyS).toBe(3);
    // Its max_agl_m (80 on every gate) was a placeholder, not a rule.
    expect(c.gates.every((g) => g.topM === null)).toBe(true);
  });

  it("derives center, width and heading from two pylons", () => {
    const center = { lon: -119.88, lat: 39.66 };
    const { left, right } = pylonsOfGate(center, 120, 30);
    const c = importRctCourse(
      {
        schema_version: "0.1",
        course_id: "pylons",
        gates: [
          { id: 1, type: "start", sequence: 1, left_pylon: left, right_pylon: right },
          { id: 2, type: "finish", sequence: 2, center: { lon: -119.88, lat: 39.67 }, width_m: 80, orientation_deg: 30 },
        ],
      },
      "2026-10-18T00:00:00Z",
    );
    const g = c.gates[0]!;
    expect(g.widthM).toBeCloseTo(120, 0);
    expect(g.headingDeg).toBeCloseTo(30, 1);
    expect(haversine(g.center, center)).toBeLessThan(0.5);
  });

  it("orders gates by sequence, not by file order", () => {
    const data = fixture("test_course_01.json") as { gates: unknown[] };
    const reversed = { ...data, gates: [...data.gates].reverse() };
    const c = importRctCourse(reversed, "2026-10-18T00:00:00Z");
    expect(c.gates.map((g) => g.type)).toEqual(["start", "gate", "finish"]);
  });

  it("does not mistake a native course for an old one", () => {
    expect(isRctCourse(straightCourse())).toBe(false);
  });
});
