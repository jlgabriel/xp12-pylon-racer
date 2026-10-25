// RPOS has ONE subscriber: X-Plane sends it only to whoever asked last (measured 2026-10-24, H0 and
// again with two sockets). A second program that also asks — a moving map, the H0 recorder — takes
// the stream away, and when both re-ask on silence they trade it every few seconds: each sees ~29 Hz,
// then ~18, then 0.
//
// From this side the fight has one signature: the stream stops, and comes back right after OUR next
// request (so X-Plane was serving all along, just not to us). Two such takeovers within WINDOW_S mean
// another program is asking too. Things that also stop the stream do not look like that: a hitch or a
// scenery load resumes on its own, the menu and a closed sim do not answer, and a restarted sim
// answers once and then streams on (one takeover).
//
// While shared, the app backs off: it asks again ever more slowly (up to MAX_ASK_S), so the other
// program mostly works and the two stop fighting blindly, yet a request still goes out now and then
// to take RPOS back once the other program closes. STEADY_S of uninterrupted stream clears it all.
//
// Pure: every method takes the time (seconds, the hub's monotonic clock).

/** Silence longer than this, without a request of ours, makes the hub ask again. */
export const FRESH_S = 2;
/** A gap at least this long is a cut, not jitter (RPOS arrives every ~34 ms, p95 41 ms). */
export const CUT_S = 1;
/** A stream that resumes this soon after our request was resumed BY it. */
export const RESUME_S = 0.5;
/** Takeovers counted over this window... */
export const WINDOW_S = 40;
/** ...and this many of them mean shared. */
export const MIN_TAKEOVERS = 2;
/** The normal interval between requests while the stream is silent. */
export const ASK_S = 2;
/** The slowest the backoff gets. */
export const MAX_ASK_S = 10;
/** This long without a cut clears the takeovers. */
export const STEADY_S = 10;

export class RposShare {
  private lastPacket: number | null = null;
  private lastAsk: number | null = null;
  private streamStart: number | null = null;
  private takeovers: number[] = [];

  /** We sent a request for RPOS. */
  asked(t: number): void {
    this.lastAsk = t;
  }

  /** A usable RPOS packet arrived. */
  received(t: number): void {
    const last = this.lastPacket;
    if (last === null || t - last >= CUT_S) {
      const ask = this.lastAsk;
      if (last !== null && ask !== null && ask > last && t - ask <= RESUME_S) {
        this.takeovers = [...this.takeovers.filter((x) => x > t - WINDOW_S), t];
      }
      this.streamStart = t;
    }
    this.lastPacket = t;
    if (this.streamStart !== null && t - this.streamStart >= STEADY_S) this.takeovers = [];
  }

  /** Whether another program is asking X-Plane for RPOS too. */
  shared(t: number): boolean {
    return this.recent(t) >= MIN_TAKEOVERS;
  }

  /** Whether the stream is ours right now: only then may we ask X-Plane to stop it (a request for 0
   *  from anyone stops it for its current subscriber too). */
  owns(t: number): boolean {
    return this.lastPacket !== null && t - this.lastPacket < CUT_S;
  }

  /** The wait between requests while silent: ASK_S, doubling per takeover while shared. */
  askEveryS(t: number): number {
    const n = this.recent(t);
    return n >= MIN_TAKEOVERS ? Math.min(MAX_ASK_S, ASK_S * 2 ** (n - 1)) : ASK_S;
  }

  /** Whether to send a request now: the first time, then whenever the stream is silent and the
   *  current interval has passed since the last request. */
  shouldAsk(t: number): boolean {
    if (this.lastAsk === null) return true;
    const silent = this.lastPacket === null || t - this.lastPacket > FRESH_S;
    return silent && t - this.lastAsk >= this.askEveryS(t);
  }

  private recent(t: number): number {
    return this.takeovers.filter((x) => x > t - WINDOW_S).length;
  }
}
