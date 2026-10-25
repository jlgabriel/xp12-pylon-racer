import { describe, expect, it } from "vitest";
import {
  ecefToGeodetic,
  destination,
  fromLocal,
  haversine,
  initialBearing,
  lerpAngle,
  pylonsOfGate,
  relativeBearing,
  segmentIntersection,
  toLocal,
  wrap180,
} from "../src/core/geo/geo";

const REF = { lon: -119.88, lat: 39.66 };

describe("distance and bearing", () => {
  it("one degree of latitude is ~111.2 km", () => {
    expect(haversine({ lon: 0, lat: 0 }, { lon: 0, lat: 1 })).toBeCloseTo(111195, -2);
  });

  it("bearings due east and due north", () => {
    expect(initialBearing({ lon: 0, lat: 0 }, { lon: 1, lat: 0 })).toBeCloseTo(90, 3);
    expect(initialBearing({ lon: 0, lat: 0 }, { lon: 0, lat: 1 })).toBeCloseTo(0, 3);
  });

  it("destination round-trips distance and bearing", () => {
    for (const b of [0, 45, 90, 180, 270, 333]) {
      const d = destination(REF, 500, b);
      expect(haversine(REF, d)).toBeCloseTo(500, 0);
      expect(wrap180(initialBearing(REF, d) - b)).toBeCloseTo(0, 0);
    }
  });
});

describe("local projection", () => {
  it("round-trips", () => {
    const p = destination(REF, 800, 60);
    const back = fromLocal(toLocal(p, REF), REF);
    expect(back.lat).toBeCloseTo(p.lat, 9);
    expect(back.lon).toBeCloseTo(p.lon, 9);
  });

  it("local distance matches haversine", () => {
    const p = destination(REF, 1000, 123);
    const q = toLocal(p, REF);
    expect(Math.hypot(q.x, q.y)).toBeCloseTo(1000, 0);
  });
});

describe("segment intersection", () => {
  it("finds a simple crossing with both parameters", () => {
    const x = segmentIntersection({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 });
    expect(x).not.toBeNull();
    expect(x!.t).toBeCloseTo(0.5, 9);
    expect(x!.u).toBeCloseTo(0.5, 9);
  });

  it("reports where along the first segment the crossing is", () => {
    const x = segmentIntersection({ x: -3, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 });
    expect(x!.t).toBeCloseTo(0.75, 9);
  });

  it("returns null for disjoint and parallel segments", () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: -1 }, { x: 2, y: -0.5 })).toBeNull();
  });
});

describe("gate pylons", () => {
  it("flying north, the left pylon is west and the span equals the width", () => {
    const { left, right } = pylonsOfGate(REF, 80, 0);
    expect(left.lon).toBeLessThan(REF.lon);
    expect(right.lon).toBeGreaterThan(REF.lon);
    expect(haversine(left, right)).toBeCloseTo(80, 0);
  });

  it("flying east, the left pylon is north", () => {
    const { left, right } = pylonsOfGate(REF, 100, 90);
    expect(left.lat).toBeGreaterThan(REF.lat);
    expect(right.lat).toBeLessThan(REF.lat);
  });
});

describe("angles", () => {
  it("wraps and interpolates the short way round", () => {
    expect(wrap180(270)).toBe(-90);
    expect(lerpAngle(170, -170, 0.5)).toBeCloseTo(180, 9);
    expect(lerpAngle(-10, 10, 0.25)).toBeCloseTo(-5, 9);
  });
});

describe("relative bearing", () => {
  const north = destination(REF, 1000, 0);
  it("is zero dead ahead and negative to the left", () => {
    expect(relativeBearing(REF, 0, north)).toBeCloseTo(0, 3);
    expect(relativeBearing(REF, 90, north)).toBeCloseTo(-90, 3); // heading east, the gate is north
    expect(relativeBearing(REF, 270, north)).toBeCloseTo(90, 3); // heading west, it is to the right
  });
  it("wraps across north", () => {
    expect(relativeBearing(REF, 350, destination(REF, 1000, 10))).toBeCloseTo(20, 1);
    expect(relativeBearing(REF, 10, destination(REF, 1000, 350))).toBeCloseTo(-20, 1);
  });
  it("reports a gate behind as about ±180", () => {
    expect(Math.abs(relativeBearing(REF, 180, north))).toBeCloseTo(180, 3);
  });
});

describe("ecefToGeodetic", () => {
  it("matches AFS4's own altitude for its world position (WGS84)", () => {
    // Live at KDAG, 2026-10-19: the DLL said altitude 652.34 m for this position.
    const g = ecefToGeodetic(-2366833.23, -4674369.61, 3626115.78);
    expect(g.lat).toBeCloseTo(34.8666958, 6);
    expect(g.lon).toBeCloseTo(-116.8550439, 6);
    expect(g.heightM).toBeCloseTo(652.34, 1);
  });

  it("handles the equator and the prime meridian", () => {
    const g = ecefToGeodetic(6378137 + 100, 0, 0);
    expect(g.lat).toBeCloseTo(0, 9);
    expect(g.lon).toBeCloseTo(0, 9);
    expect(g.heightM).toBeCloseTo(100, 6);
  });
});
