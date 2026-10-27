// The in-sim display: the race, sent to our X-Plane plugin (probe H3) on 127.0.0.1:49710 with every
// live update. Nothing to switch on: without the plugin the datagrams go nowhere, and the plugin
// answers with a hello once a second, which is how the app knows it is there.
import dgram from "node:dgram";
import { performance } from "node:perf_hooks";
import type { Course } from "../core/course/course";
import { DISPLAY_PORT, courseMessage, liveMessage, parseHello, type DisplayHello } from "../core/display/wire";
import { statusLine } from "../core/race/rulesText";
import type { DisplayStatus, LiveUpdate } from "../shared/racerApi";
import { log } from "./log";

const HOST = "127.0.0.1";
/** UDP may drop the course: it goes again this often, and at once when it changes. */
const COURSE_EVERY_S = 2;
/** The plugin says hello every second; three missed and it is gone. */
const HELLO_FRESH_S = 3;

const now = (): number => performance.now() / 1000;

export class DisplayLink {
  private sock: dgram.Socket | null = null;
  private sentCourse: Course | null = null;
  private sentCourseT = -Infinity;
  private hello: DisplayHello | null = null;
  private helloT = -Infinity;
  private connected = false;

  constructor(private readonly port = DISPLAY_PORT) {}

  start(): void {
    const sock = dgram.createSocket("udp4");
    sock.on("message", (msg) => {
      const hello = parseHello(msg);
      if (!hello) return;
      this.hello = hello;
      this.helloT = now();
      if (!this.connected) log.info(`in-sim display connected: plugin ${hello.plugin}, X-Plane ${hello.xplane}`);
      this.connected = true;
    });
    // Nobody listening answers with an ICMP error on some systems; it is not a fault here.
    sock.on("error", (e) => log.warn(`in-sim display socket: ${e.message}`));
    sock.bind(0, HOST);
    this.sock = sock;
  }

  stop(): void {
    this.sock?.close();
    this.sock = null;
  }

  /** The race as the window gets it, for the plugin. Nothing goes out without a course. */
  send(u: LiveUpdate, course: Course | null): void {
    if (!this.sock || !course || !u.live) return;
    const t = now();
    if (course !== this.sentCourse || t - this.sentCourseT >= COURSE_EVERY_S) {
      this.post(courseMessage(course));
      this.sentCourse = course;
      this.sentCourseT = t;
    }
    this.post(liveMessage(course, u.live, statusLine(u.live.race, u.telemetry).text, u.telemetry.active === "demo"));
  }

  status(): DisplayStatus {
    const fresh = now() - this.helloT <= HELLO_FRESH_S;
    if (this.connected && !fresh) {
      log.info("in-sim display gone");
      this.connected = false;
    }
    return fresh && this.hello ? { connected: true, plugin: this.hello.plugin, xplane: this.hello.xplane } : { connected: false, plugin: null, xplane: null };
  }

  private post(bytes: Uint8Array): void {
    this.sock?.send(bytes, this.port, HOST);
  }
}
