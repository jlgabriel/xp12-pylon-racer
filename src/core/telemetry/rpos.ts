// X-Plane's RPOS output (UDP), documented in the installation itself:
// Instructions/Exchanging Data with X-Plane.rtfd, "JUST LET ME GET OUTPUT FROM X-PLANE…: RPOS".
//
// Ask by sending "RPOS\0" + "<rate>\0" to X-Plane's port 49000; it answers to the address and port the
// request came FROM, <rate> times a second, until asked for 0. Each answer is tightly packed,
// machine-native (little-endian on x64 and ARM):
//
//   "RPOS" + one internal byte
//   double lon, lat (degrees), elevation (m MSL)
//   float  AGL (m), pitch, true heading, roll (degrees)
//   float  vx EAST, vy UP, vz SOUTH (m/s), then roll/pitch/yaw rates (rad/s)
//
// ⚠️ Read from Laminar's document, NOT yet measured: probe H0 (probes/H0) checks the heading as a
// compass bearing against the track the positions draw (the Aerofly DLL sent a math angle), the sign
// of the roll against the direction of the turn, and vz pointing south. Should any of them come back
// wrong, the fix belongs here and nowhere else.
import { wrap360 } from "../geo/geo";
import type { Fix } from "../race/fix";

export const XPLANE_PORT = 49000;
export const RPOS_BYTES = 69;

/** The request for `rateHz` positions a second; 0 stops the stream. */
export function rposRequest(rateHz: number): Uint8Array {
  const text = `RPOS\0${Math.max(0, Math.round(rateHz))}\0`;
  return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

/** One RPOS packet as a fix at receive time `t` (seconds). Null for anything that is not one. */
export function parseRpos(bytes: Uint8Array, t: number): Fix | null {
  if (bytes.length < RPOS_BYTES) return null;
  if (String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!) !== "RPOS") return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lon = v.getFloat64(5, true);
  const lat = v.getFloat64(13, true);
  const ele = v.getFloat64(21, true);
  const f = (i: number): number => v.getFloat32(29 + i * 4, true);
  const [agl, pitch, heading, roll, vxEast, , vzSouth] = [f(0), f(1), f(2), f(3), f(4), f(5), f(6)];
  if (![lon, lat, ele, agl, pitch, heading, roll, vxEast, vzSouth].every(Number.isFinite)) return null;
  return {
    t,
    lon,
    lat,
    altMslM: ele,
    aglM: agl,
    // The ground track the velocities draw: north is −z.
    trackDeg: wrap360((Math.atan2(vxEast, -vzSouth) * 180) / Math.PI),
    gsMs: Math.hypot(vxEast, vzSouth),
    headingDeg: wrap360(heading),
    pitchDeg: pitch,
    rollDeg: roll,
  };
}
