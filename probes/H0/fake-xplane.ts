/**
 * A stand-in for X-Plane's RPOS output, so the probe tools can be checked without a flight.
 *
 *   npm run probe:fake            (then, in another terminal, npm run probe:listen)
 *
 * Answers an RPOS request on UDP 49000 with a scripted flight whose answers are known: south down
 * 17L at 12 m AGL, 12 m right of the centreline (so H2 must report 32 m from the left pylon), then
 * a right turn with positive roll and a left turn with negative roll. Heading is a compass
 * bearing, vx east, vz south — the documented conventions. If listen + analyze + gates do not
 * read exactly that back, the bug is in them, not in X-Plane.
 *
 * Runs ten times faster than a C172 so a check takes seconds; the analysis does not care.
 */

import dgram from 'node:dgram';
import { destination } from '../../src/core/geo/geo.js';
import type { LonLat } from '../../src/core/model.js';
import { RUNWAY_BEARING, RWY_17L } from '../course.js';

const SPEED = 150; // m/s
const AGL = 12;
const ELEVATION = 474; // SCEL, m

const socket = dgram.createSocket('udp4');
let timer: NodeJS.Timeout | undefined;

interface State {
  pos: LonLat;
  hdg: number;
  roll: number;
  t: number;
}

/** Straight for 9 s, then 5 s turning right at 20°/s, then 5 s turning left. */
function step(s: State, dt: number): State {
  const phase = s.t < 9 ? 0 : s.t < 14 ? 1 : s.t < 19 ? -1 : 0;
  const roll = phase * 30;
  const hdg = (s.hdg + phase * 20 * dt + 360) % 360;
  return { pos: destination(s.pos, SPEED * dt, hdg), hdg, roll, t: s.t + dt };
}

function packet(s: State): Buffer {
  const b = Buffer.alloc(69);
  b.write('RPOS', 0, 'latin1');
  b.writeDoubleLE(s.pos.lon, 5);
  b.writeDoubleLE(s.pos.lat, 13);
  b.writeDoubleLE(ELEVATION + AGL, 21);
  const rad = (s.hdg * Math.PI) / 180;
  const floats = [AGL, 2, s.hdg, s.roll, SPEED * Math.sin(rad), 0, -SPEED * Math.cos(rad), 0, 0, 0];
  floats.forEach((v, i) => b.writeFloatLE(v, 29 + i * 4));
  return b;
}

socket.on('message', (msg, from) => {
  if (msg.toString('latin1', 0, 4) !== 'RPOS') return;
  const rate = Number(msg.toString('latin1', 5).replace(/\0.*$/s, ''));
  clearInterval(timer);
  console.log(`RPOS at ${rate} Hz requested by ${from.address}:${from.port}`);
  if (!(rate > 0)) return;

  const centre = destination(RWY_17L, 1300, RUNWAY_BEARING);
  let state: State = { pos: destination(centre, 12, RUNWAY_BEARING + 90), hdg: RUNWAY_BEARING, roll: 0, t: 0 };
  timer = setInterval(() => {
    state = step(state, 1 / rate);
    socket.send(packet(state), from.port, from.address);
  }, 1000 / rate);
});

socket.bind(49000, () => console.log('Fake X-Plane listening on UDP 49000 (Ctrl+C to stop)'));
