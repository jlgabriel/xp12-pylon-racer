/**
 * Build probe H1: our own pylons, as a scenery pack, on runway 17L at SCEL.
 *
 *   npm run probe:pack
 *
 * Writes probes/H1/XPR_H1_Pylons/, which goes into `Custom Scenery/` as it is. Every byte in it is
 * generated here: three pylon objects, their PNG paint, and one binary DSF from XOP's writer. No
 * DSFTool, no stock asset copied (the control tower is referenced by its library path, not
 * shipped).
 */

import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { tilePath, dsfTileOf } from '../../src/core/dsf/tile.js';
import { writeDsfBinary } from '../../src/core/dsf/writeDsfBinary.js';
import type { PlacedObject } from '../../src/core/model.js';
import { pylonObj } from '../../src/core/pylon/obj8.js';
import { bandPixels, encodePng, type Rgb } from '../../src/core/pylon/texture.js';
import {
  CONTROL_TOWER,
  GATES,
  PYLON_BASE_RADIUS_M,
  PYLON_HEIGHT_M,
  PYLON_TOP_RADIUS_M,
  type PylonColor,
} from '../course.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = 'XPR_H1_Pylons';
const root = join(HERE, PACK);

const WHITE: Rgb = [245, 245, 245];
const PAINT: Record<PylonColor, Rgb> = {
  green: [30, 170, 70],
  red: [225, 45, 45],
  orange: [245, 130, 20],
};

rmSync(root, { recursive: true, force: true });
mkdirSync(join(root, 'objects'), { recursive: true });

console.log('Objects:');
for (const [color, rgb] of Object.entries(PAINT) as [PylonColor, Rgb][]) {
  // Five bands, colour at the foot and the top: reads as a pylon, and upside down looks the same,
  // so a flipped texture cannot make the probe fail for the wrong reason.
  const png = encodePng(8, 64, bandPixels({ colors: [rgb, WHITE, rgb, WHITE, rgb], width: 8, height: 64 }), (b) =>
    new Uint8Array(deflateSync(b)),
  );
  writeFileSync(join(root, 'objects', `pylon_${color}.png`), png);

  const obj = pylonObj({
    heightM: PYLON_HEIGHT_M,
    baseRadiusM: PYLON_BASE_RADIUS_M,
    topRadiusM: PYLON_TOP_RADIUS_M,
    sides: 16,
    texture: `pylon_${color}.png`,
  });
  selfCheck(color, obj);
  writeFileSync(join(root, 'objects', `pylon_${color}.obj`), obj, 'latin1');
}

const objects: PlacedObject[] = [
  ...GATES.flatMap((g) => [
    { id: `g${g.n}L`, libraryPath: `objects/pylon_${g.color}.obj`, position: g.left, rotation: 0 },
    { id: `g${g.n}R`, libraryPath: `objects/pylon_${g.color}.obj`, position: g.right, rotation: 0 },
  ]),
  { id: 'tower', libraryPath: CONTROL_TOWER.libraryPath, position: CONTROL_TOWER.position, rotation: 0 },
];

const tile = dsfTileOf(GATES[0]!.left);
const dsf = join(root, tilePath(tile));
mkdirSync(dirname(dsf), { recursive: true });
const bytes = writeDsfBinary({
  tile,
  objects,
  creationAgent: 'XPR-H1',
  md5: (b) => new Uint8Array(createHash('md5').update(b).digest()),
});
writeFileSync(dsf, bytes);

console.log(`\nPack: ${root}`);
console.log(`  ${tilePath(tile)}  ${bytes.length} bytes, ${objects.length} objects`);
for (const o of objects) {
  console.log(`  ${o.id.padEnd(6)} ${o.position.lat.toFixed(7)}, ${o.position.lon.toFixed(7)}  ${o.libraryPath}`);
}
console.log(`\nRead ${join(HERE, 'FLIGHT.md')} before installing it.`);

/** Measure our own object back, and refuse to ship one that is not the pylon we meant. */
function selfCheck(name: string, text: string): void {
  const vts = text.split('\n').filter((l) => /^VT\s/.test(l)).map((l) => l.split(/\s+/).slice(1, 4).map(Number));
  const ys = vts.map((v) => v[1]!);
  const radius = Math.max(...vts.map((v) => Math.hypot(v[0]!, v[2]!)));
  const height = Math.max(...ys) - Math.min(...ys);
  if (Math.abs(height - PYLON_HEIGHT_M) > 1e-3 || Math.abs(radius - PYLON_BASE_RADIUS_M) > 1e-3 || Math.min(...ys) !== 0) {
    throw new Error(`${name}: measured h ${height} r ${radius} foot ${Math.min(...ys)}`);
  }
  console.log(`  pylon_${name.padEnd(7)} ${height} m tall, ${radius * 2} m across at the foot, ${vts.length} vertices, verified`);
}
