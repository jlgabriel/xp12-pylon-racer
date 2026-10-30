import { describe, expect, it } from "vitest";
import { z } from "zod";
import { raceSequence } from "../src/core/course/course";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import {
  challengeName,
  courseRecords,
  MAX_CHALLENGE_NAME,
  raceSegments,
  raceTime,
  shirleyChallenge,
  shirleyFileName,
  type ShirleyRecord,
} from "../src/core/export/shirley";
import type { RunSummary } from "../src/shared/racerApi";
import { makeCourse, straightCourse } from "./helpers";

// Airplane-Team's ChallengeSchema (challenge_schema.ts and waypoint.ts, read 2026-10-25; the wake-up
// triggers from tracked_wakeup_property.ts and coordinate_types.ts, read on stage 2026-10-30), cut
// down to the fields the export writes. Strict where Shirley only warns, so a misspelled key fails here.
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
const TARGET = z
  .object({ value: z.number().positive(), label: z.string().min(1).optional(), cannedText: z.string().min(1).max(280).optional() })
  .strict();
const TRIGGERS = z
  .object({ distanceTargets: z.record(z.string().regex(/^-?\d+\.\d{6},-?\d+\.\d{6}$/), z.array(TARGET).nullable().optional()).optional() })
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
    wakeupTriggers: TRIGGERS.optional(),
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
    const lastRace = ch.phases[ch.phases.length - 2]!;
    expect(lastRace.transitions[0]!.conditions).toContain(`end of lap ${c.laps}`);
  });

  // Flown 2026-10-27 at KDAG: Shirley set distance triggers when asked and called every gate on time.
  it("calls every gate the instant the pilot reaches it", () => {
    const c = course("daggett-sprint");
    const ch = shirleyChallenge(c, "Juan", []);
    expect(ch.phases.map((p) => p.name)).toEqual(["Brief", "Race", "Debrief"]);
    const targets = ch.phases[1]!.wakeupTriggers!.distanceTargets!;
    const start = c.gates[0]!;
    expect(Object.keys(targets)).toHaveLength(c.gates.length);
    expect(targets[`${start.center.lat.toFixed(6)},${start.center.lon.toFixed(6)}`]).toEqual([
      { value: 0.038, label: "Start gate", cannedText: "Start gate! Clock's running." },
    ]);
    expect(Object.values(targets).map((t) => t![0]!.cannedText)).toEqual([
      "Start gate! Clock's running.",
      "Gate 2!",
      "Gate 3!",
      "Gate 4!",
      "Finish!",
    ]);
  });

  it("wakes Shirley a mile out so she starts the race in time", () => {
    const c = course("daggett-sprint");
    const brief = shirleyChallenge(c, "Juan", []).phases[0]!;
    const key = `${c.gates[0]!.center.lat.toFixed(6)},${c.gates[0]!.center.lon.toFixed(6)}`;
    expect(brief.wakeupTriggers!.distanceTargets![key]).toEqual([{ value: 1, label: "Approaching the start gate" }]);
  });

  it("leaves turn pylons without a trigger and says what the next gate asks for", () => {
    const c = makeCourse([
      { type: "start", x: 0, y: -1000, heading: 0, width: 100 },
      { type: "gate", x: 0, y: -500, heading: 0 },
      { type: "knife", x: 0, y: 0, heading: 0 },
      { type: "turn", x: 0, y: 500, heading: 0, turnSide: "right" },
      { type: "finish", x: 0, y: 1000, heading: 0 },
    ]);
    const race = shirleyChallenge(c, "Juan", []).phases[1]!;
    const calls = Object.values(race.wakeupTriggers!.distanceTargets!).map((t) => t![0]!.cannedText);
    expect(calls).toEqual(["Start gate! Clock's running.", "Gate 2! Knife edge next.", "Gate 3! Pylon next, keep it on your right.", "Finish!"]);
    expect(race.prompt).toContain("Turn pylons have no call");
  });

  it("splits a multi-lap race into phases that hand over before the longest leg", () => {
    // Legs: start→g2 200 m, g2→g3 1300 m (the longest), g3→g4 283 m, g4→start 1100 m.
    const c = makeCourse(
      [
        { type: "start", x: 0, y: 0, heading: 0 },
        { type: "gate", x: 0, y: 200, heading: 90 },
        { type: "gate", x: 1300, y: 200, heading: 135 },
        { type: "gate", x: 1100, y: 0, heading: 270 },
      ],
      { laps: 2 },
    );
    expect(raceSegments(c)).toEqual([
      [0, 1],
      [2, 3, 4, 5],
      [6, 7, 8],
    ]);
    const ch = shirleyChallenge(c, "Juan", []);
    expect(ch.phases.map((p) => p.name)).toEqual(["Brief", "Race1", "Race2", "Race3", "Debrief"]);
    expect(ch.phases[0]!.transitions[0]!.toPhaseName).toBe("Race1");
    expect(ch.phases[1]!.transitions[0]).toMatchObject({ toPhaseName: "Race2", automaticTransition: true });
    expect(ch.phases[1]!.transitions[0]!.conditions).toContain("gate 2 of lap 1");
    const calls = (i: number) => Object.values(ch.phases[i]!.wakeupTriggers!.distanceTargets!).map((t) => t![0]!.cannedText);
    expect(calls(1)).toEqual(["Start gate! Clock's running.", "Gate 2!"]);
    expect(calls(2)).toEqual(["Gate 3!", "Gate 4!", "Lap 2!", "Gate 2!"]);
    expect(calls(3)).toEqual(["Gate 3!", "Gate 4!", "Finish!"]);
  });

  it("never hands over at a turn pylon, and arms each gate once per phase on every course", () => {
    for (const c of sampleCourses()) {
      const segments = raceSegments(c);
      expect(segments.flat(), c.id).toEqual(raceSequence(c).map((_, at) => at));
      for (const s of segments.slice(0, -1)) expect(c.gates[raceSequence(c)[s[s.length - 1]!]!]!.type, c.id).not.toBe("turn");
      for (const p of shirleyChallenge(c, "Juan", []).phases.filter((p) => p.name.startsWith("Race"))) {
        const gates = raceSegments(c)[p.name === "Race" ? 0 : Number(p.name.slice(4)) - 1]!.map((at) => c.gates[raceSequence(c)[at]!]!);
        expect(Object.keys(p.wakeupTriggers!.distanceTargets!), c.id).toHaveLength(gates.filter((g) => g.type !== "turn").length);
      }
    }
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
