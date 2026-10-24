/**
 * The probe course: three gates across runway 17L at SCEL, one flight's worth.
 *
 * Shared by H1 (which builds the scenery) and H2 (which reads the flight log against it), so the
 * pylons the flier sees and the gates the analysis checks are the same numbers by construction.
 *
 * Why on a runway: it is flat, it is a surveyed line from apt.dat, and "between the pylons" is
 * unmistakable from the cockpit. The pylons stand on the pavement, 40 m apart on a 55 m runway.
 */

import { destination, initialBearing } from '../src/core/geo/geo.js';
import type { LonLat } from '../src/core/model.js';

/** apt.dat, X-Plane 12.4.3 Global Airports, row `100` for SCEL: the two ends of 17L/35R. */
export const RWY_17L: LonLat = { lat: -33.3760605, lon: -70.7867314 };
export const RWY_35R: LonLat = { lat: -33.409835, lon: -70.7849086 };

/** ≈ 177.3° true. Close to south, which is why the heading checks happen in the turns, not here. */
export const RUNWAY_BEARING = initialBearing(RWY_17L, RWY_35R);

export const GATE_WIDTH_M = 40;
export const PYLON_HEIGHT_M = 20;
export const PYLON_BASE_RADIUS_M = 1.2;
export const PYLON_TOP_RADIUS_M = 0.5;

export type PylonColor = 'green' | 'red' | 'orange';

export interface ProbeGate {
  readonly n: number;
  /** Metres from the 17L threshold along the centreline. */
  readonly alongM: number;
  readonly color: PylonColor;
  /** Seen flying 17L (south): left is east, right is west. */
  readonly left: LonLat;
  readonly right: LonLat;
}

function gate(n: number, alongM: number, color: PylonColor): ProbeGate {
  const centre = destination(RWY_17L, alongM, RUNWAY_BEARING);
  return {
    n,
    alongM,
    color,
    left: destination(centre, GATE_WIDTH_M / 2, RUNWAY_BEARING - 90),
    right: destination(centre, GATE_WIDTH_M / 2, RUNWAY_BEARING + 90),
  };
}

/** Far enough down the runway that a C172 is airborne at the first one after a 17L take-off. */
export const GATES: readonly ProbeGate[] = [
  gate(1, 1500, 'green'),
  gate(2, 2000, 'red'),
  gate(3, 2500, 'orange'),
];

/**
 * The positive control: a stock control tower, 150 m east of gate 1. Proven to load in XOP's
 * probes. If it is there and the pylons are not, the pack loaded and the pylon objects did not.
 */
export const CONTROL_TOWER = {
  libraryPath: 'lib/airport/control_towers/small/14m_Sweden.obj',
  position: destination(destination(RWY_17L, 1500, RUNWAY_BEARING), 150, RUNWAY_BEARING - 90),
} as const;
