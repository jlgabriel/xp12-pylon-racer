/**
 * Probe H0: everything X-Plane 12 will tell us about the flight, from every door at once.
 *
 *   npm run probe:listen                 (X-Plane on this computer)
 *   npm run probe:listen -- --host 192.168.0.20 --rate 40
 *   npm run probe:listen -- --seconds 25     (stops by itself)
 *
 * Opens three channels side by side and records what each one actually delivers:
 *
 * - **RPOS** (UDP 49000): ask X-Plane for its position N times a second. Documented in
 *   `Instructions/Exchanging Data with X-Plane.rtfd`: doubles for lon/lat/elevation, floats for
 *   AGL, pitch, true heading, roll, world velocities and body rates. The candidate for the race.
 * - **Web API** (WebSocket 8086, X-Plane 12.1.1+): datarefs by name. Laminar says it pushes at
 *   10 Hz; the candidate for "which aircraft is this", which RPOS does not say.
 * - **Port 49002**: whatever arrives there. Aerofly sends ForeFlight's XGPS/XATT on it; whether
 *   X-Plane 12 does, and how fast, is a question, not an assumption.
 * - and the **BECN** multicast X-Plane announces itself with, for finding it without settings.
 *
 * Nothing is interpreted while flying beyond a rate line every two seconds. Ctrl+C writes the
 * run to probes/H0/runs/<time>/ and the summary next to it (analyze.ts).
 */

import dgram from 'node:dgram';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeRun, RPOS_COLUMNS } from './analyze.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] ? args[at + 1]! : fallback;
};
const HOST = opt('host', '127.0.0.1');
const RATE = Number(opt('rate', '40'));
const WEB_PORT = Number(opt('web-port', '8086'));

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const runDir = join(HERE, 'runs', stamp);
mkdirSync(runDir, { recursive: true });
const t0 = performance.now();
const now = (): number => Math.round((performance.now() - t0) * 10) / 10;

const files: WriteStream[] = [];
function open(name: string, header?: string): WriteStream {
  const s = createWriteStream(join(runDir, name));
  if (header) s.write(header + '\n');
  files.push(s);
  return s;
}

const counts = { rpos: 0, web: 0, p49002: 0, beacon: 0 };
let last = { lat: NaN, lon: NaN, agl: NaN, hdg: NaN, roll: NaN };

// ── RPOS ────────────────────────────────────────────────────────────────────────────────────────

const rposOut = open('rpos.csv', RPOS_COLUMNS.join(','));
const rpos = dgram.createSocket('udp4');
let lastRpos = -Infinity;

rpos.on('message', (msg) => {
  if (msg.length < 69 || msg.toString('latin1', 0, 4) !== 'RPOS') return;
  // "RPOS" + one internal byte, then tightly packed, machine-native (little-endian on x64/ARM).
  const v = [
    msg.readDoubleLE(5),
    msg.readDoubleLE(13),
    msg.readDoubleLE(21),
    ...Array.from({ length: 10 }, (_, i) => msg.readFloatLE(29 + i * 4)),
  ];
  lastRpos = performance.now();
  counts.rpos++;
  rposOut.write([now(), ...v.map((x, i) => (i < 2 ? x.toFixed(9) : x.toFixed(4)))].join(',') + '\n');
  last = { lon: v[0]!, lat: v[1]!, agl: v[3]!, hdg: v[5]!, roll: v[6]! };
});

function askRpos(rate: number): void {
  const body = Buffer.concat([Buffer.from('RPOS\0', 'latin1'), Buffer.from(`${rate}\0`, 'latin1')]);
  rpos.send(body, 49000, HOST);
}
rpos.bind(0, () => askRpos(RATE));
// X-Plane forgets a subscriber when it restarts; ask again whenever the stream goes quiet.
const rposTimer = setInterval(() => {
  if (performance.now() - lastRpos > 2000) askRpos(RATE);
}, 2000);

// ── Web API ─────────────────────────────────────────────────────────────────────────────────────

const DATAREFS = [
  'sim/flightmodel/position/latitude',
  'sim/flightmodel/position/longitude',
  'sim/flightmodel/position/elevation',
  'sim/flightmodel/position/y_agl',
  'sim/flightmodel/position/true_psi',
  'sim/flightmodel/position/true_theta',
  'sim/flightmodel/position/true_phi',
  'sim/flightmodel/position/hpath',
  'sim/flightmodel/position/groundspeed',
  'sim/time/total_running_time_sec',
  'sim/time/paused',
  'sim/aircraft/view/acf_ICAO',
  'sim/aircraft/view/acf_relative_path',
  'sim/aircraft/view/acf_descrip',
  'sim/aircraft/view/acf_ui_name',
  'sim/version/xplane_internal_version',
];

const webOut = open('webapi.jsonl');
const webLog = open('webapi-log.txt');
const names = new Map<number, string>();
let socket: WebSocket | null = null;
let webConnecting = false;

async function lookup(name: string): Promise<{ id: number; type: string } | string> {
  const errors: string[] = [];
  for (const v of ['v3', 'v2', 'v1']) {
    const url = `http://${HOST}:${WEB_PORT}/api/${v}/datarefs?filter%5Bname%5D=${encodeURIComponent(name)}`;
    try {
      const res = await fetch(url);
      const body = (await res.json().catch(() => null)) as { data?: { id: number; value_type: string }[] } | null;
      const hit = body?.data?.[0];
      if (res.ok && hit) return { id: hit.id, type: `${hit.value_type} (REST ${v})` };
      errors.push(`${v}: HTTP ${res.status} ${JSON.stringify(body).slice(0, 120)}`);
    } catch (e) {
      errors.push(`${v}: ${(e as Error).message}`);
    }
  }
  return errors.join(' | ');
}

async function connectWeb(): Promise<void> {
  if (socket || webConnecting) return;
  webConnecting = true;
  try {
    names.clear();
    const ids: number[] = [];
    for (const name of DATAREFS) {
      const found = await lookup(name);
      if (typeof found === 'string') {
        webLog.write(`${now()} lookup ${name}: ${found}\n`);
        continue;
      }
      names.set(found.id, name);
      ids.push(found.id);
      webLog.write(`${now()} lookup ${name}: id ${found.id}, ${found.type}\n`);
    }
    if (ids.length === 0) return; // no flight loaded yet, or the API is off: try again later

    const ws = new WebSocket(`ws://${HOST}:${WEB_PORT}/api/v3`);
    socket = ws;
    ws.onopen = () => {
      webLog.write(`${now()} websocket open\n`);
      ws.send(JSON.stringify({ req_id: 1, type: 'dataref_subscribe_values', params: { datarefs: ids.map((id) => ({ id })) } }));
    };
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { type: string; data?: Record<string, unknown> };
      if (msg.type !== 'dataref_update_values' || !msg.data) {
        webLog.write(`${now()} ${String(event.data).slice(0, 300)}\n`);
        return;
      }
      counts.web++;
      const values: Record<string, unknown> = {};
      for (const [id, value] of Object.entries(msg.data)) values[names.get(Number(id)) ?? id] = decodeBytes(value);
      webOut.write(JSON.stringify({ tMs: now(), values }) + '\n');
    };
    ws.onclose = () => {
      webLog.write(`${now()} websocket closed\n`);
      socket = null;
    };
    ws.onerror = () => webLog.write(`${now()} websocket error\n`);
  } finally {
    webConnecting = false;
  }
}

/** Byte-array datarefs (the aircraft's names) arrive base64-encoded; numbers pass through. */
function decodeBytes(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = Buffer.from(value, 'base64').toString('latin1').replace(/\0.*$/s, '');
  return /^[\x20-\x7e]*$/.test(text) ? { base64: value, text } : value;
}

void connectWeb();
const webTimer = setInterval(() => void connectWeb(), 5000);

// ── Port 49002 ──────────────────────────────────────────────────────────────────────────────────

const p49002Out = open('port49002.txt');
const p49002 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
p49002.on('message', (msg, from) => {
  counts.p49002++;
  const text = msg.toString('latin1').replace(/[^\x20-\x7e]/g, '·').slice(0, 200);
  p49002Out.write(`${now()}\t${from.address}\t${msg.length}\t${text}\n`);
});
p49002.on('error', (e) => p49002Out.write(`${now()}\tERROR\t${e.message}\n`));
p49002.bind(49002);

// ── BECN ────────────────────────────────────────────────────────────────────────────────────────

const beaconOut = open('beacon.txt');
const beacon = dgram.createSocket({ type: 'udp4', reuseAddr: true });
beacon.on('message', (msg, from) => {
  counts.beacon++;
  if (counts.beacon > 5 || msg.toString('latin1', 0, 4) !== 'BECN') return;
  // struct becn_struct, tightly packed after "BECN\0": major, minor, host id, version, role, port, name
  beaconOut.write(
    JSON.stringify({
      tMs: now(),
      from: from.address,
      major: msg.readUInt8(5),
      minor: msg.readUInt8(6),
      hostId: msg.readInt32LE(7),
      version: msg.readInt32LE(11),
      role: msg.readUInt32LE(15),
      port: msg.readUInt16LE(19),
      computer: msg.toString('latin1', 21, 521).replace(/\0.*$/s, ''),
    }) + '\n',
  );
});
beacon.on('error', (e) => beaconOut.write(`${now()} ERROR ${e.message}\n`));
beacon.bind(49707, () => {
  try {
    beacon.addMembership('239.255.1.1');
  } catch (e) {
    beaconOut.write(`${now()} multicast: ${(e as Error).message}\n`);
  }
});

// ── live line, and the end ──────────────────────────────────────────────────────────────────────

let before = { ...counts };
const live = setInterval(() => {
  const rates = Object.fromEntries(
    (Object.keys(counts) as (keyof typeof counts)[]).map((k) => [k, ((counts[k] - before[k]) / 2).toFixed(1).padStart(5)]),
  ) as Record<keyof typeof counts, string>;
  const hz = (k: keyof typeof counts) => rates[k];
  before = { ...counts };
  const pos = Number.isFinite(last.lat)
    ? `${last.lat.toFixed(5)} ${last.lon.toFixed(5)}  AGL ${last.agl.toFixed(1)} m  hdg ${last.hdg.toFixed(0)}  roll ${last.roll.toFixed(0)}`
    : 'no RPOS yet';
  process.stdout.write(`RPOS ${hz('rpos')} Hz | Web ${hz('web')} Hz | 49002 ${hz('p49002')} Hz | ${pos}\n`);
}, 2000);

console.log(`Recording to ${runDir}`);
console.log(`Asking ${HOST}:49000 for RPOS at ${RATE} Hz, Web API on ${WEB_PORT}, listening on 49002. Ctrl+C to finish.\n`);

let stopping = false;
function finish(): void {
  if (stopping) process.exit(1);
  stopping = true;
  clearInterval(live);
  clearInterval(rposTimer);
  clearInterval(webTimer);
  askRpos(0); // stop the stream, so X-Plane is not left sending to a closed port
  socket?.close();
  setTimeout(async () => {
    for (const s of [rpos, p49002, beacon]) s.close();
    await Promise.all(files.map((s) => new Promise((done) => s.end(done))));
    const summary = analyzeRun(runDir);
    console.log(`\n${summary}\nWritten: ${join(runDir, 'summary.md')}`);
    process.exit(0);
  }, 300);
}
process.on('SIGINT', finish);
// --seconds N stops by itself: for checking the tools against fake-xplane.ts without a keyboard.
const SECONDS = Number(opt('seconds', '0'));
if (SECONDS > 0) setTimeout(finish, SECONDS * 1000);
