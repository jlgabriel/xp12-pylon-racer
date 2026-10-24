/**
 * The placement types the DSF writer speaks, in X-Plane's vocabulary.
 *
 * Taken from xp12-object-placer (XOP) `src/core/model.ts`, GPL-3.0-or-later, trimmed to what the
 * copied DSF code imports. The course model (gates, rules, runs) comes from Pylon Racer later and
 * lives elsewhere; this file stays about objects on the ground.
 */

/** A point on Earth. Longitude first, matching the DSF `OBJECT` line. */
export interface LonLat {
  readonly lon: number;
  readonly lat: number;
}

/**
 * One object placed in the world.
 *
 * `libraryPath` is the `OBJECT_DEF` string verbatim: either a library virtual path
 * (`lib/airport/…`) or a file relative to the pack's root (`objects/pylon_red.obj`). XOP only ever
 * wrote the first kind; Pylon Racer's own pylons are the second — probe H1 is what proves the
 * copied writer handles it.
 *
 * `rotation` is the fourth argument of the DSF `OBJECT` command: degrees clockwise from the
 * model's authored orientation (XOP probe H0b). A pylon is round, so it is always 0 here.
 */
export interface PlacedObject {
  readonly id: string;
  readonly libraryPath: string;
  readonly position: LonLat;
  readonly rotation: number;
  readonly label?: string;
}
