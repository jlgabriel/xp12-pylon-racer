// Aircraft classes: rankings compare runs within a class only. The keys are ICAO type codes exactly
// as an aircraft's .acf declares them (`P acf/_ICAO`, the value of the dataref
// sim/aircraft/view/acf_ICAO), READ FROM DISK — never typed from memory: a wrong key just falls
// through to "unclassified" without any error. Source: the Aircraft folder of an X-Plane 12.4.3
// installation (Laminar's fleet and the add-ons beside it), 2026-10-24. Codes are matched without
// case: the Vertigo Extra declares "Extra", the X-Trident Chinook "ch47".
//
// In X-Plane anyone can install any .acf, so the table is a head start, not a catalogue. Anything
// else gets a class from the pilot, remembered by its code (ClassChoices).

export const AIRCRAFT_CLASSES = [
  { id: "aerobatic", label: "Aerobatic" },
  { id: "vintage", label: "Vintage & warbird" },
  { id: "ga", label: "General aviation" },
  { id: "jet", label: "Jet" },
  { id: "helicopter", label: "Helicopter" },
  { id: "glider", label: "Glider" },
  { id: "heavy", label: "Heavy" },
] as const;

export type AircraftClassId = (typeof AIRCRAFT_CLASSES)[number]["id"];

const CODES: Readonly<Record<AircraftClassId, readonly string[]>> = {
  aerobatic: ["EXTRA", "RV8", "CT4", "F260"],
  vintage: ["CAML", "P51", "L5", "HP52", "DC3", "WAJU", "G21"],
  ga: [
    "C172", "C152", "PA18", "BE58", "BE9L", "SR22", "S22T", "RV10", "EVOT", "ALIA", "DA40", "DA42", "DA50",
    "DA62", "DV20", "DR40", "P28A", "P28R", "P28U", "PA34", "PA44", "PA31", "BE33", "BE36", "BE76", "TOBA",
    "LEG2", "SIRA", "M7", "C208", "PC12", "B350", "DHC2", "PC6T", "C337", "AEST", "L200", "SHRK", "EFOX",
    "AP22", "FDCT", "U15", "PZ4M", "BN2P", "EPIC", "EVIC", "P46T", "750T", "Y18T",
  ],
  jet: [
    "SF50", "C750", "C510", "C525", "E55P", "VIPJ", "LJ35", "CL60", "F22", "F-35B", "F16", "F104", "M346",
    "T-7A", "SF-37", "H162", "BD5J", "SR71",
  ],
  helicopter: ["R22", "R44", "R66", "S76", "222B", "222UT", "H269", "B407", "MD902", "LAMA", "G2CA", "A109", "412", "CH47", "REV5", "DYH3", "HC02"],
  glider: ["AS21", "SF25"],
  heavy: [
    "B738", "A333", "MD82", "MD88", "MD11", "A319", "A20N", "A321", "A339", "A346", "B732", "B742", "B748",
    "B752", "B753", "B762", "B763", "B764", "B772", "B77W", "B77L", "DH8D", "CRJ7", "CRJX", "E170", "E175",
    "E190", "E195", "E135", "E140", "E145", "E45X", "B461", "B462", "B463", "CONC",
  ],
};

const CLASS_OF: ReadonlyMap<string, AircraftClassId> = new Map(
  (Object.entries(CODES) as [AircraftClassId, readonly string[]][]).flatMap(([cls, codes]) => codes.map((c) => [c.toUpperCase(), cls] as const)),
);

/** The class of a known aircraft, or null for one we do not know. */
export function classOfAircraft(aircraftId: string | null): AircraftClassId | null {
  if (!aircraftId) return null;
  return CLASS_OF.get(aircraftId.trim().toUpperCase()) ?? null;
}

export function classLabel(id: string | null): string {
  return AIRCRAFT_CLASSES.find((c) => c.id === id)?.label ?? "Unclassified";
}

export function isClassId(id: unknown): id is AircraftClassId {
  return AIRCRAFT_CLASSES.some((c) => c.id === id);
}

/** Classes the pilot chose where the app cannot tell: aircraft it does not know, and flying with no
 *  aircraft name (X-Plane's Web API off or unreachable). Known aircraft keep their own class. */
export interface ClassChoices {
  aircraft: Readonly<Record<string, string>>;
  noAircraft: string | null;
}

export const NO_CHOICES: ClassChoices = { aircraft: {}, noAircraft: null };

/** The class a run with this aircraft is ranked in; null = unclassified. */
export function resolveClass(aircraftId: string | null, choices: ClassChoices): AircraftClassId | null {
  if (!aircraftId) return isClassId(choices.noAircraft) ? choices.noAircraft : null;
  const chosen = choices.aircraft[aircraftId];
  return classOfAircraft(aircraftId) ?? (isClassId(chosen) ? chosen : null);
}
