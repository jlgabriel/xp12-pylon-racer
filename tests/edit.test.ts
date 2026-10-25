import { describe, expect, it } from "vitest";
import { parseCourse } from "../src/core/course/course";
import {
  addGate,
  draftProblem,
  headingFromHandle,
  insertGateAfter,
  moveGate,
  moveGateInOrder,
  newDraft,
  removeGate,
  setKind,
  setLaps,
  suggestedHeading,
  widthFromPylon,
} from "../src/core/course/edit";
import { destination, haversine } from "../src/core/geo/geo";
import { makeCourse } from "./helpers";

const at = (x: number) => destination({ lon: -116.8, lat: 34.85 }, x, 270);

function threeGates() {
  let d = newDraft("c1", "Tester", "2026-10-18T00:00:00Z");
  d = addGate(d, at(0));
  d = addGate(d, at(600));
  return addGate(d, at(1200));
}

describe("building a course on the map", () => {
  it("assigns start and finish by position as gates are added", () => {
    let d = newDraft("c1", "Tester", "2026-10-18T00:00:00Z");
    d = addGate(d, at(0));
    expect(d.gates.map((g) => g.type)).toEqual(["start"]);
    expect(draftProblem(d)).toMatch(/at least two/);
    d = addGate(d, at(600));
    expect(d.gates.map((g) => g.type)).toEqual(["start", "finish"]);
    d = addGate(d, at(1200));
    expect(d.gates.map((g) => g.type)).toEqual(["start", "gate", "finish"]);
    expect(draftProblem(d)).toBeNull();
    expect(() => parseCourse(d)).not.toThrow();
  });

  it("faces each new gate away from the previous one, and the start toward the second", () => {
    const d = threeGates();
    expect(d.gates.map((g) => g.headingDeg)).toEqual([270, 270, 270]);
  });

  it("keeps roles right when gates are removed or reordered", () => {
    let d = threeGates();
    const [a, , c] = d.gates;
    d = moveGateInOrder(d, c!.id, -1);
    expect(d.gates.map((g) => g.type)).toEqual(["start", "gate", "finish"]);
    d = removeGate(d, a!.id);
    expect(d.gates.map((g) => g.type)).toEqual(["start", "finish"]);
  });

  it("drops the finish on a multi-lap course and brings it back for one lap", () => {
    let d = setLaps(threeGates(), 3);
    expect(d.gates.map((g) => g.type)).toEqual(["start", "gate", "gate"]);
    expect(draftProblem(d)).toBeNull();
    d = setLaps(d, 1);
    expect(d.gates.map((g) => g.type)).toEqual(["start", "gate", "finish"]);
  });

  it("a turn pylon gets a side; another kind clears it", () => {
    let d = threeGates();
    const mid = d.gates[1]!.id;
    d = setKind(d, mid, "turn");
    expect(d.gates[1]).toMatchObject({ type: "turn", turnSide: "left" });
    d = setKind(d, mid, "knife");
    expect(d.gates[1]).toMatchObject({ type: "knife", turnSide: null });
  });

  it("inserts a gate halfway along a leg, facing along it", () => {
    const d = threeGates();
    const e = insertGateAfter(d, d.gates[0]!.id)!;
    expect(e.gates.map((g) => g.type)).toEqual(["start", "gate", "gate", "finish"]);
    expect(haversine(e.gates[1]!.center, at(300))).toBeLessThan(0.5);
    expect(e.gates[1]).toMatchObject({ headingDeg: 270, widthM: d.gates[0]!.widthM, groundElevM: null });
    expect(new Set(e.gates.map((g) => g.id)).size).toBe(4);
  });

  it("does not copy a turn pylon's reach as a gate width", () => {
    const d = setKind(threeGates(), "g2", "turn");
    const turn = { ...d, gates: d.gates.map((g) => (g.id === "g2" ? { ...g, widthM: 300 } : g)) };
    expect(insertGateAfter(turn, "g2")!.gates[2]!.widthM).toBe(80);
  });

  it("refuses a minimum height that is not below the maximum", () => {
    const d = threeGates();
    const bad = { ...d, gates: d.gates.map((g, i) => (i === 1 ? { ...g, topM: 40, bottomM: 50 } : g)) };
    expect(draftProblem(bad)).toBe("Gate 2: the minimum height must be below the maximum");
    expect(() => parseCourse(bad)).toThrow(/minimum height/);
  });

  it("inserts nothing after the finish, but closes the lap on a multi-lap course", () => {
    const d = threeGates();
    expect(insertGateAfter(d, d.gates[2]!.id)).toBeNull();
    const loop = insertGateAfter(setLaps(d, 2), d.gates[2]!.id)!;
    expect(loop.gates).toHaveLength(4);
    expect(haversine(loop.gates[3]!.center, at(600))).toBeLessThan(0.5);
    expect(loop.gates[3]!.headingDeg).toBe(90);
  });

  it("moving a gate forgets its terrain elevation", () => {
    let d = threeGates();
    d = { ...d, gates: d.gates.map((g) => ({ ...g, groundElevM: 588 })) };
    d = moveGate(d, d.gates[1]!.id, at(650));
    expect(d.gates.map((g) => g.groundElevM)).toEqual([588, null, 588]);
  });
});

describe("handles", () => {
  const center = { lon: -116.8, lat: 34.85 };

  it("the heading handle sets the heading toward it", () => {
    expect(headingFromHandle(center, destination(center, 100, 123))).toBe(123);
  });

  it("dragging a pylon sets the width along the gate line only", () => {
    // Gate faces north: the line runs east-west. 50 m east and 30 m north → width 100.
    const p = destination(destination(center, 50, 90), 30, 0);
    expect(widthFromPylon(center, 0, p)).toBe(100);
    expect(widthFromPylon(center, 0, destination(center, 2, 90))).toBe(10);
  });
});

describe("the suggested heading", () => {
  // North 500 m to a corner, then 500 m east.
  const corner = makeCourse([
    { type: "start", x: 0, y: -500, heading: 0 },
    { type: "gate", x: 0, y: 0, heading: 0 },
    { type: "finish", x: 500, y: 0, heading: 90 },
  ]);

  it("splits a corner between the leg in and the leg out", () => {
    expect(suggestedHeading(corner, "g2")).toBe(45);
  });

  it("faces the first leg at the start and the last one at the finish", () => {
    expect(suggestedHeading(corner, "g1")).toBe(0);
    expect(suggestedHeading(corner, "g3")).toBe(90);
  });

  it("closes the lap through the start on a multi-lap course", () => {
    // A triangle flown clockwise: start at the bottom left, up to the top, down to the right.
    const loop = makeCourse(
      [
        { type: "start", x: 0, y: 0, heading: 0 },
        { type: "gate", x: 0, y: 500, heading: 90 },
        { type: "gate", x: 500, y: 0, heading: 270 },
      ],
      { laps: 2 },
    );
    // In along the bottom leg, westwards (270°), and out to the north (0°): halfway is 315.
    expect(suggestedHeading(loop, "g1")).toBe(315);
  });

  it("has nothing to suggest for an unknown gate", () => {
    expect(suggestedHeading(corner, "nope")).toBeNull();
  });
});
