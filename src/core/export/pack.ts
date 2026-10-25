// A course as an installable X-Plane 12 scenery pack. Pure: this builds the plan, every byte of it;
// main/installer.ts does the file I/O and the scenery_packs.ini line.
//
//   Custom Scenery/XPR_<course id>/
//     objects/pylon_<model>.obj + .png    the generated models the course uses, and only those
//     Earth nav data/<block>/<tile>.dsf    one per 1°×1° tile the pylons touch (XOP's writer)
//
// A DSF OBJECT carries no elevation: X-Plane sets each pylon on whatever mesh is under it, so the
// terrain needs no lookup here (XOP reference/dsf-overlay.md). OBJECT_DEF points at the pack's own
// files by a pack-relative path: probe H1 is the flight that confirms X-Plane resolves it.
import { fnv1a64, type Course } from "../course/course";
import { groupByTile, tilePath } from "../dsf/tile";
import { writeDsfBinary } from "../dsf/writeDsfBinary";
import { pylonsOfGate } from "../geo/geo";
import type { PlacedObject } from "../model";
import { pylonObj } from "../pylon/obj8";
import { bandPixels, encodePng } from "../pylon/texture";
import { pylonFor, type PylonModel } from "./pylons";

/** Marker file written into every pack the app installs; nothing else is ever touched or removed. */
export const MARKER_FILE = "pylon-racer.json";

const PACK_PREFIX = "XPR_";
const SIDES = 16;
/** 8 × 64: bands need height, not width, and powers of two suit every GPU. */
const TEXTURE_W = 8;
const TEXTURE_H = 64;

/** A folder name the app could have produced. Only these, with the marker inside, are ever touched. */
export function isOurPackFolderName(name: string): boolean {
  return /^XPR_[a-z0-9][a-z0-9_-]{0,79}$/.test(name);
}

export function packFolderName(courseId: string): string {
  const slug =
    courseId
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[-_]+|-+$/g, "")
      .slice(0, 80) || "course";
  return PACK_PREFIX + slug;
}

export interface PackFile {
  path: string;
  bytes: Uint8Array;
}

export interface PackPlan {
  packFolder: string;
  files: PackFile[];
  pylonCount: number;
  /** Changes whenever a pylon moves or changes model, even when the course revision does not (a
   *  model of the same height): the installed pack is then out of date. The name is left out. */
  sceneryId: string;
}

export interface PackMarker {
  app: "xp-pylon-racer";
  packName: string;
  courseId: string;
  courseName: string;
  revision: string;
  sceneryId: string;
  installedAt: string;
  appVersion: string;
}

/** What the pack is made of, separately from writing it: pylon by pylon, model and place. */
export function packPylons(course: Course): { model: PylonModel; object: PlacedObject }[] {
  const out: { model: PylonModel; object: PlacedObject }[] = [];
  for (const g of course.gates) {
    const model = pylonFor(g);
    const at = g.type === "turn" ? [g.center] : Object.values(pylonsOfGate(g.center, g.widthM, g.headingDeg));
    at.forEach((position, i) =>
      out.push({ model, object: { id: `${g.id}.${i}`, libraryPath: `objects/pylon_${model.id}.obj`, position, rotation: 0 } }),
    );
  }
  return out;
}

/** Cheap enough for every course list: no geometry, no DSF. */
export function packSceneryId(course: Course): string {
  return fnv1a64(
    packPylons(course)
      .map(({ model, object: o }) => `${model.id} ${o.position.lon.toFixed(7)} ${o.position.lat.toFixed(7)}`)
      .join("\n"),
  );
}

export interface PackDeps {
  /** zlib stream (RFC 1950), as `zlib.deflateSync` gives: the PNGs. */
  deflate: (bytes: Uint8Array) => Uint8Array;
  /** MD5 digest: the DSF footer. */
  md5: (bytes: Uint8Array) => Uint8Array;
  appVersion: string;
}

export function planPack(course: Course, deps: PackDeps): PackPlan {
  const pylons = packPylons(course);
  const files: PackFile[] = [];

  const models = new Map(pylons.map((p) => [p.model.id, p.model]));
  for (const m of [...models.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const png = `pylon_${m.id}.png`;
    const obj = pylonObj({ heightM: m.heightM, baseRadiusM: m.baseRadiusM, topRadiusM: m.topRadiusM, sides: SIDES, texture: png });
    files.push({ path: `objects/pylon_${m.id}.obj`, bytes: latin1(obj) });
    const pixels = bandPixels({ colors: m.bands, width: TEXTURE_W, height: TEXTURE_H });
    files.push({ path: `objects/${png}`, bytes: encodePng(TEXTURE_W, TEXTURE_H, pixels, deps.deflate) });
  }

  for (const { tile, objects } of groupByTile(pylons.map((p) => p.object)).values()) {
    files.push({
      path: tilePath(tile),
      bytes: writeDsfBinary({ tile, objects, creationAgent: `XP Pylon Racer ${deps.appVersion}`, md5: deps.md5 }),
    });
  }

  return { packFolder: packFolderName(course.id), files, pylonCount: pylons.length, sceneryId: packSceneryId(course) };
}

function latin1(text: string): Uint8Array {
  return Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
}
