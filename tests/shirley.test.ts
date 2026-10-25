import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import {
  challengeName,
  courseRecords,
  MAX_CHALLENGE_NAME,
  raceTime,
  shirleyChallenge,
  shirleyFileName,
  type ShirleyRecord,
} from "../src/core/export/shirley";
import type { RunSummary } from "../src/shared/racerApi";
import { makeCourse, straightCourse } from "./helpers";

// Airplane-Team's ChallengeSchema (challenge_schema.ts and waypoint.ts, read 2026-10-25), cut down to
// the fields the export writes. Strict where Shirley only warns, so a misspelled key fails here.
const NAME = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]*$/);
const TOOLS = z
  .object(
    Object.fromEntries(
      ["setPosition", "resetFlight", "setSimulatorSetpoints", "setDestinationRunway", "analyzeFlightData"].map((k) => [k, z.boolean().optional()]),
    ),
  )
  .strict();
const WAYPOINT = z
  .object({
    latitudeDeg: z.number().min(-90).max(90),
    longitudeDeg: z.number().min(-180).max(180),
    name: z.string().regex(/^\S+$/),
    context: z.string(),
  })
  .strict();
const STATE = z
  .object({
    navigateToUserWaypoint: z.boolean().optional(),
    distanceFromUserWaypoint: z.boolean().optional(),
    navigateToStateWaypoints: z.array(WAYPOINT).max(50).optional(),
    recordFlightData: z.boolean().optional(),
    challengeTimer: z.boolean().optional(),
    wakeUpAfterQuietPeriodSeconds: z.number().gt(0).nullable().optional(),
    assistantModeEnabled: z.boolean().optional(),
  })
  .strict();
const PHASE = z
  .object({
    name: NAME,
    shortDescription: z.string(),
    prompt: z.string(),
    steps: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
    commonErrors: z.array(z.string()).optional(),
    transitions: z.array(z.object({ toPhaseName: NAME, conditions: z.string(), automaticTransition: z.boolean() }).strict()),
    enabledTools: TOOLS.optional(),
    enabledState: STATE.optional(),
  })
  .strict();
const CHALLENGE = z
  .object({
    name: NAME,
    shortDescription: z.string(),
    prompt: z.string(),
    openingLine: z.string().min(1).max(280),
    enabledTools: TOOLS,
    enabledState: STATE,
    phases: z.array(PHASE).min(1),
  })
  .strict();

const course = (id: string) => sampleCourses().find((c) => c.id === id)!;

const run = (pilot: string, total: number, extra: Partial<RunSummary> = {}): RunSummary => ({
  id: `${pilot}-${total}`,
  courseId: "daggett-sprint",
  courseRevision: "r",
  status: "finished",
  dnfReason: null,
  total,
  raw: total,
  penaltyTotal: 0,
  aircraftId: "Extra",
  classId: "aerobatic",
  source: "rpos",
  sourceHz: 30,
  pilot,
  startedAt: `2026-10-25T00:00:${String(Math.round(total)).padStart(2, "0")}Z`,
  ...extra,
});

describe("shirleyChallenge", () => {
  it("is a valid Shirley challenge for every included course", () => {
    for (const c of sampleCourses()) {
      const ch = shirleyChallenge(c, "Juan", []);
      expect(() => CHALLENGE.parse(ch), c.id).not.toThrow();
      // Shirley joins the two names and wants them under 51 characters.
      for (const p of ch.phases) expect(ch.name.length + 1 + p.name.length).toBeLessThanOrEqual(50);
      const names = new Set(ch.phases.map((p) => p.name));
      for (const p of ch.phases) for (const t of p.transitions) expect(names.has(t.toPhaseName)).toBe(true);
    }
  });

  it("gives Shirley the gates in race order, as waypoints with what each asks for", () => {
    const c = course("kdag-rules-test");
    const wps = shirleyChallenge(c, "Juan", []).enabledState.navigateToStateWaypoints!;
    expect(wps).toHaveLength(c.gates.length);
    expect(wps[0]).toMatchObject({ name: "Gate1_Start", latitudeDeg: c.gates[0]!.center.lat, longitudeDeg: c.gates[0]!.center.lon });
    expect(wps[wps.length - 1]!.name).toBe(`Gate${c.gates.length}_Finish`);
    const knife = c.gates.findIndex((g) => g.type === "knife");
    expect(wps[knife]!.context).toContain("Knife edge: 90° of bank");
  });

  it("says how a multi-lap race ends: on the start line", () => {
    const c = course("stead-pylon-oval");
    expect(c.laps).toBeGreaterThan(1);
    const ch = shirleyChallenge(c, "Juan", []);
    expect(ch.prompt).toContain(`the race ends there after lap ${c.laps}`);
    expect(ch.phases[1]!.transitions[0]!.conditions).toContain(`end of lap ${c.laps}`);
  });

  it("names the side of a turn pylon to fly by", () => {
    const c = makeCourse([
      { type: "start", x: 0, y: -500, heading: 0 },
      { type: "turn", x: 0, y: 0, heading: 0, turnSide: "left" },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ]);
    const ch = shirleyChallenge(c, "Juan", []);
    expect(ch.prompt).toContain("Pass to its right (keep it on your left)");
    expect(ch.prompt).toContain("Turn pylon passed on the wrong side");
  });

  it("lists only the penalties the course can give", () => {
    const plain = shirleyChallenge(straightCourse(), "Juan", []).prompt;
    expect(plain).toContain("Missed gate (not flown between its pylons): +10 s");
    expect(plain).not.toContain("Wrong attitude");
    expect(plain).not.toContain("maximum height");
    const dnf = shirleyChallenge(straightCourse({ rules: { missedGateIsDnf: true } }), "Juan", []).prompt;
    expect(dnf).toContain("A missed gate ends the run (DNF)");
  });

  it("widens the pylon-hit distance with tall pylons", () => {
    const standard = shirleyChallenge(straightCourse(), "Juan", []).prompt;
    const tall = shirleyChallenge(straightCourse({ rules: { pylonSize: "tall" } }), "Juan", []).prompt;
    expect(standard).toContain("within about 16 ft (5 m)");
    expect(tall).toContain("within about 20 ft (6 m)");
    expect(tall).toContain("Tall pylons");
  });

  // Flown 2026-10-25 at KDAG: Shirley read 60 ft AGL against "30 m" pylons as over the tops, and called
  // gates missed that the app counted.
  it("gives heights in feet first, and never makes a rule of flying under the pylon tops", () => {
    const sprint = shirleyChallenge(straightCourse({ rules: { pylonSize: "tall" } }), "Juan", []).prompt;
    expect(sprint).toContain("98 ft (30 m) tall");
    expect(sprint).toContain("every gate counts at any height, over the pylon tops included");
    const limited = shirleyChallenge(course("kdag-rules-test"), "Juan", []).prompt;
    expect(limited).toContain("Below 131 ft (40 m) above the ground.");
    expect(limited).toContain("Height only matters at a gate with a height limit.");
  });

  it("explains how the app writes a time", () => {
    expect(shirleyChallenge(straightCourse(), "Juan", []).prompt).toContain("01:00.79 is one minute and 0.79 seconds");
  });

  it("quotes the time to beat, or says there is none", () => {
    const records: ShirleyRecord[] = [{ classLabel: "Aerobatic", leader: "Alex", leaderS: 28.5, pilotBestS: 29.02 }];
    const ch = shirleyChallenge(course("daggett-sprint"), "Juan", records);
    expect(ch.prompt).toContain("- Aerobatic: 28.50 s by Alex; the pilot's best: 29.02 s.");
    expect(ch.phases[0]!.steps!.join(" ")).toContain("28.50 s by Alex in Aerobatic, the pilot's best 29.02 s");
    expect(shirleyChallenge(course("daggett-sprint"), "Juan", []).prompt).toContain("The first clean run sets the record.");
  });

  it("keeps away the tools that move the aircraft", () => {
    const ch = shirleyChallenge(course("daggett-sprint"), "Juan", []);
    expect(ch.enabledTools).toMatchObject({ setPosition: false, resetFlight: false, setSimulatorSetpoints: false });
  });

  it("falls back to a shorter opening line for a very long course name", () => {
    const c = straightCourse({ name: "A".repeat(300) });
    const ch = shirleyChallenge(c, "Juan", []);
    expect(ch.openingLine.startsWith("Welcome to the race!")).toBe(true);
    expect(() => CHALLENGE.parse(ch)).not.toThrow();
  });
});

describe("challengeName", () => {
  it("is the course name in UpperCamelCase", () => {
    expect(challengeName("Daggett Sprint")).toBe("DaggettSprint");
    expect(challengeName("queenstown lake-race 01")).toBe("QueenstownLakeRace01");
    expect(challengeName("Río Ñuble")).toBe("RioNuble");
  });

  it("is never empty nor too long", () => {
    expect(challengeName("東京")).toBe("PylonRace");
    expect(challengeName("word ".repeat(30)).length).toBe(MAX_CHALLENGE_NAME);
  });
});

describe("courseRecords", () => {
  it("gives each class its leader and the pilot's own best", () => {
    const runs = [run("Juan", 29.02), run("Juan", 31), run("Alex", 28.5), run("Juan", 40, { classId: "ga", aircraftId: "C172" })];
    expect(courseRecords(runs, "Juan")).toEqual([
      { classLabel: "Aerobatic", leader: "Alex", leaderS: 28.5, pilotBestS: 29.02 },
      { classLabel: "General aviation", leader: "Juan", leaderS: 40, pilotBestS: 40 },
    ]);
  });

  it("leaves out DNFs and demo flights", () => {
    const runs = [run("Juan", 20, { status: "dnf", dnfReason: "reset" }), run("Juan", 10, { source: "demo" })];
    expect(courseRecords(runs, "Juan")).toEqual([]);
  });
});

describe("files and times", () => {
  it("names the file after the course", () => {
    expect(shirleyFileName({ name: "Daggett Sprint" })).toBe("Daggett Sprint - Shirley.json");
    expect(shirleyFileName({ name: "a/b:c" })).toBe("a b c - Shirley.json");
  });

  it("says times as a commentator would", () => {
    expect(raceTime(29.02)).toBe("29.02 s");
    expect(raceTime(164.71)).toBe("2:44.71");
    expect(raceTime(60)).toBe("1:00.00");
  });
});
