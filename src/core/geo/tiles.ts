// Web Mercator ("slippy map") math for drawing map tiles under an SVG. World pixels are the zoom-0
// frame: the whole world is TILE_PX × TILE_PX, x grows east, y grows SOUTH (screen order).
import { EARTH_RADIUS_M, type LonLat, type Xy } from "./geo";

export const TILE_PX = 256;
/** Web Mercator stops at ±85.0511° so the world is square. */
const MAX_LAT = 85.0511287798;

/** Zoom-0 world pixel of a position. */
export function worldPx(p: LonLat): Xy {
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((p.lon + 180) / 360) * TILE_PX,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE_PX,
  };
}

export interface Tile {
  z: number;
  /** Tile column, wrapped into [0, 2^z). */
  x: number;
  y: number;
  /** Top-left corner in world pixels (unwrapped, so it lines up with the area asked for). */
  left: number;
  top: number;
  /** Side in world pixels. */
  size: number;
}

/** The tile zoom whose tiles drawn at `scale` (screen px per world px) are at least native size. */
export function tileZoomFor(scale: number, maxZoom: number): number {
  return Math.max(0, Math.min(maxZoom, Math.ceil(Math.log2(Math.max(scale, 1)))));
}

/** Tiles at zoom z covering the world-pixel box [x0, x1] × [y0, y1]. */
export function tilesCovering(x0: number, y0: number, x1: number, y1: number, z: number): Tile[] {
  const n = 2 ** z;
  const size = TILE_PX / n;
  const out: Tile[] = [];
  const ty0 = Math.max(0, Math.floor(y0 / size));
  const ty1 = Math.min(n - 1, Math.floor(y1 / size));
  for (let tx = Math.floor(x0 / size); tx <= Math.floor(x1 / size); tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      out.push({ z, x: ((tx % n) + n) % n, y: ty, left: tx * size, top: ty * size, size });
    }
  }
  return out;
}

/** Ground meters in one zoom-0 world pixel at a latitude. */
export function metersPerWorldPx(lat: number): number {
  return (2 * Math.PI * EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180)) / TILE_PX;
}
