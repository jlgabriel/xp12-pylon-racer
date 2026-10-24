/**
 * A pylon, written out as OBJ8 text.
 *
 * Generated, never copied: the pylons this app installs are its own geometry, so nothing from
 * Laminar, IPACS or any other artist travels in a pack (docs/DESIGN.md D5). A tapered, many-sided
 * tube with a lid is all an air-race pylon is, and generating it means its height and radius are
 * known exactly — which is what "pylon hit" needs and what the Aerofly app never had.
 *
 * X-Plane axes: +X east, +Y up, +Z south, metres, origin on the ground at the pylon's centre.
 * Fields are TAB-separated (XOP reference/obj8.md: a space-separated VT parses to nothing).
 */

export interface PylonShape {
  readonly heightM: number;
  readonly baseRadiusM: number;
  readonly topRadiusM: number;
  /** Facets around the tube. 16 reads as round from a cockpit and costs 64 triangles. */
  readonly sides: number;
  /** File name of the texture, relative to the .obj. */
  readonly texture: string;
}

/**
 * The OBJ8 text for one pylon.
 *
 * The texture's t runs 0 at the foot to 1 at the top (OBJ8 puts v = 0 at the bottom of the image),
 * so painted bands land at the heights the texture says. s goes once around the tube.
 *
 * `ATTR_no_cull` on purpose: which winding X-Plane treats as the front face has not been probed,
 * and a pylon drawn inside-out would cost a flight to notice. Back faces of a 16-sided tube are
 * free.
 */
export function pylonObj(shape: PylonShape): string {
  const { heightM, baseRadiusM, topRadiusM, sides, texture } = shape;
  if (!(heightM > 0) || !(baseRadiusM > 0) || !(topRadiusM >= 0) || sides < 3) {
    throw new Error(`Not a pylon: ${JSON.stringify(shape)}`);
  }

  const vertices: string[] = [];
  const indices: number[] = [];
  const vt = (x: number, y: number, z: number, nx: number, ny: number, nz: number, s: number, t: number): number => {
    vertices.push(['VT', x, y, z, nx, ny, nz, s, t].map(fmt).join('\t'));
    return vertices.length - 1;
  };

  // The side's normal leans up by the taper, so a cone lights like a cone.
  const slope = (baseRadiusM - topRadiusM) / heightM;
  const ny = slope / Math.hypot(1, slope);
  const nh = 1 / Math.hypot(1, slope);

  // One extra column closes the seam: the last column repeats the first with s = 1.
  const ring: { foot: number; top: number }[] = [];
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * 2 * Math.PI;
    const cx = Math.sin(a);
    const cz = -Math.cos(a);
    ring.push({
      foot: vt(cx * baseRadiusM, 0, cz * baseRadiusM, cx * nh, ny, cz * nh, i / sides, 0),
      top: vt(cx * topRadiusM, heightM, cz * topRadiusM, cx * nh, ny, cz * nh, i / sides, 1),
    });
  }
  for (let i = 0; i < sides; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    indices.push(a.foot, b.foot, b.top, a.foot, b.top, a.top);
  }

  // The lid samples the very top of the texture, so it takes the top band's colour.
  if (topRadiusM > 0) {
    const centre = vt(0, heightM, 0, 0, 1, 0, 0.5, 1);
    const rim: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * 2 * Math.PI;
      rim.push(vt(Math.sin(a) * topRadiusM, heightM, -Math.cos(a) * topRadiusM, 0, 1, 0, 0.5, 1));
    }
    for (let i = 0; i < sides; i++) indices.push(centre, rim[(i + 1) % sides]!, rim[i]!);
  }

  return [
    'A',
    '800',
    'OBJ',
    '',
    `TEXTURE\t${texture}`,
    `POINT_COUNTS\t${vertices.length}\t0\t0\t${indices.length}`,
    '',
    ...vertices,
    ...indices.map((i) => `IDX\t${i}`),
    '',
    'ATTR_no_cull',
    `TRIS\t0\t${indices.length}`,
    '',
  ].join('\n');
}

/** Six decimals is a micrometre; `-0` and float noise would only make diffs noisy. */
function fmt(value: number | string): string {
  if (typeof value === 'string') return value;
  const rounded = Math.round(value * 1e6) / 1e6;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
