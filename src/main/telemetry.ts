// Telemetry from X-Plane 12: RPOS over UDP for the race, the Web API for the aircraft's name, plus
// the synthetic demo flight. The hub forwards fixes from ONE source at a time, so the race never
// mixes two clocks:   demo (while running) > rpos (fresh within 2 s).
// Timestamps are this process's monotonic clock at receive time, in seconds: RPOS carries no sim time.
//
// RPOS is a subscription: X-Plane sends to the port the request came from until asked for 0, and
// forgets the subscriber when it restarts. So the request is repeated whenever the stream is quiet,
// which also covers "X-Plane was started after the app".
import dgram from "node:dgram";
import { performance } from "node:perf_hooks";
import type { Course } from "../core/course/course";
import { demoFlight } from "../core/demo/demoFlight";
import { isNullIsland, type Fix } from "../core/race/fix";
import type { SourceKind } from "../core/run/run";
import type { SourceInfo } from "../core/session/raceSession";
import { RateMeter } from "../core/telemetry/rate";
import { XPLANE_PORT, parseRpos, rposRequest } from "../core/telemetry/rpos";
import {
  AIRCRAFT_ICAO,
  WEB_API_PORT,
  WEB_API_VERSIONS,
  idFromLookup,
  lookupUrl,
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
const RPOS_ASK_MS = 2000;
const AIRCRAFT_POLL_MS = 5000;
const WEB_TIMEOUT_MS = 1500;
const DEMO_RATE_HZ = 20;
export const DEMO_AIRCRAFT = "Extra";

export type FixListener = (fix: Fix, source: SourceInfo) => void;

export class TelemetryHub {
  private listener: FixListener | null = null;

  private rpos: dgram.Socket | null = null;
  private readonly rposRate = new RateMeter();
  private rposError: string | null = null;
  private askTimer: NodeJS.Timeout | null = null;

  private aircraft: string | null = null;
  private webVersion: WebApiVersion | null = null;
  private icaoId: number | null = null;
  private webError: string | null = null;
  private aircraftTimer: NodeJS.Timeout | null = null;
  private polling = false;

  private demoTimer: NodeJS.Timeout | null = null;

  onFix(listener: FixListener): void {
    this.listener = listener;
  }

  start(): void {
    this.startRpos();
    this.aircraftTimer = setInterval(() => void this.pollAircraft(), AIRCRAFT_POLL_MS);
  }

  stop(): void {
    this.stopDemo();
    if (this.askTimer) clearInterval(this.askTimer);
    if (this.aircraftTimer) clearInterval(this.aircraftTimer);
    const sock = this.rpos;
    this.rpos = null;
    if (sock) {
      // Ask X-Plane to stop sending, so it is not left streaming at a closed port.
      sock.send(rposRequest(0), XPLANE_PORT, XPLANE_HOST, () => sock.close());
    }
  }

  status(): TelemetryStatus {
    const t = now();
    const last = this.rposRate.lastT();
    return {
      active: this.activeSource(t),
      aircraft: this.aircraft,
      rpos: { ageS: last === null ? null : t - last, hz: this.rposRate.hz(t), error: this.rposError },
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
      if (this.activeSource(t) !== "rpos") return;
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
      const last = this.rposRate.lastT();
      if (last === null || now() - last > RPOS_FRESH_S) this.ask();
    }, RPOS_ASK_MS);
  }

  private ask(): void {
    this.rpos?.send(rposRequest(RPOS_RATE_HZ), XPLANE_PORT, XPLANE_HOST, (e) => {
      this.rposError = e ? e.message : null;
    });
  }

  // --- Web API: the aircraft --------------------------------------------------------------------------

  /** While X-Plane streams, read which aircraft it flies. A new aircraft means a new flight, which
   *  can reload the dataref ids, so the id is looked up again whenever a read fails. */
  private async pollAircraft(): Promise<void> {
    if (this.polling || this.activeSource(now()) !== "rpos") return;
    this.polling = true;
    try {
      const versions = this.webVersion ? [this.webVersion] : WEB_API_VERSIONS;
      for (const v of versions) {
        if (this.icaoId === null || this.webVersion !== v) {
          const id = idFromLookup(await getJson(lookupUrl(XPLANE_HOST, WEB_API_PORT, v, AIRCRAFT_ICAO)));
          if (id === null) continue;
          this.icaoId = id;
          this.webVersion = v;
        }
        const icao = textFromValue(await getJson(valueUrl(XPLANE_HOST, WEB_API_PORT, v, this.icaoId)));
        if (icao !== this.aircraft) log.info(`aircraft: ${icao ?? "(no ICAO code)"} (Web API ${v})`);
        this.aircraft = icao;
        this.webError = null;
        return;
      }
      this.webError = "X-Plane's Web API did not answer";
    } catch (e) {
      this.icaoId = null;
      this.webVersion = null;
      this.webError = e instanceof Error ? e.message : String(e);
    } finally {
      this.polling = false;
    }
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(WEB_TIMEOUT_MS) });
  if (res.status === 403) throw new Error("X-Plane's Web API is off (Settings › Network › Disable Incoming Traffic)");
  if (!res.ok) return null;
  return res.json();
}
