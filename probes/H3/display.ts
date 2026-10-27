/**
 * Probe H3: the app's side of the in-sim display, without the app.
 *
 *   npm run probe:display                          (X-Plane on this computer; close XP Pylon Racer)
 *   npm run probe:display -- --course queenstown-lake-race-01
 *   npm run probe:display -- --demo                (no sim: the demo flight, as the app's Watch demo)
 *   npm run probe:display -- --list
 *
 * Judges the race with the app's own RaceSession and sends the plugin what it should show, in the
 * wire format of probes/H3/plugin/src/protocol.h, to 127.0.0.1:49710. With the sim it asks for RPOS
 * like the app does, so the two cannot run together (one RPOS subscriber: CLAUDE.md). Prints the
 * plugin's `hello` (its fps, draw time and what it receives) every five seconds.
 *
 * Nothing is saved: a finished run is printed and the race re-arms ten seconds later.
 */

import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { courseRevision, type Course, type GateType } from '../../src/core/course/course.js';
import { sampleCourses } from '../../src/core/demo/sampleCourses.js';
import { demoFlight } from '../../src/core/demo/demoFlight.js';
import { packPylons } from '../../src/core/export/pack.js';
import type { Fix } from '../../src/core/race/fix.js';
import { RaceSession, type SourceInfo } from '../../src/core/session/raceSession.js';
import { parseRpos, rposRequest, XPLANE_PORT } from '../../src/core/telemetry/rpos.js';
import { fmtTime } from '../../src/renderer/app/format.js';
import { dnfText, gateRequirements, penaltyReason } from '../../src/renderer/race/rulesText.js';

const PLUGIN_PORT = 49710; // protocol.h kPort
const PROTOCOL = 1;
const LIVE_MS = 50; // ~20 Hz, as the app pushes to its window (main/race.ts)
const COURSE_MS = 2000; // UDP may drop it: say it again
const REARM_MS = 10_000;
const RPOS_HZ = 40;

const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1]! : fallback;
};
const DEMO = args.includes('--demo');

const courses = sampleCourses();
if (args.includes('--list')) {
  for (const c of courses) console.log(`${c.id.padEnd(40)} ${c.name}`);
  process.exit(0);
}
const course = courses.find((c) => c.id === opt('course', 'daggett-sprint'));
if (!course) {
  console.error(`No included course "${opt('course', '')}". npm run probe:display -- --list`);
  process.exit(1);
}
const rev = courseRevision(course);

/** As RaceView's GATE_NAME. */
const GATE_NAME: Record<GateType, string> = {
  start: 'Start',
  finish: 'Finish',
  gate: 'Gate',
  level: 'Level gate',
  knife: 'Knife-edge gate',
  inverted: 'Inverted gate',
  turn: 'Turn pylon',
};

const session = new RaceSession(course, {
  pilot: 'H3',
  appVersion: 'probe-h3',
  newId: () => randomUUID(),
  nowIso: () => new Date().toISOString(),
});

// ---------------------------------------------------------------- the messages

const msg = (kind: string, rows: (string | number)[][]): Buffer =>
  Buffer.from([['XPR', PROTOCOL, kind], ...rows].map((r) => r.join('\t')).join('\n'), 'utf8');

function courseMessage(c: Course): Buffer {
  const gateIndex = new Map(c.gates.map((g, i) => [g.id, i]));
  return msg('course', [
    ['name', c.name],
    ['rev', rev],
    ...c.gates.map((g, i) => ['gate', i, g.type, g.center.lat.toFixed(7), g.center.lon.toFixed(7), g.headingDeg.toFixed(1)]),
    ...packPylons(c).map((p) => {
      const gi = gateIndex.get(p.object.id.split('.')[0]!)!;
      return ['pylon', gi, p.object.position.lat.toFixed(7), p.object.position.lon.toFixed(7)];
    }),
  ]);
}

/** The status line of RaceView's StatusLine, for the states this probe can be in. */
function statusLine(): string {
  const r = session.live().race;
  if (r.status === 'finished') return 'Finished';
  if (r.status === 'dnf') return `Did not finish${dnfText(r) ? ` · ${dnfText(r)}` : ''}`;
  if (!lastFixAt || Date.now() - lastFixAt > 2000) return DEMO ? 'Demo flight starting…' : 'Waiting for X-Plane…';
  return r.status === 'running' ? 'Racing' : 'Armed — fly through the start gate';
}

function liveMessage(): Buffer {
  const live = session.live();
  const r = live.race;
  const over = r.status === 'finished' || r.status === 'dnf';
  const next = over ? null : session.engine.nextGateIndex;
  const gate = next !== null ? course!.gates[next]! : null;
  const passed = new Set(r.passes.map((p) => p.gateIndex));
  const missed = new Set(r.penalties.filter((p) => p.kind === 'missed-gate').map((p) => p.gateIndex));
  const states = course!.gates.map((_, i) => (i === next ? 'n' : missed.has(i) ? 'm' : passed.has(i) ? 'd' : 't')).join('');
  const lap = r.laps > 1 && r.status === 'running' ? ` · lap ${r.lap} of ${r.laps}` : '';
  const last = r.penalties[r.penalties.length - 1];
  const pen = last ? `+${r.penaltyTotal.toFixed(1)} s · gate ${last.gateIndex + 1}: ${penaltyReason(last, course!)}` : '';
  const fix = live.fix;
  return msg('live', [
    ['rev', rev],
    ['status', r.status],
    ['line', statusLine()],
    ['time', fmtTime(r.total)],
    ['next', next ?? -1],
    ['title', gate ? `${next! + 1} · ${GATE_NAME[gate.type]}${lap}` : ''],
    ['needs', gate ? gateRequirements(gate, course!).join(' · ') : ''],
    ['pen', pen],
    ['gates', states],
    ...(fix ? [['fix', fix.lat.toFixed(7), fix.lon.toFixed(7), fix.headingDeg.toFixed(1), DEMO ? 1 : 0]] : []),
  ]);
}

// ---------------------------------------------------------------- the race

let lastFixAt = 0;
let rearm: NodeJS.Timeout | undefined;

function feed(fix: Fix, source: SourceInfo): void {
  lastFixAt = Date.now();
  const { run } = session.feed(fix, source);
  if (!run) return;
  const r = run.result;
  console.log(`\n${r.status === 'finished' ? 'Finished' : 'Did not finish'}: ${fmtTime(r.total)} (+${r.penaltyTotal.toFixed(1)} s penalties). Re-arming in ${REARM_MS / 1000} s.`);
  clearTimeout(rearm);
  rearm = setTimeout(() => session.reset(), REARM_MS);
}

const display = dgram.createSocket('udp4');
const send = (b: Buffer): void => display.send(b, PLUGIN_PORT, '127.0.0.1');

let lastHelloPrint = 0;
let hellos = 0;
display.on('message', (m) => {
  const lines = m.toString('utf8').split('\n');
  if (lines[0] !== `XPR\t${PROTOCOL}\thello`) return;
  hellos++;
  if (Date.now() - lastHelloPrint < 5000) return;
  lastHelloPrint = Date.now();
  const f = Object.fromEntries(lines.slice(1).map((l) => l.split('\t') as [string, string]));
  console.log(
    `plugin ${f.plugin} on X-Plane ${f.xplane} (XPLM ${f.xplm}): ${f.fps} fps, draw ${f.draw_avg_ms} ms avg / ${f.draw_max_ms} max, ` +
      `rx ${f.rx_hz} Hz, app fix vs sim ${f.fix_diff_m} m`,
  );
});

display.bind(0, '127.0.0.1', () => {
  console.log(`${course.name} (${course.id}, rev ${rev}) → plugin on 127.0.0.1:${PLUGIN_PORT}${DEMO ? ', demo flight' : ''}`);
  send(courseMessage(course));
  setInterval(() => send(courseMessage(course)), COURSE_MS);
  setInterval(() => send(liveMessage()), LIVE_MS);
  setInterval(() => {
    if (hellos === 0) console.log('no hello from the plugin yet (is X-Plane running with XPR_H3_Display?)');
    hellos = 0;
  }, 10_000);
});

if (DEMO) {
  // The demo flight in real time, again and again, like the app's Watch demo.
  const fixes = demoFlight(course, { rateHz: 30 });
  const source: SourceInfo = { kind: 'demo', hz: 30, aircraft: null };
  let i = 0;
  let t0 = performance.now() / 1000 - fixes[0]!.t;
  setInterval(() => {
    const t = performance.now() / 1000 - t0;
    while (i < fixes.length && fixes[i]!.t <= t) feed(fixes[i++]!, source);
    if (i >= fixes.length && t > fixes[fixes.length - 1]!.t + REARM_MS / 1000 + 1) {
      i = 0;
      t0 = performance.now() / 1000 - fixes[0]!.t;
    }
  }, 10);
} else {
  const rpos = dgram.createSocket('udp4');
  const source: SourceInfo = { kind: 'rpos', hz: RPOS_HZ, aircraft: null };
  rpos.on('message', (m) => {
    const fix = parseRpos(m, performance.now() / 1000);
    if (fix) feed(fix, source);
  });
  rpos.bind(0, () => {
    const ask = (): void => {
      if (Date.now() - lastFixAt > 3000) rpos.send(rposRequest(RPOS_HZ), XPLANE_PORT, '127.0.0.1');
    };
    ask();
    setInterval(ask, 3000);
  });
  process.on('SIGINT', () => {
    // RPOS 0 stops the stream for whoever owns it: ours, so only if we have it.
    if (lastFixAt) rpos.send(rposRequest(0), XPLANE_PORT, '127.0.0.1', () => process.exit(0));
    else process.exit(0);
  });
}
