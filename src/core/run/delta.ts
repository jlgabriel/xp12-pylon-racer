// The live delta: how an attempt stands against a reference run at the same gate pass. Both sides
// count the penalties of the gates flown so far, because runs rank by total time, penalties included:
// flying faster with a cut pylon is not being ahead.
import type { Pass, Penalty } from "../race/engine";
import type { Run } from "./run";

/** Seconds of penalty for the gates up to and including this step of the sequence. */
export function penaltiesUpTo(penalties: readonly Pick<Penalty, "step" | "seconds">[], step: number): number {
  return penalties.reduce((sum, p) => (p.step <= step ? sum + p.seconds : sum), 0);
}

/** Attempt minus reference at this pass (negative = ahead), or null at the start or where the
 *  reference has no such pass. */
export function passDelta(pass: Pass, penalties: readonly Penalty[], ref: Run): number | null {
  const r = ref.passes.find((p) => p.step === pass.step);
  if (!r || pass.step === 0) return null;
  return pass.elapsed + penaltiesUpTo(penalties, pass.step) - (r.elapsed + penaltiesUpTo(ref.penalties, pass.step));
}
