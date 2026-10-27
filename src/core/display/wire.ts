// The in-sim display's wire format: what the app sends the X-Plane plugin, and the plugin's answer.
// The plugin side is plugin/src/protocol.h; the two change together, with the version, and
// plugin/test/fixtures holds these messages for the plugin's own test.
//
// The plugin only draws: the race is judged here, and the words are the race screen's own
// (rulesText.ts), so the window and the sim never say different things.
import { courseRevision, type Course } from "../course/course";
import { packPylons } from "../export/pack";
import { fmtDelta, fmtTime } from "../format";
import type { LiveState } from "../session/raceSession";
import type { RaceSnapshot } from "../race/engine";
import { GATE_NAME, dnfText, gateRequirements, penaltyReason } from "../race/rulesText";

export const DISPLAY_PORT = 49710;
export const DISPLAY_PROTOCOL = 1;

type Row = readonly (string | number)[];

function message(kind: string, rows: readonly Row[]): Uint8Array {
  const text = [["XPR", DISPLAY_PROTOCOL, kind], ...rows].map((r) => r.map(field).join("\t")).join("\n");
  return new TextEncoder().encode(text);
}

/** Free text may hold anything but the separators. */
function field(v: string | number): string {
  return typeof v === "number" ? String(v) : v.replace(/[\t\n\r]/g, " ");
}

/** The course as the plugin draws it: gates in order, and every pylon with the gate it belongs to. */
export function courseMessage(course: Course): Uint8Array {
  const gateIndex = new Map(course.gates.map((g, i) => [g.id, i]));
  return message("course", [
    ["name", course.name],
    ["rev", courseRevision(course)],
    ...course.gates.map((g, i) => ["gate", i, g.type, g.center.lat.toFixed(7), g.center.lon.toFixed(7), g.headingDeg.toFixed(1)]),
    ...packPylons(course).map((p) => {
      const gi = gateIndex.get(p.object.id.slice(0, p.object.id.lastIndexOf(".")))!;
      return ["pylon", gi, p.object.position.lat.toFixed(7), p.object.position.lon.toFixed(7)];
    }),
  ]);
}

/** One gate's state on the plugin's map: n next, m missed, d done, t still to fly. */
export function gateStates(course: Course, live: LiveState): string {
  const r = live.race;
  const over = r.status === "finished" || r.status === "dnf";
  const next = over ? null : (live.nextGate?.index ?? null);
  const passed = new Set(r.passes.map((p) => p.gateIndex));
  const missed = new Set(r.penalties.filter((p) => p.kind === "missed-gate").map((p) => p.gateIndex));
  return course.gates.map((_, i) => (i === next ? "n" : missed.has(i) ? "m" : passed.has(i) ? "d" : "t")).join("");
}

/** How the race ended, as the race screen's result says it. best = a new best, done = finished
 *  slower than the best, dnf = did not finish, demo = a demo flight (never ranked). */
export type ResultTone = "best" | "done" | "dnf" | "demo";
export interface ResultCue {
  tone: ResultTone;
  text: string;
}

/** The result of a race that just ended, against the pilot's best in its class before it (null =
 *  none yet). Null while the race has not ended. */
export function resultCue(
  race: Pick<RaceSnapshot, "status" | "total" | "dnfReason" | "passes" | "sequence" | "step">,
  demo: boolean,
  bestBefore: number | null,
): ResultCue | null {
  if (race.status === "dnf") return { tone: "dnf", text: dnfText(race) ?? "did not finish" };
  if (race.status !== "finished") return null;
  const delta = bestBefore !== null ? fmtDelta(race.total - bestBefore) : null;
  if (demo) return { tone: "demo", text: `Demo flight · not ranked${delta ? ` · ${delta}` : ""}` };
  if (bestBefore === null || race.total < bestBefore) return { tone: "best", text: "New best!" };
  return { tone: "done", text: `${delta} vs your best` };
}

/** The race now. `statusText` is the race screen's status line; `demo` = the position is the demo
 *  flight's, so the plugin draws it instead of the sim's; `result` = how it ended, once it has. */
export function liveMessage(course: Course, live: LiveState, statusText: string, demo: boolean, result: ResultCue | null = null): Uint8Array {
  const r = live.race;
  const over = r.status === "finished" || r.status === "dnf";
  const next = over ? null : (live.nextGate?.index ?? null);
  const gate = next !== null ? course.gates[next] : undefined;
  const lap = r.laps > 1 && r.status === "running" ? ` · lap ${r.lap} of ${r.laps}` : "";
  const last = r.penalties[r.penalties.length - 1];
  const fix = live.fix;
  return message("live", [
    ["rev", courseRevision(course)],
    ["status", r.status],
    ["line", statusText],
    ["time", fmtTime(r.total)],
    ["next", next ?? -1],
    ["title", gate ? `${next! + 1} · ${GATE_NAME[gate.type]}${lap}` : ""],
    ["needs", gate ? gateRequirements(gate, course).join(" · ") : ""],
    ["pen", last ? `+${r.penaltyTotal.toFixed(1)} s · gate ${last.gateIndex + 1}: ${penaltyReason(last, course)}` : ""],
    ["gates", gateStates(course, live)],
    ...(result && over ? [["result", result.tone, result.text]] : []),
    ...(fix ? [["fix", fix.lat.toFixed(7), fix.lon.toFixed(7), fix.headingDeg.toFixed(1), demo ? 1 : 0]] : []),
  ]);
}

/** What the plugin says about itself, once a second. */
export interface DisplayHello {
  plugin: string;
  /** X-Plane's version as XPLMGetVersions gives it: 12431 for 12.4.3. */
  xplane: number;
  fps: number | null;
}

/** 12431 -> "12.4.3": XPLMGetVersions packs major, minor and patch (the last digit is the build). */
export function xplaneVersionText(v: number): string {
  return `${Math.floor(v / 1000)}.${Math.floor((v % 1000) / 100)}.${Math.floor((v % 100) / 10)}`;
}

export function parseHello(bytes: Uint8Array): DisplayHello | null {
  const lines = new TextDecoder().decode(bytes).split("\n");
  if (lines[0] !== `XPR\t${DISPLAY_PROTOCOL}\thello`) return null;
  const f = new Map(lines.slice(1).map((l) => [l.slice(0, l.indexOf("\t")), l.slice(l.indexOf("\t") + 1)] as const));
  const plugin = f.get("plugin");
  if (!plugin) return null;
  const fps = Number(f.get("fps"));
  return { plugin, xplane: Number(f.get("xplane")) || 0, fps: Number.isFinite(fps) ? fps : null };
}
