// Course rankings: within one course revision, runs only compare within an aircraft class. Pure,
// shared by the renderer and tests. `null` is the "Unclassified" bucket (UDP with no class chosen,
// aircraft the app does not know). Demo flights are kept with the pilot's runs but never rank: the
// synthetic aircraft would set times nobody flew.
import type { RunSummary } from "../../shared/racerApi";
import { rankRuns } from "../run/summaries";
import { AIRCRAFT_CLASSES, isClassId, type AircraftClassId } from "./classes";

export type ClassKey = AircraftClassId | null;

/** The bucket a run is ranked in (a class id from an older or newer version counts as unclassified). */
export function classKey(r: Pick<RunSummary, "classId">): ClassKey {
  return isClassId(r.classId) ? r.classId : null;
}

/** The classes these runs were flown in, in the catalog's order, unclassified last. */
export function classesOf(runs: readonly RunSummary[]): ClassKey[] {
  const seen = new Set(runs.map(classKey));
  const keys: ClassKey[] = AIRCRAFT_CLASSES.map((c) => c.id).filter((id) => seen.has(id));
  return seen.has(null) ? [...keys, null] : keys;
}

/** One row per pilot: their best finished run in the class, fastest first (a tie goes to whoever
 *  flew it first). */
export function leaderboard(runs: readonly RunSummary[], cls: ClassKey): RunSummary[] {
  const best = new Map<string, RunSummary>();
  for (const r of runs) {
    if (r.status !== "finished" || isDemo(r) || classKey(r) !== cls) continue;
    const b = best.get(r.pilot);
    if (!b || r.total < b.total || (r.total === b.total && r.startedAt < b.startedAt)) best.set(r.pilot, r);
  }
  return [...best.values()].sort((a, b) => a.total - b.total || a.startedAt.localeCompare(b.startedAt));
}

export function isDemo(r: Pick<RunSummary, "source">): boolean {
  return r.source === "demo";
}

/** A pilot's runs in the class, DNFs included: finished by total, then DNFs newest first, then the
 *  demo flights newest first. */
export function pilotRuns(runs: readonly RunSummary[], pilot: string, cls: ClassKey): RunSummary[] {
  const mine = runs.filter((r) => r.pilot === pilot && classKey(r) === cls);
  const demos = mine.filter(isDemo).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return [...rankRuns(mine.filter((r) => !isDemo(r))), ...demos];
}

/** A pilot's best finished run in the class, or null. */
export function pilotBest(runs: readonly RunSummary[], pilot: string, cls: ClassKey): RunSummary | null {
  return leaderboard(runs, cls).find((r) => r.pilot === pilot) ?? null;
}

/** The class to rank and race in: the one flying now if known (`undefined` = no telemetry yet),
 *  else the class of the pilot's latest real run, else of their latest demo (so a new pilot sees the
 *  demo they just watched), else unclassified. */
export function currentClass(runs: readonly RunSummary[], pilot: string, flying: ClassKey | undefined): ClassKey {
  if (flying !== undefined) return flying;
  const latestOf = (rs: RunSummary[]): RunSummary | null => rs.reduce<RunSummary | null>((a, r) => (!a || r.startedAt > a.startedAt ? r : a), null);
  const mine = runs.filter((r) => r.pilot === pilot);
  const latest = latestOf(mine.filter((r) => !isDemo(r))) ?? latestOf(mine);
  return latest ? classKey(latest) : null;
}
