import { describe, expect, it } from "vitest";
import { resolveClass } from "../src/core/ranking/classes";
import { classesOf, currentClass, leaderboard, pilotBest, pilotRuns } from "../src/core/ranking/ranking";
import type { RunSummary } from "../src/shared/racerApi";

let n = 0;
function run(p: Partial<RunSummary>): RunSummary {
  n++;
  return {
    id: `r${n}`,
    courseId: "c",
    courseRevision: "rev",
    status: "finished",
    dnfReason: null,
    total: 60,
    raw: 60,
    penaltyTotal: 0,
    aircraftId: "Extra",
    classId: "aerobatic",
    source: "rpos",
    sourceHz: 40,
    pilot: "Juan",
    startedAt: `2026-10-24T10:00:${String(n).padStart(2, "0")}Z`,
    ...p,
  };
}

describe("resolveClass", () => {
  const choices = { aircraft: { my_plane: "jet", C172: "jet", odd: "nope" }, noAircraft: "ga" };

  it("keeps the built-in class of a known aircraft, whatever was chosen", () => {
    expect(resolveClass("C172", choices)).toBe("ga");
    expect(resolveClass("Extra", choices)).toBe("aerobatic");
  });

  it("matches an ICAO code without case, as add-ons spell them their own way", () => {
    expect(resolveClass("EXTRA", choices)).toBe("aerobatic");
    expect(resolveClass("ch47", choices)).toBe("helicopter");
    expect(resolveClass(" c172 ", choices)).toBe("ga");
  });

  it("uses the pilot's choice for an aircraft it does not know, and for no aircraft name", () => {
    expect(resolveClass("my_plane", choices)).toBe("jet");
    expect(resolveClass(null, choices)).toBe("ga");
  });

  it("is unclassified with no choice, or a choice that is not a class", () => {
    expect(resolveClass("other_plane", choices)).toBeNull();
    expect(resolveClass("odd", choices)).toBeNull();
    expect(resolveClass(null, { aircraft: {}, noAircraft: null })).toBeNull();
  });
});

describe("ranking", () => {
  const runs = [
    run({ pilot: "Juan", total: 50 }),
    run({ pilot: "Juan", total: 45 }),
    run({ pilot: "Pedro", total: 47 }),
    run({ pilot: "Pedro", total: 40, status: "dnf", dnfReason: "stopped" }),
    run({ pilot: "Pedro", total: 30, aircraftId: "C172", classId: "ga" }),
    run({ pilot: "Ana", total: 70, aircraftId: null, classId: null, source: "rpos" }),
    run({ pilot: "Ana", total: 55, classId: "class-from-a-newer-version" }),
  ];

  it("lists the classes flown, in catalog order, unclassified last", () => {
    expect(classesOf(runs)).toEqual(["aerobatic", "ga", null]);
  });

  it("has one row per pilot with their best finished run in the class", () => {
    expect(leaderboard(runs, "aerobatic").map((r) => [r.pilot, r.total])).toEqual([
      ["Juan", 45],
      ["Pedro", 47],
    ]);
    expect(leaderboard(runs, "ga").map((r) => r.pilot)).toEqual(["Pedro"]);
    expect(leaderboard(runs, null).map((r) => [r.pilot, r.total])).toEqual([["Ana", 55]]);
  });

  it("never ranks a demo flight, but keeps it last in the pilot's runs", () => {
    const withDemo = [...runs, run({ pilot: "Juan", total: 10, source: "demo" })];
    expect(leaderboard(withDemo, "aerobatic").map((r) => r.total)).toEqual([45, 47]);
    expect(pilotBest(withDemo, "Juan", "aerobatic")?.total).toBe(45);
    expect(pilotRuns(withDemo, "Juan", "aerobatic").map((r) => [r.source, r.total])).toEqual([
      ["rpos", 45],
      ["rpos", 50],
      ["demo", 10],
    ]);
  });

  it("gives a tie to whoever flew it first", () => {
    const tie = [run({ pilot: "B", total: 40 }), run({ pilot: "A", total: 40 })];
    expect(leaderboard(tie, "aerobatic").map((r) => r.pilot)).toEqual(["B", "A"]);
  });

  it("lists a pilot's runs in the class with DNFs after the finished ones", () => {
    expect(pilotRuns(runs, "Pedro", "aerobatic").map((r) => [r.status, r.total])).toEqual([
      ["finished", 47],
      ["dnf", 40],
    ]);
  });

  it("finds a pilot's best in a class, or none", () => {
    expect(pilotBest(runs, "Pedro", "aerobatic")?.total).toBe(47);
    expect(pilotBest(runs, "Pedro", "ga")?.total).toBe(30);
    expect(pilotBest(runs, "Juan", "ga")).toBeNull();
  });
});

describe("currentClass", () => {
  const demo = run({ source: "demo", classId: "aerobatic" });
  const unnamed = run({ source: "rpos", classId: "ga", aircraftId: null });

  it("is the class flown now when telemetry says, a demo never counting as flying", () => {
    expect(currentClass([demo, unnamed], "Juan", "jet")).toBe("jet");
  });

  it("is the class of the latest real run, even after a newer demo", () => {
    const later = run({ source: "demo", classId: "aerobatic" });
    expect(currentClass([unnamed, later], "Juan", undefined)).toBe("ga");
  });

  it("for a pilot with only demo flights, is the class of their latest demo", () => {
    expect(currentClass([demo], "Juan", undefined)).toBe("aerobatic");
    expect(currentClass([demo], "Rook", undefined)).toBeNull();
  });
});
