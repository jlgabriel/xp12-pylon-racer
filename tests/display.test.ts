import { describe, expect, it } from "vitest";
import { courseRevision } from "../src/core/course/course";
import { demoFlight } from "../src/core/demo/demoFlight";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { courseMessage, liveMessage, parseHello, xplaneVersionText } from "../src/core/display/wire";
import { RaceSession, type SessionContext } from "../src/core/session/raceSession";

const ctx: SessionContext = { pilot: "Tester", appVersion: "0.1.0", newId: () => "run-1", nowIso: () => "2026-10-26T12:00:00Z" };
const rules = sampleCourses().find((c) => c.id === "kdag-rules-test")!;

/** A message as the plugin's parser sees it: the header, then key -> fields. */
function read(bytes: Uint8Array): { head: string[]; rows: string[][] } {
  const [head, ...rows] = new TextDecoder().decode(bytes).split("\n").map((l) => l.split("\t"));
  return { head: head!, rows };
}
const row = (m: { rows: string[][] }, key: string): string[] | undefined => m.rows.find((r) => r[0] === key)?.slice(1);

describe("the in-sim display's wire format", () => {
  it("sends the course: gates in order, two pylons a gate and one a turn pylon", () => {
    const m = read(courseMessage(rules));
    expect(m.head).toEqual(["XPR", "1", "course"]);
    expect(row(m, "name")).toEqual(["KDAG Rules Test"]);
    expect(row(m, "rev")).toEqual([courseRevision(rules)]);
    const gates = m.rows.filter((r) => r[0] === "gate");
    expect(gates.map((g) => [g[1], g[2]])).toEqual(rules.gates.map((g, i) => [String(i), g.type]));
    const pylons = m.rows.filter((r) => r[0] === "pylon").map((r) => Number(r[1]));
    const expected = rules.gates.flatMap((g, i) => (g.type === "turn" ? [i] : [i, i]));
    expect(pylons).toEqual(expected);
  });

  it("sends the race in the race screen's words, gate by gate", () => {
    const session = new RaceSession(rules, ctx);
    const seen = new Map<string, string[]>();
    for (const f of demoFlight(rules, { rateHz: 10 })) {
      session.feed(f, { kind: "demo", hz: 10, aircraft: null });
      const m = read(liveMessage(rules, session.live(), "Racing", true));
      const title = row(m, "title")![0]!;
      if (title && !seen.has(title)) seen.set(title, [row(m, "needs")![0]!, row(m, "gates")![0]!]);
    }
    expect([...seen]).toEqual([
      ["1 · Start", ["", "nttttt"]],
      ["2 · Level gate", ["wings level, ±10°", "dntttt"]],
      ["3 · Knife-edge gate", ["knife edge, 90° ±15°", "ddnttt"]],
      ["4 · Turn pylon", ["pass to the right of the pylon", "dddntt"]],
      ["5 · Gate", ["below 40 m", "ddddnt"]],
      ["6 · Finish", ["", "dddddn"]],
    ]);
    const end = read(liveMessage(rules, session.live(), "Finished", true));
    expect(row(end, "status")).toEqual(["finished"]);
    expect(row(end, "next")).toEqual(["-1"]);
    expect(row(end, "gates")).toEqual(["dddddd"]);
    expect(row(end, "fix")![3]).toBe("1");
  });

  it("keeps free text on its line", () => {
    const session = new RaceSession(rules, ctx);
    const m = read(liveMessage(rules, session.live(), "two\twords\non one line", false));
    expect(row(m, "line")).toEqual(["two words on one line"]);
    expect(row(m, "fix")).toBeUndefined();
  });

  it("reads the plugin's hello, and nothing else", () => {
    const hello = new TextEncoder().encode("XPR\t1\thello\nplugin\t0.1.0-h3\nxplane\t12431\nxplm\t430\nfps\t59.8\n");
    expect(parseHello(hello)).toEqual({ plugin: "0.1.0-h3", xplane: 12431, fps: 59.8 });
    expect(parseHello(new TextEncoder().encode("XPR\t2\thello\nplugin\tx\n"))).toBeNull();
    expect(parseHello(new TextEncoder().encode("RPOS\0"))).toBeNull();
    expect(xplaneVersionText(12431)).toBe("12.4.3");
    expect(xplaneVersionText(12440)).toBe("12.4.4");
  });
});
