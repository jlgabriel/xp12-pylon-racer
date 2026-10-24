/**
 * A pylon's paint: horizontal bands, written as a PNG.
 *
 * X-Plane reads PNG textures directly, and a banded image this small does not need DDS. The PNG is
 * encoded here rather than by a library because the whole format needed is ~40 lines: one IHDR,
 * one IDAT, one IEND. `deflate` is injected for the same reason XOP injects md5 into its DSF
 * writer — `src/core` stays free of Node builtins.
 */

export type Rgb = readonly [number, number, number];

export interface Bands {
  /** Colours from the FOOT of the pylon to the TOP. */
  readonly colors: readonly Rgb[];
  /** Power-of-two sizes: the safe choice for any GPU texture. */
  readonly width: number;
  readonly height: number;
}

/**
 * RGBA pixels, first row at the top of the image.
 *
 * OBJ8 samples t = 0 at the bottom of the image, so the FIRST band (the foot) is drawn at the
 * BOTTOM rows here. Getting this backwards does not error; it paints the pylon upside down.
 */
export function bandPixels({ colors, width, height }: Bands): Uint8Array {
  if (colors.length === 0) throw new Error('A pylon needs at least one colour.');
  const pixels = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const fromFoot = height - 1 - row;
    const band = Math.min(colors.length - 1, Math.floor((fromFoot / height) * colors.length));
    const [r, g, b] = colors[band]!;
    for (let col = 0; col < width; col++) {
      const at = (row * width + col) * 4;
      pixels[at] = r;
      pixels[at + 1] = g;
      pixels[at + 2] = b;
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}

/** An 8-bit RGBA PNG. `deflate` must produce a zlib stream (RFC 1950), as `zlib.deflateSync` does. */
export function encodePng(
  width: number,
  height: number,
  rgba: Uint8Array,
  deflate: (bytes: Uint8Array) => Uint8Array,
): Uint8Array {
  if (rgba.length !== width * height * 4) throw new Error('Pixel buffer does not match the size.');

  // Every scanline starts with filter type 0 (none).
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let row = 0; row < height; row++) {
    raw.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), row * (width * 4 + 1) + 1);
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8); // bit depth 8, colour type 6 (RGBA), deflate, adaptive, no interlace

  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
