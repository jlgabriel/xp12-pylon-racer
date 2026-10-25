// The two web lookups the designer needs, done in main so the renderer's CSP keeps connect-src at
// 'self': terrain elevation (Open-Meteo) and place search (Nominatim). Both identify the app in their
// User-Agent, as their usage policies ask. With RPOS the race judges height on X-Plane's own AGL; the
// elevation is the fallback for a fix without one, and what the demo flight and the designer use.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { LonLat } from "../core/geo/geo";
import type { PlaceHit } from "../shared/racerApi";
import { writeFileAtomic } from "./fsAtomic";

const TIMEOUT_MS = 10_000;
const REPO = "https://github.com/jlgabriel/xp12-pylon-racer";
const CACHE_FILE = "elevation-cache.json";
/** 1e-4° ≈ 11 m: the cache grid. */
const GRID = 4;

async function getJson(url: string, version: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": `XPPylonRacer/${version} (+${REPO})` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const key = (p: LonLat): string => `${p.lat.toFixed(GRID)},${p.lon.toFixed(GRID)}`;

/** Terrain elevation (m MSL) at each point. Cached on disk; throws when the network fails. */
export async function elevations(points: readonly LonLat[], cacheDir: string, version: string): Promise<number[]> {
  const file = path.join(cacheDir, CACHE_FILE);
  let cache: Record<string, number> = {};
  try {
    if (existsSync(file)) cache = z.record(z.string(), z.number()).parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    cache = {};
  }
  const missing = [...new Set(points.map(key))].filter((k) => cache[k] === undefined);
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    const lat = batch.map((k) => k.split(",")[0]).join(",");
    const lon = batch.map((k) => k.split(",")[1]).join(",");
    const data = z
      .object({ elevation: z.array(z.number()) })
      .parse(await getJson(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, version));
    if (data.elevation.length !== batch.length) throw new Error("Unexpected elevation response");
    batch.forEach((k, j) => (cache[k] = data.elevation[j]!));
  }
  if (missing.length > 0) {
    try {
      writeFileAtomic(file, JSON.stringify(cache));
    } catch {
      /* the cache is an optimization */
    }
  }
  return points.map((p) => cache[key(p)]!);
}

const nominatimHit = z.object({ display_name: z.string(), lat: z.string(), lon: z.string() });

export async function searchPlaces(query: string, version: string): Promise<PlaceHit[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const data = z
    .array(nominatimHit)
    .parse(await getJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`, version));
  return data.map((h) => ({ label: h.display_name, lon: Number(h.lon), lat: Number(h.lat) }));
}
