import { describe, expect, it } from "vitest";
import { isNullIsland } from "../src/core/race/fix";
import { RPOS_BYTES, parseRpos, rposRequest } from "../src/core/telemetry/rpos";
import { RateMeter } from "../src/core/telemetry/rate";

/** An RPOS packet laid out as Laminar's document describes it (little-endian). */
function rpos(v: {
  lon: number;
  lat: number;
  ele: number;
  agl: number;
  pitch: number;
  heading: number;
  roll: number;
  vx: number;
  vy: number;
  vz: number;
}): Uint8Array {
  const b = new Uint8Array(RPOS_BYTES);
  b.set([..."RPOS"].map((c) => c.charCodeAt(0)));
  const d = new DataView(b.buffer);
  d.setFloat64(5, v.lon, true);
  d.setFloat64(13, v.lat, true);
  d.setFloat64(21, v.ele, true);
  [v.agl, v.pitch, v.heading, v.roll, v.vx, v.vy, v.vz, 0, 0, 0].forEach((x, i) => d.setFloat32(29 + i * 4, x, true));
  return b;
}

// Runway 17L at SCEL, from the X-Plane 12.4.3 apt.dat (probes/course.ts), rolling south at 30 m/s.
const SCEL = { lon: -70.7867314, lat: -33.3760605, ele: 474.2, agl: 1.1, pitch: 2.5, heading: 177.3, roll: -1.5, vx: 1.41, vy: 0, vz: 29.97 };

describe("RPOS", () => {
  it("asks for a rate as two NUL-terminated strings", () => {
    expect(String.fromCharCode(...rposRequest(40))).toBe("RPOS\u000040\u0000");
    expect(String.fromCharCode(...rposRequest(0))).toBe("RPOS\u00000\u0000");
  });

  it("reads the doubles at full precision and the floats as documented", () => {
    const f = parseRpos(rpos(SCEL), 12.5)!;
    expect(f.t).toBe(12.5);
    expect(f.lon).toBe(SCEL.lon); // doubles: no float32 rounding, which would be ~1 m here
    expect(f.lat).toBe(SCEL.lat);
    expect(f.altMslM).toBeCloseTo(474.2, 9);
    expect(f.aglM).toBeCloseTo(1.1, 5);
    expect(f.headingDeg).toBeCloseTo(177.3, 4);
    expect(f.pitchDeg).toBeCloseTo(2.5, 5);
    expect(f.rollDeg).toBeCloseTo(-1.5, 5);
  });

  it("derives the track from vx east and vz SOUTH", () => {
    const f = parseRpos(rpos(SCEL), 0)!;
    expect(f.trackDeg).toBeCloseTo(177.3, 1);
    expect(f.gsMs).toBeCloseTo(30, 1);
    const north = parseRpos(rpos({ ...SCEL, vx: 0, vz: -50 }), 0)!;
    expect(north.trackDeg).toBeCloseTo(0, 6);
    const west = parseRpos(rpos({ ...SCEL, vx: -50, vz: 0 }), 0)!;
    expect(west.trackDeg).toBeCloseTo(270, 6);
  });

  it("wraps a heading into [0, 360)", () => {
    expect(parseRpos(rpos({ ...SCEL, heading: -10 }), 0)!.headingDeg).toBeCloseTo(350, 4);
  });

  it("rejects other messages, short packets and non-finite values", () => {
    const other = rpos(SCEL);
    other[0] = "D".charCodeAt(0);
    expect(parseRpos(other, 0)).toBeNull();
    expect(parseRpos(rpos(SCEL).subarray(0, 60), 0)).toBeNull();
    expect(parseRpos(rpos({ ...SCEL, lat: Number.NaN }), 0)).toBeNull();
  });

  it("reads a packet that sits inside a larger buffer", () => {
    const big = new Uint8Array(RPOS_BYTES + 7);
    big.set(rpos(SCEL), 7);
    expect(parseRpos(big.subarray(7), 0)!.lat).toBe(SCEL.lat);
  });
});

describe("helpers", () => {
  it("measures a rate over the window", () => {
    const m = new RateMeter(3);
    for (let i = 0; i <= 10; i++) m.tick(i * 0.2);
    expect(m.hz(2)).toBeCloseTo(5, 6);
    expect(m.hz(10)).toBe(0);
  });

  it("recognizes the 0,0 position", () => {
    expect(isNullIsland({ lon: 0, lat: 0 })).toBe(true);
    expect(isNullIsland({ lon: -70.79, lat: -33.38 })).toBe(false);
  });
});
