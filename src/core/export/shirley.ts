// A course as a FlyShirley challenge: Shirley (airplane.team), the AI copilot, becomes the race's
// commentator. The pilot pastes the JSON into Shirley's Challenge Creator (airplane.team/fly/create)
// and flies; Shirley reads X-Plane on her own connection and talks over the run.
//
// Format: Airplane-Team's ChallengeSchema (github.com/Airplane-Team/sample-challenges, and the
// "Challenge Specification" tab of airplane.team/capabilities/specifications, read 2026-10-25). Only
// the fields used here are typed. Shirley never sees this app's clock or penalties, so the prompt
// makes the app the judge and Shirley the voice: she calls what she sees in the flight data and
// leaves the official result to XP Pylon Racer.
//
// Each gate also gets a wake-up trigger ("wakeupTriggers", types/tracked_wakeup_property.ts, read on
// frontend-stage.airplane.team 2026-10-30): its call is spoken the instant the pilot reaches it.
// Flown 2026-10-27, Shirley set these herself when asked and called every gate on time.
import { courseRevision, raceSequence, type Course, type Gate, type GateType } from "../course/course";
import { haversine } from "../geo/geo";
import { leaderboard, classesOf } from "../ranking/ranking";
import { classLabel } from "../ranking/classes";
import { lapLength } from "../run/summaries";
import type { RunSummary } from "../../shared/racerApi";
import { pylonFor, pylonHitRadiusFor, sizedPylon } from "./pylons";

/** The phases are "Brief", the race ("Race", or "Race1"… on a multi-lap course: raceSegments) and
 *  "Debrief". Shirley adds a phase's name to the challenge's, and the pair must stay under 51
 *  characters. "Brief" and "Debrief" also bring every phase's goals and common errors with them. */
const LONGEST_PHASE_NAME = "Debrief".length;

/** Longest challenge name: 50 characters with the longest phase name and a separator. */
export const MAX_CHALLENGE_NAME = 50 - LONGEST_PHASE_NAME - 1;
const MAX_OPENING_LINE = 280;
/** Shirley's limit on one list of waypoints (`kMaxSynchronizedWaypointCount`). */
const MAX_WAYPOINTS = 50;

/** Seconds of silence before Shirley speaks up during the run: often enough to sound live, with room
 *  for her answer to arrive (she is not instant). */
export const RACE_QUIET_S = 6;
/** On the way to the start the pilot may be taxiing or climbing for minutes. */
const BRIEF_QUIET_S = 60;
/** The brief wakes Shirley this far from the start gate, so she moves to the race in time. */
const BRIEF_WAKE_NM = 1;
/** A gate's trigger fires this far outside its half-width: room for a pass off the centerline, and
 *  about a second early at C172 speed. Shirley's own pick at Daggett (100 m gates) was 0.04 NM. */
const GATE_TRIGGER_MARGIN_M = 20;
const M_PER_NM = 1852;

export interface ShirleyWaypoint {
  latitudeDeg: number;
  longitudeDeg: number;
  name: string;
  context: string;
}

export interface ShirleyState {
  navigateToUserWaypoint?: boolean;
  distanceFromUserWaypoint?: boolean;
  navigateToStateWaypoints?: ShirleyWaypoint[];
  recordFlightData?: boolean;
  challengeTimer?: boolean;
  wakeUpAfterQuietPeriodSeconds?: number | null;
  assistantModeEnabled?: boolean;
}

/** A one-shot wake-up: fires when the distance to its point drops through `value` (NM), saying
 *  `cannedText` at once, ahead of Shirley's own reply. */
export interface ShirleyWakeupTarget {
  value: number;
  label?: string;
  cannedText?: string;
}

export interface ShirleyWakeupTriggers {
  /** Keyed by "lat,lon" with exactly six decimals. A phase's triggers are removed when it ends. */
  distanceTargets?: Record<string, ShirleyWakeupTarget[]>;
}

export interface ShirleyPhase {
  name: string;
  shortDescription: string;
  prompt: string;
  steps?: string[];
  goals?: string[];
  commonErrors?: string[];
  transitions: { toPhaseName: string; conditions: string; automaticTransition: boolean }[];
  enabledTools?: Record<string, boolean>;
  enabledState?: ShirleyState;
  wakeupTriggers?: ShirleyWakeupTriggers;
}

export interface ShirleyChallenge {
  name: string;
  shortDescription: string;
  prompt: string;
  openingLine: string;
  enabledTools: Record<string, boolean>;
  enabledState: ShirleyState;
  phases: ShirleyPhase[];
}

/** The best finished run of a class on this course revision, and the pilot's own. */
export interface ShirleyRecord {
  classLabel: string;
  leader: string;
  leaderS: number;
  /** The pilot's best in the class; null if they have not finished a run in it. */
  pilotBestS: number | null;
}

/** The records Shirley quotes: one per class with a finished run, from runs of the course's current
 *  revision (demo flights never count). */
export function courseRecords(runs: readonly RunSummary[], pilot: string): ShirleyRecord[] {
  return classesOf(runs).flatMap((cls) => {
    const board = leaderboard(runs, cls);
    const top = board[0];
    if (!top) return [];
    const mine = board.find((r) => r.pilot === pilot);
    return [{ classLabel: classLabel(cls), leader: top.pilot, leaderS: top.total, pilotBestS: mine ? mine.total : null }];
  });
}

/** The file's text: the course's challenge, with the records of its current revision from all the
 *  runs on this computer. */
export function shirleyFile(course: Course, pilot: string, runs: readonly RunSummary[]): string {
  const revision = courseRevision(course);
  const mine = runs.filter((r) => r.courseId === course.id && r.courseRevision === revision);
  return JSON.stringify(shirleyChallenge(course, pilot, courseRecords(mine, pilot)), null, 2) + "\n";
}

/** The challenge's name: the course name in UpperCamelCase, letters and digits only. */
export function challengeName(courseName: string): string {
  const words = courseName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const camel = words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join("");
  return camel.slice(0, MAX_CHALLENGE_NAME) || "PylonRace";
}

/** A file name for the challenge: "Daggett Sprint - Shirley.json". */
export function shirleyFileName(course: Pick<Course, "name">): string {
  const safe = course.name
    .replace(/[^\p{L}\p{N} ._()'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60)
    .trim();
  return `${safe || "course"} - Shirley.json`;
}

export function shirleyChallenge(course: Course, pilot: string, records: readonly ShirleyRecord[]): ShirleyChallenge {
  const lap = raceSequence({ gates: course.gates, laps: 1 });
  const types = new Set(course.gates.map((g) => g.type));
  const toBeat = timeToBeat(records, pilot);
  const race = racePhases(course, types, toBeat);
  const start = course.gates[0]!;

  return {
    name: challengeName(course.name),
    shortDescription: `Pylon race "${course.name}": ${gateCount(course)}${lapsText(course)}, ${km(lapLength(course) * course.laps)}. Shirley calls the race live.`,
    prompt: [
      broadcasterRole(pilot),
      judgeText(),
      courseText(course, lap),
      rulesText(course, types),
      recordsText(records),
      callingText(),
    ].join("\n\n"),
    openingLine: openingLine(course),
    // Nothing that moves the aircraft or changes the sim: a reposition mid-run ends it (DNF).
    enabledTools: {
      setPosition: false,
      resetFlight: false,
      setSimulatorSetpoints: false,
      setDestinationRunway: false,
    },
    enabledState: {
      navigateToUserWaypoint: false,
      distanceFromUserWaypoint: false,
      navigateToStateWaypoints: lap.slice(0, MAX_WAYPOINTS).map((i) => waypoint(course, i)),
      assistantModeEnabled: false,
    },
    phases: [
      {
        name: "Brief",
        shortDescription: "Course preview while the pilot gets to the start",
        prompt:
          "Before the run, preview the course like a broadcaster: where the start is and which way to fly through it, how many gates and laps, the gates that ask for something special, and the time to beat. Keep it under a minute; the pilot may be taking off or flying to the start. On a second or later run skip the full preview: the time to beat, one thing to fly better, and good luck.",
        steps: [
          "Preview the course: the start, the gates in order, the special gates and the laps.",
          toBeat ? `Tell the pilot the time to beat: ${toBeat}.` : "Tell the pilot there is no time to beat yet: this run can set the record.",
          "Remind the pilot that XP Pylon Racer has to be open on this course: it starts the clock at the start gate and scores the run.",
        ],
        transitions: [
          {
            toPhaseName: race[0]!.name,
            automaticTransition: true,
            conditions: `The pilot is airborne and lined up for the start gate (within about 2 NM of it; you are woken ${BRIEF_WAKE_NM} NM out), or says the run is starting.`,
          },
        ],
        enabledState: { wakeUpAfterQuietPeriodSeconds: BRIEF_QUIET_S },
        wakeupTriggers: { distanceTargets: { [coordinateKey(start)]: [{ value: BRIEF_WAKE_NM, label: "Approaching the start gate" }] } },
      },
      ...race,
      {
        name: "Debrief",
        shortDescription: "Post-race verdict",
        prompt:
          "Wrap up like the end of a broadcast. Ask the pilot for the official time and penalties XP Pylon Racer shows, then give your verdict on the run with real opinions: the best moment, the worst, and where the time went. The recorded flight data can back it up.",
        steps: [
          "Ask for the official time and penalties shown in XP Pylon Racer.",
          "Compare the time with the records.",
          "Give your verdict: the best moment, the costliest mistake, and one thing to fly better next time.",
          "Offer another run.",
        ],
        transitions: [{ toPhaseName: "Brief", automaticTransition: false, conditions: "The pilot wants another run." }],
        enabledTools: { analyzeFlightData: true },
        enabledState: { wakeUpAfterQuietPeriodSeconds: null },
      },
    ],
  };
}

/** The race as phases of positions in `raceSequence(course)`. A trigger fires once and a phase can
 *  arm a gate only once, so a multi-lap race needs a phase per lap. Each one hands over at the gate
 *  before the longest leg, the most time for Shirley to switch before the next gate comes up. */
export function raceSegments(course: Pick<Course, "gates" | "laps">): number[][] {
  const seq = raceSequence(course);
  if (course.laps === 1) return [seq.map((_, at) => at)];
  const handoff = handoffGate(course.gates);
  const out: number[][] = [[]];
  seq.forEach((gate, at) => {
    out[out.length - 1]!.push(at);
    if (gate === handoff && at < seq.length - 1) out.push([]);
  });
  return out;
}

/** The gate whose leg to the next one is longest. Never a turn pylon: it has no trigger to wake
 *  Shirley for the handover (the start is always a candidate). */
function handoffGate(gates: readonly Gate[]): number {
  let best = 0;
  let bestM = -1;
  gates.forEach((g, i) => {
    if (g.type === "turn") return;
    const legM = haversine(g.center, gates[(i + 1) % gates.length]!.center);
    if (legM > bestM) [best, bestM] = [i, legM];
  });
  return best;
}

function racePhases(course: Course, types: ReadonlySet<GateType>, toBeat: string | null): ShirleyPhase[] {
  const seq = raceSequence(course);
  const segments = raceSegments(course);
  const name = (k: number): string => (segments.length === 1 ? "Race" : `Race${k + 1}`);
  const over = "the run is over: they say so, crash, land, or turn away from the course";
  const turns = types.has("turn");
  const calls = [
    `Every gate${turns ? " except the turn pylons" : ""} has a wake-up trigger: the instant the pilot reaches it, its call ("Gate 3!") is spoken for you. Never repeat that call; follow it with one quick comment on the pass or what comes next.`,
    turns ? "Turn pylons have no call: call them yourself from the distance to their waypoint." : null,
  ];

  return segments.map((positions, k) => {
    const first = positions[0]!;
    const end = positions[positions.length - 1]!;
    const last = k === segments.length - 1;
    const handover = last
      ? null
      : `This part of the race runs from ${stepText(course, seq, first)} to ${stepText(course, seq, end)}. When the call for ${stepText(course, seq, end)} is spoken, move to ${name(k + 1)} at once: it arms the gates that follow.`;
    return {
      name: name(k),
      shortDescription:
        segments.length === 1 ? "Live commentary of the run" : `Live commentary from ${stepText(course, seq, first)} to ${stepText(course, seq, end)}`,
      prompt: [
        "The run is on. Commentate live: the next gate and what it asks for, speed, height above the ground, bank and g, the line through the turns. Short punchy call-outs, never questions.",
        ...calls,
        handover,
        "Your challenge timer started before the start gate, so it is not the race time.",
      ]
        .filter(Boolean)
        .join(" "),
      goals: raceGoals(course, types, toBeat),
      commonErrors: commonErrors(course, types),
      transitions: last
        ? [
            {
              toPhaseName: "Debrief",
              automaticTransition: true,
              conditions: `The pilot has flown through ${course.laps > 1 ? `the start line at the end of lap ${course.laps}` : "the finish gate"}, or ${over}.`,
            },
          ]
        : [
            {
              toPhaseName: name(k + 1),
              automaticTransition: true,
              conditions: `The call for ${stepText(course, seq, end)} has been spoken: the pilot has flown through it.`,
            },
            { toPhaseName: "Debrief", automaticTransition: true, conditions: `${over[0]!.toUpperCase()}${over.slice(1)}.` },
          ],
      enabledState: { challengeTimer: true, recordFlightData: true, wakeUpAfterQuietPeriodSeconds: RACE_QUIET_S },
      wakeupTriggers: gateTriggers(course, seq, positions),
    };
  });
}

/** One trigger per gate of the phase, turn pylons left out: they are passed at a distance nobody
 *  knows, so a fixed radius would fire far too early or never. */
function gateTriggers(course: Course, seq: readonly number[], positions: readonly number[]): ShirleyWakeupTriggers {
  const distanceTargets: Record<string, ShirleyWakeupTarget[]> = {};
  for (const at of positions) {
    const g = course.gates[seq[at]!]!;
    if (g.type === "turn") continue;
    const value = Math.round(((g.widthM / 2 + GATE_TRIGGER_MARGIN_M) / M_PER_NM) * 1000) / 1000;
    distanceTargets[coordinateKey(g)] = [{ value, label: stepLabel(course, seq, at), cannedText: gateCall(course, seq, at) }];
  }
  return { distanceTargets };
}

/** Shirley's key for a point: "lat,lon" with exactly six decimals. */
function coordinateKey(g: Gate): string {
  return `${g.center.lat.toFixed(6)},${g.center.lon.toFixed(6)}`;
}

/** The lap a position of the race sequence belongs to; the start line closing a lap is its last step. */
function lapAt(course: Pick<Course, "gates">, at: number): number {
  return Math.max(1, Math.ceil(at / course.gates.length));
}

function stepLabel(course: Course, seq: readonly number[], at: number): string {
  const gate = seq[at]!;
  if (at === seq.length - 1) return "Finish";
  if (at === 0) return "Start gate";
  if (gate === 0) return `Lap ${lapAt(course, at)} done`;
  return course.laps > 1 ? `Gate ${gate + 1}, lap ${lapAt(course, at)}` : `Gate ${gate + 1}`;
}

/** A step in prose: "the start gate", "gate 4 of lap 2", "the start line closing lap 1". */
function stepText(course: Course, seq: readonly number[], at: number): string {
  const gate = seq[at]!;
  if (at === seq.length - 1) return course.laps > 1 ? "the finish on the start line" : "the finish gate";
  if (at === 0) return "the start gate";
  if (gate === 0) return `the start line closing lap ${lapAt(course, at)}`;
  return course.laps > 1 ? `gate ${gate + 1} of lap ${lapAt(course, at)}` : `gate ${gate + 1}`;
}

/** What Shirley says the instant the pilot reaches a gate, with what the next one asks for. */
function gateCall(course: Course, seq: readonly number[], at: number): string {
  const gate = seq[at]!;
  const last = at === seq.length - 1;
  const call = last ? "Finish!" : at === 0 ? "Start gate! Clock's running." : gate === 0 ? `Lap ${lapAt(course, at) + 1}!` : `Gate ${gate + 1}!`;
  const next = last ? null : nextUp(course.gates[seq[at + 1]!]!);
  return next ? `${call} ${next}` : call;
}

function nextUp(g: Gate): string | null {
  if (g.type === "knife") return "Knife edge next.";
  if (g.type === "inverted") return "Inverted next.";
  if (g.type === "level") return "Wings level next.";
  if (g.type === "turn") return `Pylon next, keep it on your ${g.turnSide ?? "left"}.`;
  return null;
}

function broadcasterRole(pilot: string): string {
  const who = pilot.trim() ? `The pilot is ${pilot.trim()}.` : "";
  return `You are the commentator of a pylon air race flown in X-Plane 12, in the style of a Red Bull Air Race broadcast: energetic, quick, with real opinions and some banter, and always accurate. ${who}`.trim();
}

function judgeText(): string {
  return [
    "XP Pylon Racer, an app running beside the sim, times and scores the race: it starts the clock at the start gate, decides which gates count and gives every penalty. You do not see its clock or its penalties. Never announce an official time or penalty as fact; call what the flight data shows and let the pilot read the result in XP Pylon Racer.",
    // Flown 2026-10-25: Shirley wrote "1:00.079" for an app showing 01:00.79.
    "XP Pylon Racer shows times as minutes:seconds.hundredths: 01:00.79 is one minute and 0.79 seconds, 00:41.93 is 41.93 seconds.",
  ].join(" ");
}

function courseText(course: Course, lap: readonly number[]): string {
  const head = [`THE COURSE: ${course.name}${course.author ? `, by ${course.author}` : ""}.`];
  if (course.description.trim()) head.push(course.description.trim());
  head.push(
    `${gateCount(course)}${lapsText(course)}, ${km(lapLength(course))} per lap.${course.rules.pylonSize === "tall" ? " Tall pylons (twice the usual size)." : ""}`,
  );
  const lines = lap.map((i) => `${i + 1}. ${gateLine(course, course.gates[i]!)}`);
  const close =
    course.laps > 1
      ? `After gate ${course.gates.length}, fly back through the start line: it closes every lap, and the race ends there after lap ${course.laps}.`
      : null;
  return [
    head.join(" "),
    "Gates in race order (also given to you as state waypoints, with the distance to each):",
    ...lines,
    ...(close ? [close] : []),
  ].join("\n");
}

function gateLine(course: Course, g: Gate): string {
  const model = sizedPylon(pylonFor(g), course.rules.pylonSize);
  const paint = PAINT[model.id] ?? "striped";
  const tall = `${height(model.heightM)} tall`;
  const parts =
    g.type === "turn"
      ? [`${TYPE_LABEL[g.type]}: one ${paint} pylon, ${tall}. Pass to its ${passSide(g)} (keep it on your ${g.turnSide ?? "left"}), flying about ${hdg(g.headingDeg)}.`]
      : [`${TYPE_LABEL[g.type]}: two ${paint} pylons ${Math.round(g.widthM)} m apart, ${tall}. Fly through on ${hdg(g.headingDeg)}.`];
  parts.push(...requirements(course, g));
  if (g.groundElevM !== null) parts.push(`Ground ${ft(g.groundElevM)} ft MSL.`);
  return parts.join(" ");
}

/** What a gate asks for beyond flying through it the right way, one sentence each. */
function requirements(course: Course, g: Gate): string[] {
  const r = course.rules;
  const out: string[] = [];
  if (g.type === "level") out.push(`Wings level, bank within ±${Math.round(r.levelToleranceDeg)}°.`);
  if (g.type === "knife") out.push(`Knife edge: 90° of bank, ±${Math.round(r.knifeToleranceDeg)}°.`);
  if (g.type === "inverted") out.push(`Upside down: 180° of bank, ±${Math.round(r.invertedToleranceDeg)}°.`);
  if (g.topM !== null && g.bottomM !== null) out.push(`Between ${height(g.bottomM)} and ${height(g.topM)} above the ground.`);
  else if (g.topM !== null) out.push(`Below ${height(g.topM)} above the ground.`);
  else if (g.bottomM !== null) out.push(`Above ${height(g.bottomM)} above the ground.`);
  return out;
}

function rulesText(course: Course, types: ReadonlySet<GateType>): string {
  const r = course.rules;
  const radius = Math.min(...course.gates.map((g) => pylonHitRadiusFor(g, r)));
  const lines = [
    "RULES. Penalties are added to the flying time:",
    r.missedGateIsDnf ? "- A missed gate ends the run (DNF)." : `- Missed gate (not flown between its pylons): +${s(r.missedGatePenaltyS)}.`,
    `- Gate flown the wrong way: +${s(r.wrongDirectionPenaltyS)}.`,
    `- Pylon hit: passing within about ${height(radius)} of a pylon's center, lower than the pylon's top: +${s(r.pylonHitPenaltyS)}.`,
  ];
  if (types.has("level") || types.has("knife") || types.has("inverted")) lines.push(`- Wrong attitude through a level, knife-edge or inverted gate: +${s(r.attitudePenaltyS)}.`);
  if (course.gates.some((g) => g.topM !== null)) lines.push(`- Above a gate's maximum height: +${s(r.tooHighPenaltyS)}.`);
  if (course.gates.some((g) => g.bottomM !== null)) lines.push(`- Below a gate's minimum height: +${s(r.tooLowPenaltyS)}.`);
  if (types.has("turn")) lines.push(`- Turn pylon passed on the wrong side: +${s(r.turnCutPenaltyS)}.`);
  // Flown 2026-10-25: from "below its top" Shirley made a rule of flying under the tops, and called
  // gates missed that the app counted.
  lines.push(
    course.gates.some((g) => g.topM !== null || g.bottomM !== null)
      ? "Height only matters at a gate with a height limit. Any other gate counts at any height, over the pylon tops included: never call it missed for its height."
      : "No gate has a height limit: every gate counts at any height, over the pylon tops included. Never call a gate missed for its height. Flying low between the pylons is the show, not a rule.",
  );
  lines.push("Your altitude data is in feet: compare it with the heights in feet given here.");
  lines.push("Times are compared within an aircraft class only.");
  return lines.join("\n");
}

function recordsText(records: readonly ShirleyRecord[]): string {
  if (records.length === 0) return "RECORDS: no finished runs on this course yet. The first clean run sets the record.";
  const lines = records.map((r) => {
    const own =
      r.pilotBestS === null ? "" : r.pilotBestS === r.leaderS ? " (the pilot's own)" : `; the pilot's best: ${raceTime(r.pilotBestS)}`;
    return `- ${r.classLabel}: ${raceTime(r.leaderS)} by ${r.leader}${own}.`;
  });
  return ["RECORDS on this course (from the pilot's computer, by aircraft class):", ...lines].join("\n");
}

function callingText(): string {
  return [
    "HOW TO CALL IT:",
    "- During the run: one short sentence at a time. The pilot is low and fast; never ask questions.",
    "- Call the next gate before it comes, and what it asks for (knife edge, wings level, the side of a turn pylon, a height limit).",
    "- Use the flight data: speed, height above the ground, bank, g, distance to the next gate. Opinions are welcome: a tight line, speed bled in a turn, a risky height.",
    "- Celebrate the clean gates and groan at the mistakes, like a fan who knows the sport.",
  ].join("\n");
}

function openingLine(course: Course): string {
  const tail = `${gateCount(course)}${lapsText(course)} and a clock waiting. I'll be calling your run. Get to the start and let's race!`;
  const line = `Welcome to the ${course.name}! ${tail}`;
  return line.length <= MAX_OPENING_LINE ? line : `Welcome to the race! ${tail}`;
}

function raceGoals(course: Course, types: ReadonlySet<GateType>, toBeat: string | null): string[] {
  const goals = ["Fly every gate in order, the right way, without touching a pylon."];
  if (types.has("level") || types.has("knife") || types.has("inverted")) goals.push("Hold the attitude each special gate asks for right through it.");
  if (course.gates.some((g) => g.topM !== null || g.bottomM !== null)) goals.push("Stay inside every height limit.");
  goals.push(toBeat ? `Beat ${toBeat}.` : "Set the first record on this course.");
  return goals;
}

function commonErrors(course: Course, types: ReadonlySet<GateType>): string[] {
  const out = [
    "Going wide out of a turn and missing the next gate, or crossing it at an angle.",
    "Pulling too hard in the turns and bleeding speed.",
    "Passing too close to a pylon.",
  ];
  if (types.has("level")) out.push("Still banked through a level gate.");
  if (types.has("knife") || types.has("inverted")) out.push("Rolling out of the knife edge or the inverted pass too early.");
  if (course.gates.some((g) => g.topM !== null)) out.push("Climbing over a gate's height limit.");
  if (types.has("turn")) out.push("Passing a turn pylon on the wrong side.");
  return out;
}

function timeToBeat(records: readonly ShirleyRecord[], pilot: string): string | null {
  if (records.length === 0) return null;
  return records
    .map((r) => {
      const own = r.pilotBestS !== null && r.pilotBestS !== r.leaderS ? `, the pilot's best ${raceTime(r.pilotBestS)}` : "";
      return `${raceTime(r.leaderS)} by ${r.leader === pilot ? "the pilot" : r.leader} in ${r.classLabel}${own}`;
    })
    .join("; ");
}

function waypoint(course: Course, i: number): ShirleyWaypoint {
  const g = course.gates[i]!;
  return {
    latitudeDeg: g.center.lat,
    longitudeDeg: g.center.lon,
    name: `Gate${i + 1}_${WAYPOINT_TYPE[g.type]}`,
    context: gateLine(course, g),
  };
}

const TYPE_LABEL: Record<GateType, string> = {
  start: "Start gate",
  finish: "Finish gate",
  gate: "Gate",
  level: "Level gate",
  knife: "Knife-edge gate",
  inverted: "Inverted gate",
  turn: "Turn pylon",
};

const WAYPOINT_TYPE: Record<GateType, string> = {
  start: "Start",
  finish: "Finish",
  gate: "Gate",
  level: "Level",
  knife: "KnifeEdge",
  inverted: "Inverted",
  turn: "Turn",
};

/** How each model is painted, in words (export/pylons.ts): color bands with white between. */
const PAINT: Readonly<Record<string, string>> = {
  red: "red-and-white",
  green: "green-and-white",
  blue: "blue-and-white",
  home: "amber-and-white",
  home2: "yellow-and-white",
  rgb: "red-green-and-blue striped",
  rb: "red-and-blue striped",
  "rodeo-reno": "orange-and-white",
  "rodeo-18": "cyan-and-white",
  "rodeo-25": "teal-and-white",
};

/** The side to fly by: keeping the pylon on your left means passing to its right. */
function passSide(g: Gate): "left" | "right" {
  return (g.turnSide ?? "left") === "left" ? "right" : "left";
}

const FT_PER_M = 3.28084;
const ft = (m: number): number => Math.round(m * FT_PER_M);
/** Feet first: Shirley reads altitudes in feet (flown 2026-10-25: 60 ft against "30 m" read as over). */
const height = (m: number): string => `${ft(m)} ft (${Math.round(m)} m)`;
const hdg = (deg: number): string => `heading ${String(Math.round(((deg % 360) + 360) % 360)).padStart(3, "0")}° true`;
const s = (v: number): string => `${Number.isInteger(v) ? v : v.toFixed(1)} s`;
const km = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const gateCount = (c: Course): string => `${c.gates.length} gates`;
const lapsText = (c: Course): string => (c.laps > 1 ? `, ${c.laps} laps` : "");

/** Race time as Shirley should say it: "29.02 s", or "2:44.71" past a minute. */
export function raceTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  if (cs < 6000) return `${(cs / 100).toFixed(2)} s`;
  const m = Math.floor(cs / 6000);
  return `${m}:${((cs % 6000) / 100).toFixed(2).padStart(5, "0")}`;
}
