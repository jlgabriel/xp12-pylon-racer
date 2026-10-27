/** Race time as m:ss.cc (or h:mm:ss.cc past an hour). */
export function fmtTime(s: number): string {
  const cs = Math.max(0, Math.round(s * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const sec = Math.floor((cs % 6000) / 100);
  const frac = cs % 100;
  const mm = h > 0 ? `${h}:${String(m).padStart(2, "0")}` : String(m).padStart(2, "0");
  return `${mm}:${String(sec).padStart(2, "0")}.${String(frac).padStart(2, "0")}`;
}

/** Signed delta in seconds; a true minus sign so the column lines up. */
export function fmtDelta(d: number): string {
  const v = Math.abs(d).toFixed(2);
  return d < 0 ? `−${v}` : `+${v}`;
}

export function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const KMH_PER_MS = 3.6;
