/**
 * Probe H2: the flight log against the gates the flier saw.
 *
 *   npm run probe:gates -- probes/H0/runs/<time>
 *
 * For every pass through one of H1's gates: where along the gate line the aircraft crossed (0 m =
 * on the left pylon, 40 m = on the right one, flying 17L), at what height, with how much bank,
 * and how close it came to each pylon. The flier writes down what they saw at each gate; the two
 * have to agree to within a few metres, or the positions RPOS gives and the places the DSF put the
 * pylons are not the same world.
 *
 * Deliberately simple geometry — a flat local frame per gate, a segment crossing per pair of
 * samples. The real engine comes across from Pylon Racer later; this only has to be obviously
 * right.
 */

import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { LonLat } from '../../src/core/model.js';
import { readRpos, type RposRow } from '../H0/analyze.js';
import { GATES, GATE_WIDTH_M, PYLON_BASE_RADIUS_M, PYLON_HEIGHT_M, type ProbeGate } from '../course.js';

const M_PER_DEG_LAT = 111_132.954;

/** Metres east/north of `origin`. Good to centimetres over a few hundred metres. */
function local(origin: LonLat, p: LonLat): { x: number; y: number } {
  return {
    x: (p.lon - origin.lon) * M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * M_PER_DEG_LAT,
  };
}

interface Pass {
  gate: ProbeGate;
  tMs: number;
  /** Metres from the left pylon along the gate line; inside the gate is 0…GATE_WIDTH_M. */
  fromLeftM: number;
  aglM: number;
  rollDeg: number;
  southbound: boolean;
}

function passes(rows: RposRow[], gate: ProbeGate): Pass[] {
  const found: Pass[] = [];
  const L = gate.left;
  const R = local(L, gate.right);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    const pa = local(L, a);
    const pb = local(L, b);
    // Solve pa + s (pb − pa) = u R for s in [0,1]; u is the fraction along the gate line.
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const den = dx * R.y - dy * R.x;
    if (Math.abs(den) < 1e-9) continue;
    const s = (pa.y * R.x - pa.x * R.y) / den;
    if (s < 0 || s > 1) continue;
    const u = ((pa.x + s * dx) * R.x + (pa.y + s * dy) * R.y) / (R.x * R.x + R.y * R.y);
    // Report crossings out to one gate-width either side: a miss is a result too.
    if (u < -1 || u > 2) continue;
    found.push({
      gate,
      tMs: a.tMs + s * (b.tMs - a.tMs),
      fromLeftM: u * GATE_WIDTH_M,
      aglM: a.aglM + s * (b.aglM - a.aglM),
      rollDeg: a.rollDeg + s * (b.rollDeg - a.rollDeg),
      southbound: b.lat < a.lat,
    });
  }
  return found;
}

/** Closest horizontal approach to a pylon's axis within ±3 s of a pass. */
function closest(rows: RposRow[], pylon: LonLat, tMs: number): number {
  let best = Infinity;
  for (const r of rows) {
    if (Math.abs(r.tMs - tMs) > 3000) continue;
    const p = local(pylon, r);
    best = Math.min(best, Math.hypot(p.x, p.y));
  }
  return best;
}

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npm run probe:gates -- probes/H0/runs/<time>');
  process.exit(1);
}
const runDir = resolve(dir);
const rows = readRpos(runDir);
const out: string[] = [
  `# H2 — gate passes in ${runDir.split(/[\\/]/).at(-1)}`,
  '',
  `Gate width ${GATE_WIDTH_M} m. "From left" is measured flying 17L (south): 0 = left (east) pylon, ` +
    `${GATE_WIDTH_M} = right (west) pylon. A pylon's surface is ${PYLON_BASE_RADIUS_M} m from its axis at the foot; its top is at ${PYLON_HEIGHT_M} m.`,
  '',
  '| gate | time s | direction | from left m | inside? | AGL m | roll ° | closest to left / right pylon m |',
  '|---|---|---|---|---|---|---|---|',
];
let count = 0;
for (const gate of GATES) {
  for (const p of passes(rows, gate)) {
    count++;
    const inside = p.fromLeftM > 0 && p.fromLeftM < GATE_WIDTH_M;
    out.push(
      `| ${gate.n} ${gate.color} | ${(p.tMs / 1000).toFixed(2)} | ${p.southbound ? 'south (17L)' : 'north (35R)'} | ` +
        `${p.fromLeftM.toFixed(1)} | ${inside ? 'yes' : '**no**'} | ${p.aglM.toFixed(1)} | ${p.rollDeg.toFixed(0)} | ` +
        `${closest(rows, gate.left, p.tMs).toFixed(1)} / ${closest(rows, gate.right, p.tMs).toFixed(1)} |`,
    );
  }
}
if (count === 0) out.push('', 'No sample pair crossed any gate line. Was the run recorded with the H1 pack flown?');
const text = out.join('\n') + '\n';
writeFileSync(join(runDir, 'gates.md'), text);
console.log(text);
