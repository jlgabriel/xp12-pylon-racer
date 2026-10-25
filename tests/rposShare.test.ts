import { describe, expect, it } from "vitest";
import { ASK_S, MAX_ASK_S, RposShare, STEADY_S } from "../src/core/telemetry/rposShare";

const HZ = 29.5; // measured in H0
const DT = 1 / HZ;

/** Feeds a 29.5 Hz stream over [from, to). */
function stream(s: RposShare, from: number, to: number): void {
  for (let t = from; t < to; t += DT) s.received(t);
}

/** The hub's loop over [from, to): a tick every 250 ms that asks when it should. Returns the asks. */
function ticks(s: RposShare, from: number, to: number): number[] {
  const asks: number[] = [];
  for (let t = from; t < to; t += 0.25) {
    if (s.shouldAsk(t)) {
      s.asked(t);
      asks.push(t);
    }
  }
  return asks;
}

/**
 * X-Plane with two subscribers, millisecond by millisecond: RPOS goes at 29.5 Hz to whoever asked
 * last. The app is the hub (a tick every 250 ms, RposShare deciding); the other program behaves like
 * the H0 recorder (every 2 s, asks if it heard nothing for 2 s) between otherFrom and otherTo.
 */
function fight(opts: { seconds: number; otherFrom: number; otherTo: number }) {
  const app = new RposShare();
  let owner: "app" | "other" | null = null;
  let otherLast = -Infinity;
  let nextPacket = 0;
  const got = { app: [] as number[], other: [] as number[] };
  const sharedAt: boolean[] = []; // one sample per second
  for (let ms = 0; ms < opts.seconds * 1000; ms++) {
    const t = ms / 1000;
    if (ms % 250 === 0 && app.shouldAsk(t)) {
      app.asked(t);
      owner = "app";
    }
    const otherOn = t >= opts.otherFrom && t < opts.otherTo;
    if (otherOn && (ms - opts.otherFrom * 1000) % 2000 === 0 && t - otherLast > 2) owner = "other";
    if (t >= nextPacket) {
      nextPacket += DT;
      if (owner === "app") {
        app.received(t);
        got.app.push(t);
      } else if (owner === "other" && otherOn) {
        otherLast = t;
        got.other.push(t);
      }
    }
    if (ms % 1000 === 0) sharedAt.push(app.shared(t));
  }
  return { app, got, sharedAt };
}

const between = (ts: number[], a: number, b: number) => ts.filter((t) => t >= a && t < b).length;

describe("RPOS shared with another program", () => {
  it("alone, the app asks once and never calls it shared", () => {
    const { got, sharedAt } = fight({ seconds: 60, otherFrom: Infinity, otherTo: Infinity });
    expect(sharedAt.some(Boolean)).toBe(false);
    expect(between(got.app, 1, 60)).toBeGreaterThan(59 * HZ - 2);
  });

  it("sees the fight measured in H0 within ~15 s, then backs off so the other program mostly works", () => {
    const { got, sharedAt } = fight({ seconds: 90, otherFrom: 5, otherTo: Infinity });
    const first = sharedAt.indexOf(true);
    expect(first).toBeGreaterThan(5);
    expect(first).toBeLessThanOrEqual(20);
    expect(sharedAt.slice(first).every(Boolean)).toBe(true);
    // Without the backoff the two would trade it half and half (H0: 29, 18, 0 Hz alternating).
    const other = between(got.other, 40, 90);
    const app = between(got.app, 40, 90);
    expect(other / (other + app)).toBeGreaterThan(0.6);
  });

  it("takes RPOS back and clears the warning once the other program closes", () => {
    const { got, sharedAt } = fight({ seconds: 150, otherFrom: 5, otherTo: 90 });
    expect(sharedAt[89]).toBe(true);
    const cleared = sharedAt.indexOf(false, 90);
    expect(cleared).toBeGreaterThan(90);
    expect(cleared - 90).toBeLessThanOrEqual(MAX_ASK_S + STEADY_S + 2);
    expect(sharedAt.slice(cleared).some(Boolean)).toBe(false);
    expect(between(got.app, 130, 150)).toBeGreaterThan(20 * HZ - 2);
  });

  it("calls the bare H0 pattern shared on the second takeover: 2 s of 29 Hz, cut, our request, back", () => {
    const s = new RposShare();
    s.asked(0);
    stream(s, 0.03, 2);
    s.asked(4);
    stream(s, 4.03, 6);
    expect(s.shared(6)).toBe(false); // one takeover could be a restarted sim
    s.asked(8);
    stream(s, 8.03, 10);
    expect(s.shared(10)).toBe(true);
    expect(s.shared(10 + 40)).toBe(false); // they age out of the window
  });

  it("is not fooled by hitches that resume on their own, short or long", () => {
    const s = new RposShare();
    let t = 0;
    ticks(s, 0, 0.25);
    for (let i = 0; i < 6; i++) {
      stream(s, t + 0.03, t + 5);
      t += 5 + 1.5; // a 1.5 s scenery hitch: under FRESH_S, nobody asks
      ticks(s, t - 1.5, t);
    }
    for (let i = 0; i < 4; i++) {
      stream(s, t, t + 10);
      t += 10;
      ticks(s, t, t + 3); // a 3 s stall: the hub asks at ~2 s, X-Plane comes back at 3 s by itself
      t += 3;
    }
    expect(s.shared(t)).toBe(false);
  });

  it("does not count the menu, or a restarted sim answering once", () => {
    const s = new RposShare();
    const asks = ticks(s, 0, 30); // menu: nothing answers
    expect(asks.length).toBe(Math.floor(30 / ASK_S));
    expect(s.shared(30)).toBe(false);
    stream(s, 30.05, 60); // a flight loads; the request of ~30 s is answered
    ticks(s, 60, 90); // X-Plane quits and restarts
    stream(s, 90.03, 120);
    expect(s.shared(120)).toBe(false);
  });

  it("backs off by doubling up to MAX_ASK_S", () => {
    const s = new RposShare();
    expect(s.askEveryS(0)).toBe(ASK_S);
    const takeover = (t: number) => {
      s.received(t - 3);
      s.asked(t - 0.1);
      s.received(t);
    };
    takeover(3);
    expect(s.askEveryS(3)).toBe(ASK_S);
    takeover(7);
    expect(s.askEveryS(7)).toBe(4);
    takeover(11);
    expect(s.askEveryS(11)).toBe(8);
    takeover(15);
    expect(s.askEveryS(15)).toBe(MAX_ASK_S);
    // Silent for 3 s after the last request: under the 10 s interval, so no request yet.
    expect(s.shouldAsk(15 + 3)).toBe(false);
    expect(s.shouldAsk(15 + MAX_ASK_S)).toBe(true);
  });

  it("owns the stream only while it arrives (a request for 0 would stop someone else's)", () => {
    const s = new RposShare();
    expect(s.owns(0)).toBe(false);
    stream(s, 0, 2);
    expect(s.owns(2)).toBe(true);
    expect(s.owns(3.5)).toBe(false);
  });
});
