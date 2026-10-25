import { describe, expect, it } from "vitest";
import { haversine } from "../src/core/geo/geo";
import { metersPerWorldPx, tileZoomFor, tilesCovering, worldPx } from "../src/core/geo/tiles";

describe("web mercator tiles", () => {
  it("projects the corners and the center of the world", () => {
    expect(worldPx({ lon: 0, lat: 0 })).toEqual({ x: 128, y: 128 });
    expect(worldPx({ lon: -180, lat: 85.0511287798 }).x).toBeCloseTo(0, 6);
    expect(worldPx({ lon: -180, lat: 85.0511287798 }).y).toBeCloseTo(0, 6);
    expect(worldPx({ lon: 180, lat: -85.0511287798 }).y).toBeCloseTo(256, 6);
  });

  it("puts KDAG in the slippy tile any map server would", () => {
    // The textbook OSM formula, written independently of worldPx().
    const lon = -116.787;
    const lat = (34.853 * Math.PI) / 180;
    const n = 2 ** 15;
    const x = Math.floor(((lon + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n);
    expect([x, y]).toEqual([5753, 12995]);
    const p = worldPx({ lon, lat: 34.853 });
    const [t] = tilesCovering(p.x, p.y, p.x, p.y, 15);
    expect(t).toMatchObject({ z: 15, x, y });
  });

  it("covers a box with every tile it touches", () => {
    const tiles = tilesCovering(1.1, 2.2, 3.9, 2.9, 8); // tile side is 1 world px at zoom 8
    expect(tiles.map((t) => `${t.x},${t.y}`)).toEqual(["1,2", "2,2", "3,2"]);
  });

  it("wraps columns across the antimeridian but keeps their position", () => {
    const tiles = tilesCovering(-0.5, 0, 0.5, 0, 8);
    expect(tiles.map((t) => [t.x, t.left])).toEqual([
      [255, -1],
      [0, 0],
    ]);
  });

  it("chooses a zoom whose tiles are drawn at native size or larger", () => {
    expect(tileZoomFor(2 ** 14, 19)).toBe(14);
    expect(tileZoomFor(2 ** 14 + 1, 19)).toBe(15);
    expect(tileZoomFor(2 ** 25, 19)).toBe(19);
    expect(tileZoomFor(0.1, 19)).toBe(0);
  });

  it("measures a world pixel on the ground", () => {
    // One world pixel east is 360/256 degrees of longitude; haversine agrees on the same sphere.
    const step = 360 / 256;
    expect(metersPerWorldPx(0)).toBeCloseTo(haversine({ lon: 0, lat: 0 }, { lon: step, lat: 0 }), 0);
    expect(metersPerWorldPx(60)).toBeCloseTo(metersPerWorldPx(0) / 2, 6);
  });
});
