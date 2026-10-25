import { describe, expect, it } from "vitest";
import { demoFlight } from "../src/core/demo/demoFlight";
import { isJump, RaceEngine, STILL_S, type RaceEvent } from "../src/core/race/engine";
import type { Fix } from "../src/core/race/fix";
import { fixAt, makeCourse, straightCourse, type GateSpec } from "./helpers";

const kinds = (events: RaceEvent[]): string[] => events.map((e) => e.kind);

/** Fly a path of local points dt apart, reporting the ground speed each leg implies (some legs are
 *  long, and a speed the path could not fly would read as the sim moving the aircraft). */
function fly(engine: RaceEngine, path: [number, number][], dt = 1): RaceEvent[] {
  const events: RaceEvent[] = [];
  path.forEach(([x, y], i) => {
    const [px, py] = path[Math.max(0, i - 1)]!;
    const gsMs = Math.max(100, Math.hypot(x - px, y - py) / dt);
    events.push(...engine.update(fixAt(x, y, i * dt, { gsMs })));
  });
  return events;
}

describe("a clean run", () => {
  it("times a straight northbound run exactly at 1 Hz", () => {
    const eng = new RaceEngine(straightCourse());
    const path = Array.from({ length: 14 }, (_, i) => [0, -640 + 100 * i] as [number, number]);
    const events = fly(eng, path);
    const s = eng.snapshot();
    expect(s.status).toBe("finished");
    expect(s.penaltyTotal).toBe(0);
    // Gates at y = -500 / 0 / 500 are crossed at t = 1.4 / 6.4 / 11.4 (interpolated).
    expect(s.raw).toBeCloseTo(10, 1);
    expect(s.passes.map((p) => p.elapsed)).toEqual([0, expect.closeTo(5, 1), expect.closeTo(10, 1)]);
    expect(kinds(events)).toEqual(["started", "pass", "pass", "finished"]);
    expect(s.lapTimes).toEqual([expect.closeTo(10, 1)]);
  });

  it("records every gate crossed within one sample, in order", () => {
    // 0.083 Hz: one segment spans all three gates.
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -600, 0));
    const events = eng.update(fixAt(0, 600, 12));
    expect(kinds(events)).toEqual(["started", "pass", "pass", "finished"]);
    expect(eng.snapshot().raw).toBeCloseTo(10, 1);
  });

  it("freezes the clock at the finish", () => {
    const eng = new RaceEngine(straightCourse());
    fly(eng, Array.from({ length: 14 }, (_, i) => [0, -640 + 100 * i] as [number, number]));
    const frozen = eng.raw();
    eng.update(fixAt(0, 800, 50));
    expect(eng.raw()).toBe(frozen);
  });

  it("ignores duplicate and out-of-order samples", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -600, 0));
    expect(eng.update(fixAt(0, -400, 0))).toEqual([]);
    expect(eng.raceStatus).toBe("waiting");
  });
});

describe("what the engine records at a pass", () => {
  it("interpolates roll, altitude and the offset from the gate center", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(20, -600, 0, { rollDeg: 0, altMslM: 1500, aglM: 20 }));
    eng.update(fixAt(20, -400, 2, { rollDeg: 40, altMslM: 1520, aglM: 40 }));
    const start = eng.snapshot().passes[0]!;
    expect(start.t).toBeCloseTo(1, 2);
    expect(start.rollDeg).toBeCloseTo(20, 1);
    expect(start.altMslM).toBeCloseTo(1510, 1);
    expect(start.aglM).toBeCloseTo(30, 1);
    // Flying north, x = +20 is 20 m right of the center.
    expect(start.offsetM).toBeCloseTo(20, 0);
  });
});

describe("starting", () => {
  it("does not start on a wrong-way crossing of the start line", () => {
    const eng = new RaceEngine(straightCourse());
    fly(eng, [
      [0, -400],
      [0, -600],
    ]);
    expect(eng.raceStatus).toBe("waiting");
  });

  it("does not start by flying through a later gate first", () => {
    const eng = new RaceEngine(straightCourse());
    fly(eng, [
      [0, -100],
      [0, 100],
    ]);
    expect(eng.raceStatus).toBe("waiting");
  });
});

describe("penalties", () => {
  const detour: [number, number][] = [
    [0, -600],
    [0, -400], // through the start
    [200, -400], // east
    [200, 200], // north, outside gate 2's span
    [0, 200], // back west, past gate 2
    [0, 600], // through the finish
  ];

  it("a skipped gate costs the course's missed-gate penalty", () => {
    const eng = new RaceEngine(straightCourse());
    const events = fly(eng, detour);
    const s = eng.snapshot();
    expect(s.status).toBe("finished");
    expect(s.penalties).toEqual([expect.objectContaining({ kind: "missed-gate", gateIndex: 1, seconds: 10 })]);
    expect(s.total).toBeCloseTo(s.raw + 10, 9);
    expect(kinds(events)).toEqual(["started", "penalty", "pass", "finished"]);
  });

  it("a skipped gate ends the run when the course says so", () => {
    const eng = new RaceEngine(straightCourse({ rules: { missedGateIsDnf: true } }));
    const events = fly(eng, detour);
    expect(eng.raceStatus).toBe("dnf");
    expect(kinds(events)).toEqual(["started", "dnf"]);
  });

  it("a wrong-way pass of the next gate is penalized once", () => {
    const eng = new RaceEngine(straightCourse());
    fly(eng, [
      [0, -540],
      [0, -440], // start
      [200, -440],
      [200, 200],
      [0, 200],
      [0, -100], // through gate 2 southbound
      [0, 100], // northbound: a valid pass
      [0, -100], // southbound again: gate 2 is behind now, no penalty
    ]);
    const s = eng.snapshot();
    expect(s.penalties.map((p) => p.kind)).toEqual(["wrong-direction"]);
    expect(s.passes.map((p) => p.gateIndex)).toEqual([0, 1]);
  });
});

describe("laps", () => {
  // A diamond: start at the origin heading north, then NE, SE, SW corners, back through the start.
  const diamond = (laps: number) =>
    makeCourse(
      [
        { type: "start", x: 0, y: 0, heading: 0 },
        { type: "gate", x: 500, y: 500, heading: 90 },
        { type: "gate", x: 1000, y: 0, heading: 180 },
        { type: "knife", x: 500, y: -500, heading: 270 },
      ],
      { laps },
    );

  it("closes each lap on the start line and finishes after the last", () => {
    const course = diamond(3);
    const eng = new RaceEngine(course);
    const events: RaceEvent[] = [];
    for (const f of demoFlight(course, { speedMs: 100, rateHz: 5 })) events.push(...eng.update(f));
    const s = eng.snapshot();
    expect(s.status).toBe("finished");
    expect(s.penalties).toEqual([]);
    expect(s.passes).toHaveLength(1 + 3 * 4);
    expect(s.lapTimes).toHaveLength(3);
    // Four legs of 707 m at 100 m/s.
    for (const lap of s.lapTimes) expect(lap).toBeCloseTo(28.28, 1);
    expect(events.filter((e) => e.kind === "lap")).toHaveLength(3);
    expect(s.lap).toBe(3);
  });

  it("cutting back through the start mid-lap misses the rest of the lap", () => {
    const eng = new RaceEngine(diamond(2));
    fly(eng, [
      [0, -100],
      [0, 100], // start
      [-100, 100],
      [-100, -100],
      [0, -100],
      [0, 100], // back through the start without flying the lap
    ]);
    const s = eng.snapshot();
    expect(s.penalties.map((p) => p.gateIndex)).toEqual([1, 2, 3]);
    expect(s.lapTimes).toHaveLength(1);
  });
});

describe("turn pylons", () => {
  const withTurn = makeCourse([
    { type: "start", x: 0, y: -500, heading: 0 },
    { type: "turn", x: 0, y: 0, heading: 0, width: 300, turnSide: "left" },
    { type: "finish", x: 0, y: 500, heading: 0 },
  ]);

  // Through the start and the finish on the axis, swinging out to `side` at the turn pylon.
  const around = (side: number): [number, number][] => [
    [0, -600],
    [0, -400],
    [side, -300],
    [side, 300],
    [0, 400],
    [0, 600],
  ];

  it("passes when the pylon is kept on the required side", () => {
    const eng = new RaceEngine(withTurn);
    fly(eng, around(100)); // pylon on the left
    const s = eng.snapshot();
    expect(s.status).toBe("finished");
    expect(s.penalties).toEqual([]);
    expect(s.passes[1]!.offsetM).toBeCloseTo(100, 0);
  });

  it("is cut when flown on the wrong side: the step counts, with the turn-cut penalty", () => {
    const eng = new RaceEngine(withTurn);
    fly(eng, around(-100)); // pylon on the right
    const s = eng.snapshot();
    expect(s.status).toBe("finished");
    expect(s.penalties).toEqual([expect.objectContaining({ kind: "turn-cut", gateIndex: 1, seconds: 10 })]);
    expect(s.passes.map((p) => p.gateIndex)).toEqual([0, 1, 2]);
  });

  it("is missed, not cut, when it is not rounded at all", () => {
    const eng = new RaceEngine(withTurn);
    fly(eng, around(400)); // wide of the 300 m pass line
    expect(eng.snapshot().penalties.map((p) => p.kind)).toEqual(["missed-gate"]);
  });
});

/** Northbound through start (y=-500), the judged gate (y=0) and the finish (y=500), on the axis. */
function judged(gate: Partial<GateSpec> & Pick<GateSpec, "type">, rules: Record<string, unknown> = {}) {
  return makeCourse(
    [
      { type: "start", x: 0, y: -500, heading: 0 },
      { x: 0, y: 0, heading: 0, ...gate },
      { type: "finish", x: 0, y: 500, heading: 0 },
    ],
    { rules },
  );
}

/** Fly x = const northbound at 1 Hz, with `over` applied around the middle gate (y = -100 … 100). */
function flyAxis(eng: RaceEngine, over: Partial<Fix>, x = 0): RaceEvent[] {
  const events: RaceEvent[] = [];
  for (let i = 0; i < 14; i++) {
    const y = -640 + 100 * i;
    events.push(...eng.update(fixAt(x, y, i, Math.abs(y) <= 100 ? over : {})));
  }
  return events;
}

const penaltyKinds = (eng: RaceEngine): string[] => eng.snapshot().penalties.map((p) => p.kind);

describe("attitude gates", () => {
  it("a level gate passes with the wings level and penalizes a bank past the tolerance", () => {
    const ok = new RaceEngine(judged({ type: "level" }));
    flyAxis(ok, { rollDeg: 8 });
    expect(penaltyKinds(ok)).toEqual([]);

    const banked = new RaceEngine(judged({ type: "level" }));
    flyAxis(banked, { rollDeg: -25 });
    expect(banked.snapshot().penalties).toEqual([
      expect.objectContaining({ kind: "attitude", gateIndex: 1, seconds: 2, measured: expect.closeTo(-25, 3) }),
    ]);
  });

  it("a knife-edge gate wants 90° of bank either way, within its tolerance", () => {
    for (const roll of [90, -90, 78, -102]) {
      const eng = new RaceEngine(judged({ type: "knife" }));
      flyAxis(eng, { rollDeg: roll });
      expect(penaltyKinds(eng)).toEqual([]);
    }
    const flat = new RaceEngine(judged({ type: "knife" }));
    flyAxis(flat, { rollDeg: 60 });
    expect(penaltyKinds(flat)).toEqual(["attitude"]);
  });

  it("the tolerance comes from the course", () => {
    const strict = new RaceEngine(judged({ type: "level" }, { levelToleranceDeg: 5, attitudePenaltyS: 4 }));
    flyAxis(strict, { rollDeg: 8 });
    expect(strict.snapshot().penalties).toEqual([expect.objectContaining({ kind: "attitude", seconds: 4 })]);
  });

  it("an inverted gate wants the aircraft upside down, either way round", () => {
    for (const roll of [180, -180, 165, -162]) {
      const eng = new RaceEngine(judged({ type: "inverted" }));
      flyAxis(eng, { rollDeg: roll });
      expect(penaltyKinds(eng)).toEqual([]);
    }
    const knife = new RaceEngine(judged({ type: "inverted" }, { invertedToleranceDeg: 30 }));
    flyAxis(knife, { rollDeg: -140 });
    expect(knife.snapshot().penalties).toEqual([expect.objectContaining({ kind: "attitude", measured: expect.closeTo(-140, 3) })]);
  });

  it("a plain gate does not judge the bank", () => {
    const eng = new RaceEngine(judged({ type: "gate" }));
    flyAxis(eng, { rollDeg: 60 });
    expect(penaltyKinds(eng)).toEqual([]);
  });
});

describe("height", () => {
  it("uses the sim's height above the ground when there is one", () => {
    const eng = new RaceEngine(judged({ type: "gate", top: 30, ground: 1400 }));
    flyAxis(eng, { aglM: 45, altMslM: 1420 }); // AGL wins over MSL − DEM (20 m)
    expect(eng.snapshot().penalties).toEqual([
      expect.objectContaining({ kind: "too-high", gateIndex: 1, seconds: 2, measured: expect.closeTo(45, 3) }),
    ]);
  });

  it("falls back to MSL minus the gate's terrain (UDP)", () => {
    const high = new RaceEngine(judged({ type: "gate", top: 30, ground: 1400 }));
    flyAxis(high, { altMslM: 1440 });
    expect(penaltyKinds(high)).toEqual(["too-high"]);

    const low = new RaceEngine(judged({ type: "gate", top: 30, ground: 1400 }));
    flyAxis(low, { altMslM: 1425 });
    expect(penaltyKinds(low)).toEqual([]);
  });

  it("a floor penalizes passing too low, with the course's penalty", () => {
    const low = new RaceEngine(judged({ type: "gate", bottom: 50, ground: 1400 }, { tooLowPenaltyS: 5 }));
    flyAxis(low, { aglM: 31 });
    expect(low.snapshot().penalties).toEqual([
      expect.objectContaining({ kind: "too-low", gateIndex: 1, seconds: 5, measured: expect.closeTo(31, 3) }),
    ]);

    const ok = new RaceEngine(judged({ type: "gate", bottom: 50, ground: 1400 }));
    flyAxis(ok, { altMslM: 1460 });
    expect(penaltyKinds(ok)).toEqual([]);
  });

  it("a height window penalizes either side of it", () => {
    for (const [agl, kinds] of [
      [20, ["too-low"]],
      [60, []],
      [120, ["too-high"]],
    ] as const) {
      const eng = new RaceEngine(judged({ type: "gate", bottom: 40, top: 100 }));
      flyAxis(eng, { aglM: agl });
      expect(penaltyKinds(eng)).toEqual(kinds);
    }
  });

  it("never penalizes a height it cannot know, nor a gate without a top", () => {
    const unknown = new RaceEngine(judged({ type: "gate", top: 30 }));
    flyAxis(unknown, { altMslM: 5000 });
    expect(penaltyKinds(unknown)).toEqual([]);

    const noTop = new RaceEngine(judged({ type: "gate", ground: 1400 }));
    flyAxis(noTop, { altMslM: 5000 });
    expect(penaltyKinds(noTop)).toEqual([]);
  });
});

describe("pylon hits", () => {
  // The middle gate is 80 m wide: its pylons stand at x = ±40.
  it("passing within the hit radius of a pylon, below its top, is a hit", () => {
    const eng = new RaceEngine(judged({ type: "gate", ground: 1400 }));
    flyAxis(eng, { altMslM: 1410 }, 37); // 3 m from the right pylon, 10 m up
    expect(eng.snapshot().penalties).toEqual([
      expect.objectContaining({ kind: "pylon-hit", gateIndex: 1, seconds: 3, measured: expect.closeTo(3, 1) }),
    ]);
  });

  it("above the pylon, or clear of the radius, is not", () => {
    const over = new RaceEngine(judged({ type: "gate", ground: 1400 }));
    flyAxis(over, { altMslM: 1420 }, 37); // 20 m up, the default red pylons are 15 m
    expect(penaltyKinds(over)).toEqual([]);

    const clear = new RaceEngine(judged({ type: "gate", ground: 1400 }));
    flyAxis(clear, { altMslM: 1410 }, 30); // 10 m from the pylon
    expect(penaltyKinds(clear)).toEqual([]);
  });

  it("counts a hit when the height is unknown: racing is low", () => {
    const eng = new RaceEngine(judged({ type: "gate" }));
    flyAxis(eng, {}, 37);
    expect(penaltyKinds(eng)).toEqual(["pylon-hit"]);
  });

  it("finds a hit between samples, off the gate line", () => {
    // After the start, dog-leg back south-west through the start's left pylon (x = -40, y = -500).
    const eng = new RaceEngine(judged({ type: "gate" }));
    eng.update(fixAt(0, -600, 0));
    eng.update(fixAt(0, -400, 1)); // start
    eng.update(fixAt(-38, -480, 2));
    eng.update(fixAt(-42, -520, 3)); // the segment passes ~0 m from the pylon
    expect(eng.snapshot().penalties).toEqual([expect.objectContaining({ kind: "pylon-hit", gateIndex: 0 })]);
  });

  it("is penalized once per pylon and lap", () => {
    const eng = new RaceEngine(judged({ type: "gate" }));
    eng.update(fixAt(-37, -600, 0));
    eng.update(fixAt(-37, -400, 1)); // through the start, 3 m from its left pylon
    expect(penaltyKinds(eng)).toEqual(["pylon-hit"]);
    eng.update(fixAt(-37, -600, 2)); // back past it, and again (the start is behind: no wrong-way)
    eng.update(fixAt(-37, -400, 3));
    expect(penaltyKinds(eng)).toEqual(["pylon-hit"]);
  });

  it("uses the model's own height when it has one", () => {
    // 20 m up, 3 m from the pylon: over Rodeo's 18 m model, under the course-wide 25 m.
    const short = new RaceEngine(judged({ type: "gate", ground: 1400, pylon: "rodeo-18" }));
    flyAxis(short, { altMslM: 1420 }, 37);
    expect(penaltyKinds(short)).toEqual([]);

    const tall = new RaceEngine(judged({ type: "gate", ground: 1400, pylon: "rodeo-25" }, { pylonHeightM: 10 }));
    flyAxis(tall, { altMslM: 1420 }, 37);
    expect(penaltyKinds(tall)).toEqual(["pylon-hit"]);
  });

  it("a turn pylon can be hit too", () => {
    const eng = new RaceEngine(judged({ type: "turn", width: 300, turnSide: "left" }));
    flyAxis(eng, {}, 2); // 2 m right of the pylon: rounded on the correct side, but hit
    expect(penaltyKinds(eng)).toEqual(["pylon-hit"]);
  });
});


describe("the sim resetting the aircraft", () => {
  // Flight test 2026-10-20 (KDAG Rules Test): a pylon has collision in AFS4, so hitting it stops the
  // sim and puts the aircraft back on the runway, kilometers away.
  const KMH_300 = 300 / 3.6;

  it("ends a race in progress as a DNF, without judging the jump", () => {
    const eng = new RaceEngine(straightCourse());
    const events = [
      ...eng.update(fixAt(-37, -600, 0)),
      ...eng.update(fixAt(-37, -400, 1)), // start, 3 m from its left pylon: a hit
      ...eng.update(fixAt(-37, -200, 2)),
      // reset: the straight line from here crosses gate 2 and the finish northbound
      ...eng.update(fixAt(0, 2500, 2.2, { gsMs: 0 })),
    ];
    expect(kinds(events)).toEqual(["started", "penalty", "dnf"]);
    expect(events.at(-1)).toEqual({ kind: "dnf", reason: "reset", elapsed: expect.closeTo(1.5, 3) });
    const s = eng.snapshot();
    expect(s).toMatchObject({ status: "dnf", dnfReason: "reset", raw: expect.closeTo(1.5, 3) });
    expect(s.passes.map((p) => p.gateIndex)).toEqual([0]);
    expect(s.penalties.map((p) => p.kind)).toEqual(["pylon-hit"]);
    expect(eng.nextGateIndex).toBeNull();
    // the aircraft sitting on the runway afterwards changes nothing
    expect(eng.update(fixAt(0, 2500, 30, { gsMs: 0 }))).toEqual([]);
    expect(eng.raw(30)).toBeCloseTo(1.5, 3);
  });

  it("a reset right after a short freeze ends the race when the aircraft stopped moving", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -600, 0));
    eng.update(fixAt(0, -400, 1)); // start at t = 0.5
    eng.update(fixAt(0, -300, 2));
    eng.update(fixAt(0, -290, 2.2, { gsMs: 0 })); // crashed: frozen in place
    eng.update(fixAt(0, -290, 4, { gsMs: 0 }));
    expect(kinds(eng.update(fixAt(0, 2900, 4.1, { gsMs: 0 })))).toEqual(["dnf"]);
    expect(eng.snapshot()).toMatchObject({ dnfReason: "reset", raw: expect.closeTo(1.7, 3) });
  });

  it("before the start, only moves the aircraft", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -3000, 0, { gsMs: 0 }));
    // to just past the start line, northbound: not a start
    expect(eng.update(fixAt(0, -450, 0.2, { gsMs: 0 }))).toEqual([]);
    expect(eng.snapshot()).toMatchObject({ status: "waiting", dnfReason: null, passes: [] });
    // flying from there works as usual
    eng.update(fixAt(0, -700, 3));
    expect(kinds(eng.update(fixAt(0, -400, 6)))).toEqual(["started"]);
  });

  it("does not fire on real flight", () => {
    // 300 km/h at 5 Hz, and at 40 Hz with the hub's jittery timestamps (two lines 0.1 ms apart)
    expect(isJump(fixAt(0, 0, 0, { gsMs: KMH_300 }), fixAt(0, KMH_300 / 5, 0.2, { gsMs: KMH_300 }))).toBe(false);
    expect(isJump(fixAt(0, 0, 0, { gsMs: KMH_300 }), fixAt(0, KMH_300 / 40, 0.0001, { gsMs: KMH_300 }))).toBe(false);
    // a jet at 400 m/s at 1 Hz, and a 12 s gap in the feed at 100 m/s
    expect(isJump(fixAt(0, 0, 0, { gsMs: 400 }), fixAt(0, 400, 1, { gsMs: 400 }))).toBe(false);
    expect(isJump(fixAt(0, 0, 0), fixAt(0, 1200, 12))).toBe(false);
    // a whole race at 5 Hz and 300 km/h
    const eng = new RaceEngine(straightCourse());
    const n = Math.ceil(1300 / (KMH_300 / 5));
    const events = fly(eng, Array.from({ length: n }, (_, i) => [0, -640 + (KMH_300 / 5) * i] as [number, number]), 0.2);
    expect(kinds(events)).toEqual(["started", "pass", "pass", "finished"]);
  });

  it("fires on a reset at any rate", () => {
    expect(isJump(fixAt(0, 0, 0), fixAt(0, 3100, 0.025, { gsMs: 0 }))).toBe(true);
    expect(isJump(fixAt(0, 0, 0), fixAt(0, 3100, 0.2, { gsMs: 0 }))).toBe(true);
  });
});

describe("the aircraft standing still during a race", () => {
  it(`ends it ${STILL_S} s after it froze: AFS4's crash menu`, () => {
    // Flight test 2026-10-23: after the hit the DLL streamed the same fix (and the same 88.6 m/s)
    // at ~16 Hz for 37 s, until "Restart airborne" put the aircraft 4 km away.
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -600, 0, { gsMs: 88.6 }));
    eng.update(fixAt(0, -400, 1, { gsMs: 88.6 })); // start at t = 0.5
    eng.update(fixAt(0, -300, 2, { gsMs: 88.6 })); // crash here
    const events: RaceEvent[] = [];
    let endedAt = 0;
    for (let t = 2.0625; t < 39; t += 0.0625) {
      const ev = eng.update(fixAt(0, -300, t, { gsMs: 88.6 }));
      if (ev.length && !endedAt) endedAt = t;
      events.push(...ev);
    }
    expect(events).toEqual([{ kind: "dnf", reason: "stopped", elapsed: expect.closeTo(1.5, 3) }]);
    expect(endedAt).toBeCloseTo(2 + STILL_S, 1);
    expect(eng.update(fixAt(-1500, 3800, 39.01, { gsMs: 82 }))).toEqual([]); // Restart airborne
    expect(eng.raw(60)).toBeCloseTo(1.5, 3);
  });

  it("ends it on the first fix after a silent pause", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -600, 0));
    eng.update(fixAt(0, -400, 1)); // start at t = 0.5
    eng.update(fixAt(0, -300, 2));
    // paused for 10 s with nothing on the feed, then flying on from where it was
    expect(eng.update(fixAt(0, -290, 12))).toEqual([{ kind: "dnf", reason: "stopped", elapsed: expect.closeTo(1.5, 3) }]);
  });

  it("does not end it for a shorter freeze, nor before the start", () => {
    const eng = new RaceEngine(straightCourse());
    eng.update(fixAt(0, -3000, 0, { gsMs: 0 }));
    eng.update(fixAt(0, -3000, 60, { gsMs: 0 })); // a minute on the runway
    eng.update(fixAt(0, -600, 70));
    eng.update(fixAt(0, -400, 71)); // start at t = 70.5
    eng.update(fixAt(0, -300, 72));
    eng.update(fixAt(0, -300, 72 + STILL_S - 0.1)); // a long stutter
    eng.update(fixAt(0, -280, 72 + STILL_S - 0.05));
    eng.update(fixAt(0, -200, 76));
    expect(eng.snapshot()).toMatchObject({ status: "running", dnfReason: null });
  });
});
