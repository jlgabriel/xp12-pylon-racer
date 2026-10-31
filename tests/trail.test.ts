import { describe, expect, it } from "vitest";
import { appendTrail, type TrailPoint } from "../src/renderer/race/trail";
import { fixAt } from "./helpers";

describe("the minimap trail", () => {
  it("starts a new stretch where the sim reset the aircraft", () => {
    // Flight test 2026-10-20: after the pylon crash the trail drew a line from gate 2 to the runway.
    let trail: readonly TrailPoint[] = [];
    trail = appendTrail(trail, fixAt(0, 0, 0));
    trail = appendTrail(trail, fixAt(0, 15, 0.15));
    trail = appendTrail(trail, fixAt(0, 3100, 0.2, { gsMs: 0 }));
    trail = appendTrail(trail, fixAt(0, 3115, 0.35, { gsMs: 0 }));
    expect(trail.map((p) => p.jump)).toEqual([false, false, true, false]);
  });

  it("skips fixes that barely moved", () => {
    const trail = appendTrail([], fixAt(0, 0, 0));
    expect(appendTrail(trail, fixAt(0, 0, 0.05))).toBe(trail);
    expect(appendTrail(trail, fixAt(0, 3, 0.05))).toBe(trail);
  });

  // Flown 2026-10-31: kept by count, a 3-minute run at RPOS's 30 Hz showed only its last minute.
  it("keeps a whole race at 30 Hz", () => {
    let trail: readonly TrailPoint[] = [];
    // 200 s at 30 Hz and 80 m/s: 16 km, the length of a long course.
    for (let i = 0; i <= 6000; i++) trail = appendTrail(trail, fixAt(0, i * (80 / 30), i / 30, { gsMs: 80 }));
    expect(trail[0]!.lat).toBe(fixAt(0, 0, 0).lat);
    expect(trail.length).toBeLessThan(2000);
  });
});
