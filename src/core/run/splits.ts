// Splits: the race cut at every gate passed, each piece against the same piece of a reference run
// (your best), so the result says where time was won or lost. Penalties count in the sector they
// were earned in (as in the live delta, see delta.ts): a cut pylon is lost time.
import type { Pass, Penalty } from "../race/engine";
import { penaltiesUpTo } from "./delta";
import type { Run } from "./run";

export interface Split {
  step: number;
  gateIndex: number;
  lap: number;
  /** Seconds since the start at this pass, flight time only. */
  elapsed: number;
  /** Seconds since the previous pass, plus the penalties earned on the way. */
  sector: number;
  /** The penalties earned on the way here (a missed gate counts towards the next pass). */
  penalties: number;
  /** This sector against the reference's (negative = faster); null where it has no such sector. */
  sectorDelta: number | null;
  /** The race so far against the reference, penalties included; null where it has no such pass. */
  delta: number | null;
}

type Ref = Pick<Run, "passes" | "penalties">;

/** Penalties before this pass's sector begins: everything up to `step`, except that the start
 *  line's own (a ceiling there) belong to the first sector, since the start has no sector. */
function before(penalties: readonly Pick<Penalty, "step" | "seconds">[], step: number): number {
  return step === 0 ? 0 : penaltiesUpTo(penalties, step);
}

export function splits(passes: readonly Pass[], penalties: readonly Penalty[], ref: Ref | null): Split[] {
  const out: Split[] = [];
  let prev: Pass | null = null;
  for (const pass of passes) {
    const pen = prev ? penaltiesUpTo(penalties, pass.step) - before(penalties, prev.step) : 0;
    const sector = prev ? pass.elapsed - prev.elapsed + pen : 0;
    let sectorDelta: number | null = null;
    let delta: number | null = null;
    const r = ref?.passes.find((p) => p.step === pass.step);
    if (ref && r && prev) {
      delta = pass.elapsed + penaltiesUpTo(penalties, pass.step) - (r.elapsed + penaltiesUpTo(ref.penalties, pass.step));
      const rPrev = ref.passes.find((p) => p.step === prev!.step);
      if (rPrev) {
        const refSector = r.elapsed - rPrev.elapsed + penaltiesUpTo(ref.penalties, pass.step) - before(ref.penalties, prev.step);
        sectorDelta = sector - refSector;
      }
    }
    out.push({ step: pass.step, gateIndex: pass.gateIndex, lap: pass.lap, elapsed: pass.elapsed, sector, penalties: pen, sectorDelta, delta });
    prev = pass;
  }
  return out;
}
