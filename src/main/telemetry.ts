// Telemetry from X-Plane 12: RPOS over UDP for the race, the Web API for the aircraft's name, plus
// the synthetic demo flight. The hub forwards fixes from ONE source at a time, so the race never
// mixes two clocks:   demo (while running) > rpos (fresh within 2 s).
// Timestamps are this process's monotonic clock at receive time, in seconds: RPOS carries no sim time.
//
// RPOS is a subscription: X-Plane sends to the port the request came from until asked for 0, and
// forgets the subscriber when it restarts. So the request is repeated whenever the stream is quiet,
// which also covers "X-Plane was started after the app". It has ONE subscriber, though: another
// program that asks takes it away. RposShare (core/telemetry/rposShare.ts) tells that apart, and
// then spaces the requests out instead of fighting for it.
//
// While X-Plane plays a replay, RPOS streams the replay's positions: the Web API says so
// (sim/time/is_in_replay) and those fixes are dropped. Without the Web API they go through, as in 0.1.
import dgram from "node:dgram";
import { performance } from "node:perf_hooks";
import type { Course } from "../core/course/course";
import { demoFlight } from "../core/demo/demoFlight";
import { isNullIsland, type Fix } from "../core/race/fix";
import type { SourceKind } from "../core/run/run";
import type { SourceInfo } from "../core/session/raceSession";
import { RateMeter } from "../core/telemetry/rate";
import { XPLANE_PORT, parseRpos, rposRequest } from "../core/telemetry/rpos";
import { RposShare } from "../core/telemetry/rposShare";
import {
  AIRCRAFT_ICAO,
  IN_REPLAY,
  WEB_API_PORT,
  WEB_API_VERSIONS,
  idFromLookup,
  lookupUrl,
  numberFromValue,
  textFromValue,
  valueUrl,
  type WebApiVersion,
} from "../core/telemetry/webapi";
import type { TelemetryStatus } from "../shared/racerApi";
import { log } from "./log";

const now = (): number => performance.now() / 1000;

const XPLANE_HOST = "127.0.0.1";
const RPOS_RATE_HZ = 40;
const RPOS_FRESH_S = 2;
const RPOS_TICK_MS = 250;
/** The replay flag is read this often, so few replay fixes slip through before it is seen. */
const WEB_POLL_MS = 250;
const AIRCRAFT_EVERY_S = 5;
const WEB_TIMEOUT_MS = 1500;
const DEMO_RATE_HZ = 20;
export const DEMO_AIRCRAFT = "Extra";

export type FixListener = (fix: Fix, source: SourceInfo) => void;

export class TelemetryHub {
  private listener: FixListener | null = null;

  private rpos: dgram.Socket | null = null;
  private readonly rposRate = new RateMeter();
  private readonly share = new RposShare();
  private shared = false;
  private rposError: string | null = null;
  private askTimer: NodeJS.Timeout | null = null;

  private aircraft: string | null = null;
  private aircraftReadT = -Infinity;
  private replay = false;
  private webVersion: WebApiVersion | null = null;
  /** Dataref name → id, for webVersion. */
  private readonly ids = new Map<string, number>();
  private webError: string | null = null;
  private webTimer: NodeJS.Timeout | null = null;
  private polling = false;

  private demoTimer: NodeJS.Timeout | null = null;

  onFix(listener: FixListener): void {
    this.listener = listener;
  }

  start(): void {
    this.startRpos();
    this.webTimer = setInterval(() => void this.pollWeb(), WEB_POLL_MS);
  }

  stop(): void {
    this.stopDemo();
    if (this.askTimer) clearInterval(this.askTimer);
    if (this.webTimer) clearInterval(this.webTimer);
    const sock = this.rpos;
    this.rpos = null;
    if (sock && this.share.owns(now())) {
      // Ask X-Plane to stop sending, so it is not left streaming at a closed port. Only when the
      // stream is ours: a request for 0 from anyone also stops it for another program holding it.
      sock.send(rposRequest(0), XPLANE_PORT, XPLANE_HOST, () => sock.close());
    } else {
      sock?.close();
    }
  }

  status(): TelemetryStatus {
    const t = now();
    const last = this.rposRate.lastT();
    const fresh = last !== null && t - last <= RPOS_FRESH_S;
    return {
      active: this.activeSource(t),
      aircraft: this.aircraft,
      rpos: { ageS: last === null ? null : t - last, hz: this.rposRate.hz(t), error: this.rposError, shared: this.share.shared(t) },
      replay: this.replay && fresh,
      webApi: { ok: this.webVersion !== null && this.webError === null, error: this.webError },
      demo: { running: this.demoTimer !== null },
    };
  }

  // --- demo -----------------------------------------------------------------------------------------

  startDemo(course: Course, onDone: () => void): void {
    this.stopDemo();
    const fixes = demoFlight(course, { rateHz: DEMO_RATE_HZ });
    const t0 = now();
    let i = 0;
    this.demoTimer = setInterval(() => {
      const elapsed = now() - t0;
      while (i < fixes.length && fixes[i]!.t <= elapsed) {
        const f = fixes[i++]!;
        this.listener?.({ ...f, t: t0 + f.t }, { kind: "demo", hz: DEMO_RATE_HZ, aircraft: DEMO_AIRCRAFT });
      }
      if (i >= fixes.length) {
        this.stopDemo();
        onDone();
      }
    }, 1000 / DEMO_RATE_HZ);
  }

  stopDemo(): void {
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
  }

  // --- source selection -----------------------------------------------------------------------------

  private activeSource(t: number): SourceKind | null {
    if (this.demoTimer) return "demo";
    const r = this.rposRate.lastT();
    if (r !== null && t - r <= RPOS_FRESH_S) return "rpos";
    return null;
  }

  // --- RPOS -----------------------------------------------------------------------------------------

  private startRpos(): void {
    const sock = dgram.createSocket("udp4");
    sock.on("message", (msg) => {
      const t = now();
      const fix = parseRpos(new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength), t);
      if (!fix || isNullIsland(fix)) return;
      this.rposRate.tick(t);
      this.share.received(t);
      if (this.replay || this.activeSource(t) !== "rpos") return;
      this.listener?.(fix, { kind: "rpos", hz: this.rposRate.hz(t), aircraft: this.aircraft });
    });
    sock.on("error", (e) => {
      this.rposError = e.message;
      log.warn("RPOS socket error", e);
    });
    // Port 0: the system picks one. X-Plane answers to wherever the request came from.
    sock.bind(0, () => {
      log.info(`asking X-Plane at ${XPLANE_HOST}:${XPLANE_PORT} for RPOS at ${RPOS_RATE_HZ} Hz`);
      this.ask();
    });
    this.rpos = sock;
    this.askTimer = setInterval(() => {
      const t = now();
      if (this.share.shouldAsk(t)) this.ask();
      const shared = this.share.shared(t);
      if (shared !== this.shared) {
        log.info(shared ? "another program is taking RPOS from X-Plane: asking less often" : "RPOS is ours again");
        this.shared = shared;
      }
    }, RPOS_TICK_MS);
  }

  private ask(): void {
    this.share.asked(now());
    this.rpos?.send(rposRequest(RPOS_RATE_HZ), XPLANE_PORT, XPLANE_HOST, (e) => {
      this.rposError = e ? e.message : null;
    });
  }

  // --- Web API: the replay flag and the aircraft ------------------------------------------------------

  /** While X-Plane streams, read whether it plays a replay (every poll) and which aircraft it flies
   *  (every AIRCRAFT_EVERY_S). Ids are looked up again after a failed read: a new flight can reload
   *  them. Without an answer the replay counts as off, so the race behaves as before the Web API. */
  private async pollWeb(): Promise<void> {
    if (this.polling || this.activeSource(now()) !== "rpos") return;
    this.polling = true;
    try {
      const replay = await this.read(IN_REPLAY, numberFromValue);
      if (replay === undefined) {
        this.setReplay(false);
        this.webError = "X-Plane's Web API did not answer";
        return;
      }
      this.setReplay(replay === 1);
      if (now() - this.aircraftReadT >= AIRCRAFT_EVERY_S) {
        this.aircraftReadT = now();
        const icao = await this.read(AIRCRAFT_ICAO, textFromValue);
        if (icao !== undefined) {
          if (icao !== this.aircraft) log.info(`aircraft: ${icao ?? "(no ICAO code)"} (Web API ${this.webVersion})`);
          this.aircraft = icao;
        }
      }
      this.webError = null;
    } catch (e) {
      this.ids.clear();
      this.webVersion = null;
      this.setReplay(false);
      this.webError = e instanceof Error ? e.message : String(e);
    } finally {
      this.polling = false;
    }
  }

  /** A dataref's decoded value (null when it does not decode); undefined when no API version knows
   *  the name. */
  private async read<T>(name: string, decode: (body: unknown) => T | null): Promise<T | null | undefined> {
    const versions = this.webVersion ? [this.webVersion] : WEB_API_VERSIONS;
    for (const v of versions) {
      let id = this.webVersion === v ? this.ids.get(name) : undefined;
      if (id === undefined) {
        const found = idFromLookup(await getJson(lookupUrl(XPLANE_HOST, WEB_API_PORT, v, name)));
        if (found === null) continue;
        if (this.webVersion !== v) this.ids.clear();
        this.webVersion = v;
        this.ids.set(name, found);
        id = found;
      }
      const body = await getJson(valueUrl(XPLANE_HOST, WEB_API_PORT, v, id));
      if (body === null) this.ids.delete(name);
      return decode(body);
    }
    return undefined;
  }

  private setReplay(replay: boolean): void {
    if (replay !== this.replay) log.info(replay ? "X-Plane is playing a replay: not racing" : "X-Plane is flying again");
    this.replay = replay;
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
  if (res.status === 403) throw new Error("X-Plane's Web API is off (Settings › Network › Disable Incoming Traffic)");
  if (!res.ok) return null;
  return res.json();
}
