// A minimal ZIP reader and writer for the app's own exchange file (.pylonrace): a few small JSON
// entries, so no ZIP64, no encryption, no multi-disk. Pure — the deflate codec is passed in
// (node:zlib in main and the tests), so this module carries no Node or browser dependency.
//
// Reading is defensive: these files come from other people. Entries are only ever looked up by
// exact name and kept in memory (never written to disk by name, so no path traversal), every size
// is checked against the buffer and a total cap, and each entry's CRC must match.

export interface ZipCodec {
  deflateRaw(data: Uint8Array): Uint8Array;
  /** Must throw when the output would exceed `maxBytes` (node: `maxOutputLength`). */
  inflateRaw(data: Uint8Array, maxBytes: number): Uint8Array;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Bigger than any course or run we write (a 10-minute run at 40 Hz is ~2 MB of JSON). */
export const MAX_UNZIPPED_BYTES = 64 * 1024 * 1024;

export class ZipError extends Error {}

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;
const FLAG_UTF8 = 0x0800;
const STORE = 0;
const DEFLATE = 8;

/** Write a ZIP with every entry deflated (stored when deflate does not make it smaller). */
export function writeZip(entries: readonly ZipEntry[], codec: ZipCodec, modified = new Date(Date.UTC(2026, 0, 1))): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(modified);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const deflated = codec.deflateRaw(e.data);
    const method = deflated.length < e.data.length ? DEFLATE : STORE;
    const body = method === DEFLATE ? deflated : e.data;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, SIG_LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, FLAG_UTF8, true);
    lv.setUint16(8, method, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, body);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, SIG_CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, FLAG_UTF8, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centrals.push(central);

    offset += local.length + body.length;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, SIG_END, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return concat([...locals, ...centrals, end]);
}

/** Read every entry of a ZIP into memory. Throws ZipError on anything it does not understand. */
export function readZip(bytes: Uint8Array, codec: ZipCodec, maxTotal = MAX_UNZIPPED_BYTES): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (at: number): number => view.getUint16(at, true);
  const u32 = (at: number): number => view.getUint32(at, true);
  const need = (at: number, len: number): void => {
    if (at < 0 || at + len > bytes.length) throw new ZipError("The file is truncated or not a ZIP");
  };

  // The end record is the last 22 bytes, plus a comment of up to 64 KB.
  if (bytes.length < 22) throw new ZipError("Not a ZIP file");
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (u32(at) === SIG_END) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new ZipError("Not a ZIP file");
  const count = u16(end + 10);
  const centralSize = u32(end + 12);
  let at = u32(end + 16);
  if (count === 0xffff || centralSize === 0xffffffff || at === 0xffffffff) throw new ZipError("ZIP64 files are not supported");
  need(at, centralSize);

  const dec = new TextDecoder("utf-8", { fatal: false });
  const out: ZipEntry[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    need(at, 46);
    if (u32(at) !== SIG_CENTRAL) throw new ZipError("Damaged ZIP directory");
    const flags = u16(at + 8);
    const method = u16(at + 10);
    const crc = u32(at + 16);
    const compressed = u32(at + 20);
    const size = u32(at + 24);
    const nameLen = u16(at + 28);
    const extraLen = u16(at + 30);
    const commentLen = u16(at + 32);
    const localAt = u32(at + 42);
    need(at + 46, nameLen);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;

    if (flags & 0x0001) throw new ZipError(`${name} is encrypted`);
    if (name.endsWith("/")) continue; // a folder entry
    total += size;
    if (total > maxTotal) throw new ZipError("The file unpacks to more than this app ever writes");

    need(localAt, 30);
    if (u32(localAt) !== SIG_LOCAL) throw new ZipError(`Damaged ZIP entry ${name}`);
    const dataAt = localAt + 30 + u16(localAt + 26) + u16(localAt + 28);
    need(dataAt, compressed);
    const raw = bytes.subarray(dataAt, dataAt + compressed);

    let data: Uint8Array;
    if (method === STORE) data = raw.slice();
    else if (method === DEFLATE) {
      try {
        data = codec.inflateRaw(raw, size);
      } catch {
        throw new ZipError(`Couldn't unpack ${name}`);
      }
    } else throw new ZipError(`${name} uses an unsupported compression method (${method})`);
    if (data.length !== size || crc32(data) !== crc) throw new ZipError(`${name} is damaged (checksum mismatch)`);
    out.push({ name, data });
  }
  return out;
}

/** Does this look like a ZIP (local-file signature "PK\3\4")? */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

let crcTable: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time fields (local fields, 2-second resolution, 1980 at the earliest). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getUTCFullYear());
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
