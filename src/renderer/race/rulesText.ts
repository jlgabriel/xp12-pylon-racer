// The words for the rules: what a gate asks of the pilot, and why a penalty was given.
import type { Course, Gate } from "../../core/course/course";
import type { DnfReason, Penalty, RaceSnapshot } from "../../core/race/engine";

/** The side of a turn pylon to fly by: keeping it on your left means passing to its right. "Pass to
 *  its right" says what to DO; "keep it on your left" had to be translated in the air (flight test,
 *  2026-10-19). */
export function passSide(g: Gate): "left" | "right" {
  return (g.turnSide ?? "left") === "left" ? "right" : "left";
}

const deg = (v: number): string => `${Math.round(v)}°`;
const m = (v: number): string => `${Math.round(v)} m`;

/** What passing this gate requires, beyond flying through it the right way. Empty = nothing more. */
export function gateRequirements(g: Gate, course: Course): string[] {
  const r = course.rules;
  const out: string[] = [];
  if (g.type === "level") out.push(`wings level, ±${deg(r.levelToleranceDeg)}`);
  if (g.type === "knife") out.push(`knife edge, 90° ±${deg(r.knifeToleranceDeg)}`);
  if (g.type === "inverted") out.push(`upside down, 180° ±${deg(r.invertedToleranceDeg)}`);
  if (g.type === "turn") out.push(`pass to the ${passSide(g)} of the pylon`);
  if (g.topM !== null && g.bottomM !== null) out.push(`between ${m(g.bottomM)} and ${m(g.topM)} high`);
  else if (g.topM !== null) out.push(`below ${m(g.topM)}`);
  else if (g.bottomM !== null) out.push(`above ${m(g.bottomM)}`);
  return out;
}

/** Why a penalty was given, with what was measured. */
export function penaltyReason(p: Penalty, course: Course): string {
  const g = course.gates[p.gateIndex];
  const r = course.rules;
  switch (p.kind) {
    case "missed-gate":
      return "missed";
    case "wrong-direction":
      return "flown the wrong way";
    case "attitude":
      if (g?.type === "knife") return `not knife edge: bank ${measured(p, deg)} (needs 90° ±${deg(r.knifeToleranceDeg)})`;
      if (g?.type === "inverted") return `not upside down: bank ${measured(p, deg)} (needs 180° ±${deg(r.invertedToleranceDeg)})`;
      return `wings not level: bank ${measured(p, deg)} (max ±${deg(r.levelToleranceDeg)})`;
    case "too-high":
      return `too high: ${measured(p, m)}${g?.topM != null ? ` (max ${m(g.topM)})` : ""}`;
    case "too-low":
      return `too low: ${measured(p, m)}${g?.bottomM != null ? ` (min ${m(g.bottomM)})` : ""}`;
    case "pylon-hit":
      return `pylon hit: ${p.measured !== null ? `${p.measured.toFixed(1)} m` : "?"} from its center`;
    case "turn-cut":
      if (!g) return "turn pylon cut";
      return `turn pylon cut: passed to its ${passSide(g) === "right" ? "left" : "right"} (pass to its ${passSide(g)})`;
  }
}

/** Why the race did not finish, for the result: "reset in the sim after gate 2". Null when unknown. */
export function dnfText(race: Pick<RaceSnapshot, "dnfReason" | "passes" | "sequence" | "step">): string | null {
  switch (race.dnfReason) {
    case "reset": {
      const last = race.passes[race.passes.length - 1];
      return last ? `reset in the sim after gate ${last.gateIndex + 1}` : "reset in the sim";
    }
    case "stopped": {
      const last = race.passes[race.passes.length - 1];
      return last ? `crashed or paused after gate ${last.gateIndex + 1}` : "crashed or paused";
    }
    case "missed-gate": {
      const gi = race.sequence[race.step];
      return gi !== undefined ? `missed gate ${gi + 1}` : "missed a gate";
    }
    case null:
      return null;
  }
}

/** The same, in a word or two, for the list of runs. */
export function dnfShort(reason: DnfReason | null): string | null {
  switch (reason) {
    case "reset":
      return "reset in the sim";
    case "stopped":
      return "crashed or paused";
    case "missed-gate":
      return "missed a gate";
    case null:
      return null;
  }
}

function measured(p: Penalty, fmt: (v: number) => string): string {
  return p.measured !== null ? fmt(p.measured) : "?";
}
