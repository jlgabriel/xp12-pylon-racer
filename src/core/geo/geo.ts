// Geographic and planar geometry. Angles in degrees, distances in meters, spherical Earth (one
// radius everywhere so haversine, destination and the local projection agree with each other; over
// a race course of a few km the error is centimeters).
//
// Conventions:
// - LonLat stores named fields: AFS4's UDP and scenery files use lon,lat order, so positional pairs
//   invite the classic swap bug.
// - The local frame is east-north meters (x = east, y = north), an equirectangular projection about
//   a reference point.
// - A bearing/heading is a compass azimuth: 0 = north, 90 = east.

export const EARTH_RADIUS_M = 6371008.8;

export interface LonLat {
  lon: number;
  lat: number;
}

/** Planar point in the local east-north frame, meters. */
export interface Xy {
  x: number;
  y: number;
}

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Normalize an angle to [0, 360). */
export function wrap360(a: number): number {
  return ((a % 360) + 360) % 360;
}

/** Normalize an angle to (-180, 180]. */
export function wrap180(a: number): number {
  const w = wrap360(a);
  return w > 180 ? w - 360 : w;
}

/** Interpolate between two angles along the shorter arc; f in [0, 1]. Result in (-180, 180]. */
export function lerpAngle(a: number, b: number, f: number): number {
  return wrap180(a + wrap180(b - a) * f);
}

export function haversine(a: LonLat, b: LonLat): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Initial great-circle bearing from a to b, [0, 360). */
export function initialBearing(a: LonLat, b: LonLat): number {
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLon) * Math.cos(lat2);
  const y = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return wrap360(deg(Math.atan2(x, y)));
}

/** Where `to` lies relative to the nose of an aircraft at `from`: (-180, 180], negative = left. */
export function relativeBearing(from: LonLat, headingDeg: number, to: LonLat): number {
  return wrap180(initialBearing(from, to) - headingDeg);
}

/** Point reached from p after distanceM along bearingDeg. */
export function destination(p: LonLat, distanceM: number, bearingDeg: number): LonLat {
  const ang = distanceM / EARTH_RADIUS_M;
  const br = rad(bearingDeg);
  const lat1 = rad(p.lat);
  const lon1 = rad(p.lon);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br));
  const lon2 =
    lon1 + Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
  return { lon: deg(lon2), lat: deg(lat2) };
}

export function toLocal(p: LonLat, ref: LonLat): Xy {
  return {
    x: rad(p.lon - ref.lon) * Math.cos(rad(ref.lat)) * EARTH_RADIUS_M,
    y: rad(p.lat - ref.lat) * EARTH_RADIUS_M,
  };
}

export function fromLocal(q: Xy, ref: LonLat): LonLat {
  return {
    lat: ref.lat + deg(q.y / EARTH_RADIUS_M),
    lon: ref.lon + deg(q.x / (EARTH_RADIUS_M * Math.cos(rad(ref.lat)))),
  };
}

export interface Intersection {
  point: Xy;
  /** Parameter along the first segment p1→p2, in [0, 1]. */
  t: number;
  /** Parameter along the second segment q1→q2, in [0, 1]. */
  u: number;
}

/** Crossing of segments p1→p2 and q1→q2, or null. Parallel/collinear segments give null. */
export function segmentIntersection(p1: Xy, p2: Xy, q1: Xy, q2: Xy): Intersection | null {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const rxs = rx * sy - ry * sx;
  if (Math.abs(rxs) < 1e-12) return null;
  const qpx = q1.x - p1.x;
  const qpy = q1.y - p1.y;
  const t = (qpx * sy - qpy * sx) / rxs;
  const u = (qpx * ry - qpy * rx) / rxs;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { point: { x: p1.x + t * rx, y: p1.y + t * ry }, t, u };
}

/**
 * The two pylons of a gate. headingDeg is the direction the pilot flies THROUGH the gate; the gate
 * line is perpendicular to it. Left/right are from the pilot's point of view.
 */
export function pylonsOfGate(center: LonLat, widthM: number, headingDeg: number): { left: LonLat; right: LonLat } {
  const half = widthM / 2;
  return {
    left: destination(center, half, headingDeg - 90),
    right: destination(center, half, headingDeg + 90),
  };
}

/** Unit vector (east, north) along a heading. */
export function forwardUnit(headingDeg: number): Xy {
  const br = rad(headingDeg);
  return { x: Math.sin(br), y: Math.cos(br) };
}

export function centroid(points: readonly LonLat[]): LonLat {
  if (points.length === 0) return { lon: 0, lat: 0 };
  let lon = 0;
  let lat = 0;
  for (const p of points) {
    lon += p.lon;
    lat += p.lat;
  }
  return { lon: lon / points.length, lat: lat / points.length };
}

/**
 * Earth-centered cartesian coordinates (m, WGS84 ECEF: x toward 0°E on the equator, z toward the
 * north pole) to geodetic lon/lat (Bowring's formula, sub-millimeter at aircraft heights) and the
 * height above the ellipsoid. This one place uses the ellipsoid, not the sphere: AFS4's world
 * position is WGS84, and the geocentric latitude would be off by ~20 km at mid latitudes.
 */
export function ecefToGeodetic(x: number, y: number, z: number): LonLat & { heightM: number } {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const b = a * (1 - f);
  const e2 = f * (2 - f);
  const ep2 = (a * a - b * b) / (b * b);
  const p = Math.hypot(x, y);
  const th = Math.atan2(z * a, p * b);
  const lat = Math.atan2(z + ep2 * b * Math.sin(th) ** 3, p - e2 * a * Math.cos(th) ** 3);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return { lon: (Math.atan2(y, x) * 180) / Math.PI, lat: (lat * 180) / Math.PI, heightM: p / Math.cos(lat) - n };
}
