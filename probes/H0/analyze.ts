/**
 * Read an H0 run back and say what it shows. Written so the flier does not have to: every check
 * that can be answered from the numbers is answered here, with the numbers next to it.
 *
 *   npm run probe:analyze -- probes/H0/runs/<time>
 *
 * The sign checks are built so that they cannot pass by accident (the "positive control" rule
 * from PCT): heading is compared against the track that the positions THEMSELVES draw, roll
 * against the direction the track actually turns, and both against the alternative reading that
 * bit the Aerofly app (a math angle, 90 − heading).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversine, initialBearing } from '../../src/core/geo/geo.js';

export const RPOS_COLUMNS = [
  'tMs', 'lon', 'lat', 'eleM', 'aglM', 'pitchDeg', 'headingDeg', 'rollDeg',
  'vxE', 'vyUp', 'vzS', 'pRad', 'qRad', 'rRad',
] as const;

export type RposRow = Record<(typeof RPOS_COLUMNS)[number], number>;

export function readRpos(runDir: string): RposRow[] {
  const path = join(runDir, 'rpos.csv');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const v = l.split(',').map(Number);
      return Object.fromEntries(RPOS_COLUMNS.map((c, i) => [c, v[i]!])) as RposRow;
    });
}

const wrap180 = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;
const pct = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
};
const f = (x: number, digits = 1): string => (Number.isFinite(x) ? x.toFixed(digits) : '—');

function rateLines(name: string, times: number[]): string[] {
  if (times.length < 2) return [`- **${name}:** ${times.length} messages — nothing to measure.`];
  const gaps = times.slice(1).map((t, i) => t - times[i]!);
  const span = (times.at(-1)! - times[0]!) / 1000;
  return [
    `- **${name}:** ${times.length} messages over ${f(span)} s = **${f((times.length - 1) / span)} Hz** on average. ` +
      `Gap between messages: median ${f(pct(gaps, 50))} ms, p95 ${f(pct(gaps, 95))} ms, longest ${f(Math.max(...gaps))} ms.`,
  ];
}

export function analyzeRun(runDir: string): string {
  const out: string[] = [`# H0 — run ${runDir.split(/[\\/]/).at(-1)}`, ''];

  // ── RPOS ──
  const rows = readRpos(runDir);
  out.push('## RPOS (UDP 49000)', '');
  out.push(...rateLines('RPOS', rows.map((r) => r.tMs)));
  if (rows.length > 0) {
    const zero = rows.filter((r) => Math.abs(r.lat) < 1e-6 && Math.abs(r.lon) < 1e-6).length;
    out.push(`- Samples at lat/lon 0,0 (menu, "Null Island"): ${zero} of ${rows.length}.`);

    // Rate while actually flying, which is what the race sees.
    const flying = rows.filter((r) => Math.hypot(r.vxE, r.vzS) > 15);
    if (flying.length > 1) out.push(...rateLines('RPOS while moving faster than 15 m/s', flying.map((r) => r.tMs)));
    out.push(`- AGL seen: ${f(Math.min(...rows.map((r) => r.aglM)))} to ${f(Math.max(...rows.map((r) => r.aglM)))} m.`);
    out.push('');
    out.push(...signChecks(rows));
  }
  out.push('');

  // ── Web API ──
  out.push('## Web API (WebSocket 8086)', '');
  const webPath = join(runDir, 'webapi.jsonl');
  const web = existsSync(webPath)
    ? readFileSync(webPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as { tMs: number; values: Record<string, unknown> })
    : [];
  out.push(...rateLines('Web API updates', web.map((w) => w.tMs)));
  const seen = new Map<string, Set<string>>();
  for (const w of web) {
    for (const [k, v] of Object.entries(w.values)) {
      if (!/acf_|version|paused/.test(k)) continue;
      const text = typeof v === 'object' && v && 'text' in v ? String((v as { text: string }).text) : JSON.stringify(v);
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k)!.add(text);
    }
  }
  for (const [k, vs] of seen) out.push(`- \`${k}\`: ${[...vs].slice(0, 5).map((v) => `\`${v}\``).join(', ')}`);
  const latKey = 'sim/flightmodel/position/latitude';
  const lonKey = 'sim/flightmodel/position/longitude';
  let wLat = NaN;
  let wLon = NaN;
  const offsets: number[] = [];
  for (const w of web) {
    if (typeof w.values[latKey] === 'number') wLat = w.values[latKey] as number;
    if (typeof w.values[lonKey] === 'number') wLon = w.values[lonKey] as number;
    if (!Number.isFinite(wLat) || rows.length === 0) continue;
    const near = nearest(rows, w.tMs);
    if (near && Math.abs(near.tMs - w.tMs) < 30 && Math.hypot(near.vxE, near.vzS) < 1) {
      offsets.push(haversine({ lon: wLon, lat: wLat }, { lon: near.lon, lat: near.lat }));
    }
  }
  if (offsets.length > 0) {
    out.push(`- Web API vs RPOS position, aircraft standing still: median ${f(pct(offsets, 50), 3)} m apart (${offsets.length} pairs).`);
  }
  const log = join(runDir, 'webapi-log.txt');
  if (existsSync(log)) {
    const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    const missing = lines.filter((l) => /lookup .*: v3:/.test(l)).map((l) => l.replace(/^[\d.]+ lookup /, '').split(':')[0]);
    if (missing.length > 0) out.push(`- Datarefs that never resolved: ${[...new Set(missing)].map((m) => `\`${m}\``).join(', ')}`);
  }
  out.push('');

  // ── 49002 ──
  out.push('## Port 49002', '');
  const pPath = join(runDir, 'port49002.txt');
  const packets = existsSync(pPath) ? readFileSync(pPath, 'utf8').split('\n').filter(Boolean) : [];
  if (packets.length === 0) out.push('- Nothing arrived.');
  const byType = new Map<string, number[]>();
  for (const p of packets) {
    const [t, , , text] = p.split('\t');
    const type = (text ?? '').slice(0, 4);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(Number(t));
  }
  for (const [type, times] of byType) {
    out.push(...rateLines(`\`${type}\``, times));
    const sample = packets.find((p) => p.split('\t')[3]?.startsWith(type));
    if (sample) out.push(`  - e.g. \`${sample.split('\t')[3]}\``);
  }
  out.push('');

  // ── BECN ──
  out.push('## Beacon (239.255.1.1:49707)', '');
  const bPath = join(runDir, 'beacon.txt');
  const beacon = existsSync(bPath) ? readFileSync(bPath, 'utf8').split('\n').filter(Boolean) : [];
  out.push(beacon.length > 0 ? `- \`${beacon[0]}\`` : '- Nothing arrived.');

  const text = out.join('\n') + '\n';
  writeFileSync(join(runDir, 'summary.md'), text);
  return text;
}

function nearest(rows: RposRow[], tMs: number): RposRow | undefined {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]!.tMs < tMs) lo = mid + 1;
    else hi = mid;
  }
  return rows[lo];
}

/**
 * Heading, roll, pitch and the velocity frame, each read against what the positions show.
 *
 * Uses pairs of samples ~1 s apart while moving fast enough that the track is meaningful. A crab
 * angle from wind shows up as a small constant offset; a wrong convention shows up as tens of
 * degrees, or as the alternative reading matching better.
 */
function signChecks(rows: RposRow[]): string[] {
  const out: string[] = ['### Signs and frames, read against the track', ''];
  const hdgDiff: number[] = [];
  const mathDiff: number[] = [];
  const velDiff: number[] = [];
  let rollAgree = 0;
  let rollTotal = 0;
  let pitchAgree = 0;
  let pitchTotal = 0;

  let j = 0;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]!;
    while (j < rows.length && rows[j]!.tMs - a.tMs < 1000) j++;
    const b = rows[j];
    if (!b) break;
    const dist = haversine(a, b);
    const dt = (b.tMs - a.tMs) / 1000;
    if (dist / dt < 20 || dt > 1.5) continue;

    // The chord a→b is the track at the MIDDLE of the second, so compare it with the middle too:
    // heading at a alone would be half a second of turn off.
    const track = initialBearing(a, b);
    const midHeading = a.headingDeg + wrap180(b.headingDeg - a.headingDeg) / 2;
    hdgDiff.push(Math.abs(wrap180(midHeading - track)));
    mathDiff.push(Math.abs(wrap180(90 - midHeading - track)));
    // RPOS documents vx as EAST and vz as SOUTH: the track they imply is atan2(vx, -vz).
    const velTrack = (Math.atan2(a.vxE + b.vxE, -(a.vzS + b.vzS)) * 180) / Math.PI;
    velDiff.push(Math.abs(wrap180(velTrack - track)));

    // Turning: how fast the track itself changes over the next second.
    const c = rows[Math.min(rows.length - 1, j + (j - i))];
    if (c && c !== b) {
      const turnRate = wrap180(initialBearing(b, c) - track);
      if (Math.abs(a.rollDeg) > 15 && Math.abs(turnRate) > 3) {
        rollTotal++;
        if (Math.sign(a.rollDeg) === Math.sign(turnRate)) rollAgree++;
      }
    }
    const climb = (b.eleM - a.eleM) / dt;
    if (Math.abs(climb) > 3 && Math.abs(a.pitchDeg) > 3) {
      pitchTotal++;
      if (Math.sign(a.pitchDeg) === Math.sign(climb)) pitchAgree++;
    }
  }

  if (hdgDiff.length === 0) return [...out, '- Never moved faster than 20 m/s: nothing to check against.'];
  const verdict = (ok: boolean): string => (ok ? '✅' : '❌');
  const hdgOk = pct(hdgDiff, 50) < 15 && pct(hdgDiff, 50) < pct(mathDiff, 50);
  out.push(
    `- ${verdict(hdgOk)} **Heading is a compass bearing**: |heading − track| median ${f(pct(hdgDiff, 50))}°, p90 ${f(pct(hdgDiff, 90))}° ` +
      `(${hdgDiff.length} pairs). Read as a math angle (90 − heading) instead: median ${f(pct(mathDiff, 50))}°.`,
  );
  out.push(
    `- ${verdict(pct(velDiff, 50) < 10)} **vx is east, vz is south**: track from the velocities vs from the positions, median ${f(pct(velDiff, 50))}° apart.`,
  );
  out.push(
    rollTotal === 0
      ? '- ❓ **Roll sign**: no turn with more than 15° of bank. Fly the two turns.'
      : `- ${verdict(rollAgree / rollTotal > 0.9)} **Roll positive = right wing down** (turning right): ${rollAgree} of ${rollTotal} banked samples agree.`,
  );
  out.push(
    pitchTotal === 0
      ? '- ❓ **Pitch sign**: never climbed or descended faster than 3 m/s.'
      : `- ${verdict(pitchAgree / pitchTotal > 0.8)} **Pitch positive = nose up**: ${pitchAgree} of ${pitchTotal} climbing/descending samples agree (loose: a glide can descend nose-up).`,
  );
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npm run probe:analyze -- probes/H0/runs/<time>');
    process.exit(1);
  }
  console.log(analyzeRun(resolve(dir)));
}
