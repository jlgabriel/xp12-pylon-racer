import { describe, expect, it } from "vitest";
import type { Pass, Penalty } from "../src/core/race/engine";
import type { Run } from "../src/core/run/run";
import { splits } from "../src/core/run/splits";

const pass = (step: number, elapsed: number): Pass =>
  ({ step, gateIndex: step, lap: 1, t: elapsed, elapsed, altMslM: 0, aglM: 0, rollDeg: 0, gsMs: 80, offsetM: 0 }) as Pass;
const pen = (step: number, seconds: number): Penalty => ({ kind: "attitude", step, gateIndex: step, elapsed: 0, seconds, measured: null });

// The reference: 6 s per sector, +2 s at step 1.
const best = {
  passes: [pass(0, 0), pass(1, 6), pass(2, 12), pass(3, 18)],
  penalties: [pen(1, 2)],
} as unknown as Run;

describe("splits", () => {
  it("cuts the race at every pass, penalties in their sector", () => {
    const s = splits([pass(0, 0), pass(1, 5), pass(2, 11), pass(3, 16)], [pen(2, 10)], null);
    expect(s.map((x) => x.sector)).toEqual([0, 5, 16, 5]);
    expect(s.map((x) => x.penalties)).toEqual([0, 0, 10, 0]);
    expect(s.every((x) => x.delta === null && x.sectorDelta === null)).toBe(true);
  });

  it("compares each sector and the running total with the reference", () => {
    const s = splits([pass(0, 0), pass(1, 5), pass(2, 11), pass(3, 16)], [pen(2, 10)], best);
    // sector 1: 5 against 6 + 2; sector 2: 6 + 10 against 6; sector 3: 5 against 6
    expect(s.map((x) => x.sectorDelta)).toEqual([null, -3, 10, -1]);
    expect(s.map((x) => x.delta)).toEqual([null, -3, 7, 6]);
  });

  it("counts a penalty at the start line in the first sector", () => {
    const s = splits([pass(0, 0), pass(1, 5), pass(2, 11)], [pen(0, 2)], null);
    expect(s.map((x) => x.penalties)).toEqual([0, 2, 0]);
    expect(s[1]!.sector + s[2]!.sector).toBe(11 + 2);
  });

  it("puts a missed gate's time into the next sector, and compares it with the reference's two", () => {
    const s = splits([pass(0, 0), pass(2, 11), pass(3, 17)], [pen(1, 10)], best);
    expect(s.map((x) => x.step)).toEqual([0, 2, 3]);
    expect(s[1]).toMatchObject({ sector: 21, penalties: 10, sectorDelta: 21 - 14, delta: 7 });
    expect(s[2]).toMatchObject({ sector: 6, sectorDelta: 0, delta: 7 });
  });
});
