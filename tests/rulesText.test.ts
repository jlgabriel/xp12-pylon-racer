import { describe, expect, it } from "vitest";
import type { Pass } from "../src/core/race/engine";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { dnfText, gateRequirements, penaltyReason } from "../src/renderer/race/rulesText";

const rules = sampleCourses().find((c) => c.id === "kdag-rules-test")!;

describe("rules text", () => {
  it("tells which side of a turn pylon to fly by, not which side to keep it on", () => {
    // Kept on the left = flown by on its right (flight test 2026-10-19: the old words confused).
    const turn = rules.gates[3]!;
    expect(gateRequirements(turn, rules)).toEqual(["pass to the right of the pylon"]);
    const cut = { kind: "turn-cut", step: 3, gateIndex: 3, elapsed: 19, seconds: 10, measured: null } as const;
    expect(penaltyReason(cut, rules)).toBe("turn pylon cut: passed to its left (pass to its right)");
  });

  it("words the inverted gate and the height window", () => {
    const g = { ...rules.gates[1]!, type: "inverted" as const, topM: 100, bottomM: 40 };
    expect(gateRequirements(g, rules)).toEqual(["upside down, 180° ±20°", "between 40 m and 100 m high"]);
    expect(gateRequirements({ ...g, type: "gate", topM: null }, rules)).toEqual(["above 40 m"]);
    const course = { ...rules, gates: rules.gates.map((x, i) => (i === 1 ? g : x)) };
    const low = { kind: "too-low", step: 1, gateIndex: 1, elapsed: 5, seconds: 2, measured: 31.6 } as const;
    expect(penaltyReason(low, course)).toBe("too low: 32 m (min 40 m)");
    const flat = { kind: "attitude", step: 1, gateIndex: 1, elapsed: 5, seconds: 2, measured: -120 } as const;
    expect(penaltyReason(flat, course)).toBe("not upside down: bank -120° (needs 180° ±20°)");
  });

  it("says why a race did not finish", () => {
    const pass = { step: 1, gateIndex: 1 } as Pass;
    expect(dnfText({ dnfReason: "reset", passes: [pass], sequence: [0, 1, 2], step: 2 })).toBe("reset in the sim after gate 2");
    expect(dnfText({ dnfReason: "stopped", passes: [pass], sequence: [0, 1, 2], step: 2 })).toBe("crashed or paused after gate 2");
    expect(dnfText({ dnfReason: "missed-gate", passes: [pass], sequence: [0, 1, 2], step: 2 })).toBe("missed gate 3");
    expect(dnfText({ dnfReason: null, passes: [], sequence: [0, 1, 2], step: 0 })).toBeNull();
  });
});
