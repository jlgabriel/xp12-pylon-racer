/**
 * Probe H3: the app's side of the in-sim display, without the app.
 *
 *   npm run probe:display                          (X-Plane on this computer; close XP Pylon Racer)
 *   npm run probe:display -- --course queenstown-lake-race-01
 *   npm run probe:display -- --demo                (no sim: the demo flight, as the app's Watch demo)
 *   npm run probe:display -- --list
 *
 * Judges the race with the app's own RaceSession and sends the plugin what it should show, with the
 * app's own messages (src/core/display/wire.ts), to 127.0.0.1:49710. With the sim it asks for RPOS
 * like the app does, so the two cannot run together (one RPOS subscriber: CLAUDE.md). Prints the
 * plugin's `hello` (its fps, draw time and what it receives) every five seconds.
 *
 * Nothing is saved: a finished run is printed and the race re-arms ten seconds later.
 */

import { randomUUID } from 'node:crypto';
import dgram from 'node:dgram';
import { courseRevision } from '../../src/core/course/course.js';
import { sampleCourses } from '../../src/core/demo/sampleCourses.js';
import { demoFlight } from '../../src/core/demo/demoFlight.js';
import { DISPLAY_PORT, courseMessage, liveMessage } from '../../src/core/display/wire.js';
import { fmtTime } from '../../src/core/format.js';
import type { Fix } from '../../src/core/race/fix.js';
import { statusLine } from '../../src/core/race/rulesText.js';
import { RaceSession, type SourceInfo } from '../../src/core/session/raceSession.js';
import { parseRpos, rposRequest, XPLANE_PORT } from '../../src/core/telemetry/rpos.js';
import type { TelemetryStatus } from '../../src/shared/racerApi.js';

const PLUGIN_PORT = DISPLAY_PORT;
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

const session = new RaceSession(course, {
  pilot: 'H3',
  appVersion: 'probe-h3',
  newId: () => randomUUID(),
  nowIso: () => new Date().toISOString(),
});

// ---------------------------------------------------------------- the messages

/** Just enough of the app's telemetry status for its status line. */
function telemetry(): TelemetryStatus {
  const fresh = lastFixAt > 0 && Date.now() - lastFixAt <= 2000;
  return {
    active: fresh ? (DEMO ? 'demo' : 'rpos') : null,
    aircraft: null,
    rpos: { ageS: null, hz: RPOS_HZ, error: null, shared: false },
    replay: false,
    webApi: { ok: false, error: null },
    demo: { running: DEMO && fresh },
  };
}

function liveNow(): Buffer {
  const live = session.live();
  return Buffer.from(liveMessage(course!, live, statusLine(live.race, telemetry()).text, DEMO));
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
  send(Buffer.from(courseMessage(course)));
  setInterval(() => send(Buffer.from(courseMessage(course))), COURSE_MS);
  setInterval(() => send(liveNow()), LIVE_MS);
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
