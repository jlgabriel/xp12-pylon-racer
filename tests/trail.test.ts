import { describe, expect, it } from "vitest";
import { appendTrail, type TrailPoint } from "../src/renderer/race/trail";
import { fixAt } from "./helpers";

describe("the minimap trail", () => {
  it("starts a new stretch where the sim reset the aircraft", () => {
    // Flight test 2026-10-20: after the pylon crash the trail drew a line from gate 2 to the runway.
    let trail: readonly TrailPoint[] = [];
    trail = appendTrail(trail, fixAt(0, 0, 0));
    trail = appendTrail(trail, fixAt(0, 5, 0.05));
    trail = appendTrail(trail, fixAt(0, 3100, 0.1, { gsMs: 0 }));
    trail = appendTrail(trail, fixAt(0, 3101, 0.15, { gsMs: 0 }));
    expect(trail.map((p) => p.jump)).toEqual([false, false, true, false]);
  });

  it("skips repeated positions", () => {
    const trail = appendTrail([], fixAt(0, 0, 0));
    expect(appendTrail(trail, fixAt(0, 0, 0.05))).toBe(trail);
  });
});
