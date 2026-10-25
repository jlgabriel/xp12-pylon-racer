import { describe, expect, it } from "vitest";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { courseSketch } from "../src/core/run/summaries";

const course = (id: string) => sampleCourses().find((c) => c.id === id)!;

describe("courseSketch", () => {
  it("lays a westbound straight course across the middle, start on the right", () => {
    const s = courseSketch(course("daggett-sprint"));
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ x: 1, y: 0.5, type: "start" });
    expect(s[4]).toMatchObject({ x: 0, y: 0.5, type: "finish" });
  });

  it("keeps the proportions of a diamond, north up", () => {
    const [start, north, east, south] = courseSketch(course("munich-diamond"));
    expect(north!.y).toBe(0);
    expect(south!.y).toBeCloseTo(1, 2);
    expect(east!.x).toBeCloseTo(1, 2);
    expect(start!.x).toBeCloseTo(0, 2);
    // 1.4 km legs at 45°: as tall as wide once longitude is scaled by cos(latitude)
    expect(start!.y).toBeCloseTo(0.5, 1);
  });

  it("is empty without gates", () => {
    expect(courseSketch({ gates: [] })).toEqual([]);
  });
});
