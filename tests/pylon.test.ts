import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { pylonObj } from '../src/core/pylon/obj8.js';
import { bandPixels, crc32, encodePng } from '../src/core/pylon/texture.js';

const SHAPE = { heightM: 20, baseRadiusM: 1.2, topRadiusM: 0.5, sides: 16, texture: 'pylon_red.png' };

function vertices(obj: string): number[][] {
  return obj
    .split('\n')
    .filter((l) => /^VT\t/.test(l))
    .map((l) => l.split('\t').slice(1).map(Number));
}

describe('pylonObj', () => {
  const obj = pylonObj(SHAPE);

  it('stands on its origin, exactly as tall and as wide as asked', () => {
    const v = vertices(obj);
    expect(Math.min(...v.map((p) => p[1]!))).toBe(0);
    expect(Math.max(...v.map((p) => p[1]!))).toBe(20);
    expect(Math.max(...v.map((p) => Math.hypot(p[0]!, p[2]!)))).toBeCloseTo(1.2, 6);
  });

  it('declares the counts it writes, and every index points at a vertex', () => {
    const counts = obj.match(/^POINT_COUNTS\t(\d+)\t0\t0\t(\d+)$/m)!;
    const idx = obj.split('\n').filter((l) => l.startsWith('IDX\t')).map((l) => Number(l.slice(4)));
    expect(vertices(obj)).toHaveLength(Number(counts[1]));
    expect(idx).toHaveLength(Number(counts[2]));
    expect(Math.max(...idx)).toBeLessThan(Number(counts[1]));
    expect(obj).toMatch(new RegExp(`^TRIS\\t0\\t${idx.length}$`, 'm'));
  });

  it('is tab-separated, names its texture, and has the OBJ8 header', () => {
    expect(obj.startsWith('A\n800\nOBJ\n')).toBe(true);
    expect(obj).toMatch(/^TEXTURE\tpylon_red\.png$/m);
    expect(obj).not.toMatch(/^VT /m);
  });

  it('maps the texture foot to top: t is 0 on the ground and 1 at the top', () => {
    for (const [, y, , , , , , t] of vertices(obj)) expect(t).toBe(y === 0 ? 0 : 1);
  });

  it('refuses a shape that is not a pylon', () => {
    expect(() => pylonObj({ ...SHAPE, heightM: 0 })).toThrow();
    expect(() => pylonObj({ ...SHAPE, sides: 2 })).toThrow();
  });
});

describe('pylon texture', () => {
  it('puts the first band at the BOTTOM of the image, where OBJ8 samples t = 0', () => {
    const px = bandPixels({ colors: [[255, 0, 0], [0, 0, 255]], width: 2, height: 4 });
    const rowColor = (row: number) => Array.from(px.subarray(row * 8, row * 8 + 3));
    expect(rowColor(3)).toEqual([255, 0, 0]);
    expect(rowColor(0)).toEqual([0, 0, 255]);
  });

  it('writes a PNG whose chunks check out and whose pixels come back', () => {
    const px = bandPixels({ colors: [[10, 20, 30], [200, 210, 220]], width: 8, height: 64 });
    const png = encodePng(8, 64, px, (b) => new Uint8Array(deflateSync(b)));
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const view = new DataView(png.buffer, png.byteOffset);
    let at = 8;
    let idat: Uint8Array | null = null;
    const types: string[] = [];
    while (at < png.length) {
      const len = view.getUint32(at);
      const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
      expect(view.getUint32(at + 8 + len)).toBe(crc32(png.subarray(at + 4, at + 8 + len)));
      if (type === 'IDAT') idat = png.subarray(at + 8, at + 8 + len);
      types.push(type);
      at += 12 + len;
    }
    expect(types).toEqual(['IHDR', 'IDAT', 'IEND']);

    const raw = inflateSync(idat!);
    expect(raw.length).toBe(64 * (8 * 4 + 1));
    expect(raw[0]).toBe(0); // filter type
    expect(Array.from(raw.subarray(1, 5))).toEqual([200, 210, 220, 255]); // top row = last band
  });

  it('crc32 matches the published check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});
