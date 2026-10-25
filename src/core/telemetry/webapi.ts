// X-Plane 12's Web API (12.1.1 and later), only for what RPOS does not say: which aircraft is flying.
// developer.x-plane.com, "X-Plane Web API": a built-in web server on port 8086, local connections
// only, switched off by Settings › Network › "Disable Incoming Traffic". A dataref is looked up by
// name to get its numeric id, then read by id. Byte-array datarefs (the aircraft's names) come back
// base64-encoded. Before a flight is loaded the lookups answer 404.
//
// The API's version in the path has moved (v1, v2, v3 across 12.x); the hub tries them newest first
// and keeps the one that answers. Probe H0 records which one Juan's 12.4.3 serves.

export const WEB_API_PORT = 8086;
export const WEB_API_VERSIONS = ["v3", "v2", "v1"] as const;
export type WebApiVersion = (typeof WEB_API_VERSIONS)[number];

/** The ICAO type code of the loaded aircraft, as its .acf declares it (classes.ts keys on it). */
export const AIRCRAFT_ICAO = "sim/aircraft/view/acf_ICAO";

export function lookupUrl(host: string, port: number, version: WebApiVersion, name: string): string {
  return `http://${host}:${port}/api/${version}/datarefs?filter%5Bname%5D=${encodeURIComponent(name)}`;
}

export function valueUrl(host: string, port: number, version: WebApiVersion, id: number): string {
  return `http://${host}:${port}/api/${version}/datarefs/${id}/value`;
}

/** The id in a lookup answer (`{ data: [{ id, name, value_type }] }`), or null. */
export function idFromLookup(body: unknown): number | null {
  const first = (body as { data?: unknown } | null)?.data;
  const hit = Array.isArray(first) ? (first[0] as { id?: unknown } | undefined) : undefined;
  return typeof hit?.id === "number" ? hit.id : null;
}

/** A byte-array value (`{ data: "<base64>" }`) as text, up to the first NUL; null when empty or
 *  not text. */
export function textFromValue(body: unknown): string | null {
  const data = (body as { data?: unknown } | null)?.data;
  if (typeof data !== "string") return null;
  let bytes: string;
  try {
    bytes = atob(data);
  } catch {
    return null;
  }
  const text = bytes.replace(/\0.*$/s, "").trim();
  return text !== "" && /^[\x20-\x7e]+$/.test(text) ? text : null;
}
