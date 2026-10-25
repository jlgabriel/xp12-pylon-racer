import { describe, expect, it } from "vitest";
import type { Pass, Penalty } from "../src/core/race/engine";
import { passDelta, penaltiesUpTo } from "../src/core/run/delta";
import type { Run } from "../src/core/run/run";

const pass = (step: number, elapsed: number): Pass =>
  ({ step, gateIndex: step, lap: 1, t: elapsed, elapsed, altMslM: 0, aglM: 0, rollDeg: 0, gsMs: 80, offsetM: 0 }) as Pass;
const pen = (step: number, seconds: number): Penalty => ({ kind: "attitude", step, gateIndex: step, elapsed: 0, seconds, measured: null });

// The reference: 33.78 total = 31.78 flown + 2 s for the level gate (step 1).
const best = {
  passes: [pass(0, 0), pass(1, 6), pass(2, 12), pass(3, 18), pass(4, 24), pass(5, 31.78)],
  penalties: [pen(1, 2)],
} as unknown as Run;

describe("the live delta", () => {
  it("counts only the penalties of the gates flown so far", () => {
    expect(penaltiesUpTo([pen(1, 2), pen(3, 10)], 2)).toBe(2);
    expect(penaltiesUpTo([pen(1, 2), pen(3, 10)], 3)).toBe(12);
  });

  it("is behind when faster in the air but penalized more (Juan's KDAG Rules Test, 2026-10-24)", () => {
    // 30.48 flown with +2 at the knife (step 2) and +10 at the turn (step 3): 42.48 against 33.78.
    const mine = [pen(2, 2), pen(3, 10)];
    expect(passDelta(pass(5, 30.48), mine, best)).toBeCloseTo(8.7, 6);
    expect(passDelta(pass(3, 17), mine, best)).toBeCloseTo(17 + 12 - (18 + 2), 6);
    expect(passDelta(pass(1, 5.5), [], best)).toBeCloseTo(-2.5, 6);
  });

  it("has no delta at the start or where the reference has no pass", () => {
    expect(passDelta(pass(0, 0), [], best)).toBeNull();
    expect(passDelta(pass(9, 50), [], best)).toBeNull();
  });
});
