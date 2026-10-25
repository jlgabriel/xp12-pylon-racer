// A run (carrera): one finished attempt at a course, with everything needed to rank it and show its
// result. Stored as JSON in userData/runs/ (runs are never shared between computers) and validated
// with zod on the way back in.
import { z } from "zod";
import type { Fix } from "../race/fix";
import { DNF_REASONS, PENALTY_KINDS, type RaceSnapshot } from "../race/engine";

export const RUN_FORMAT = "pylon-racer/run";
export const RUN_VERSION = 1;

/** Column order of `track.samples`. Compact arrays keep a two-minute run at 40 Hz small. */
export const TRACK_FIELDS = ["t", "lon", "lat", "altMslM", "aglM", "headingDeg", "pitchDeg", "rollDeg", "gsMs"] as const;

const passSchema = z.object({
  step: z.number().int(),
  gateIndex: z.number().int(),
  lap: z.number().int(),
  t: z.number(),
  elapsed: z.number(),
  altMslM: z.number(),
  aglM: z.number().nullable(),
  rollDeg: z.number(),
  gsMs: z.number(),
  offsetM: z.number(),
});

const penaltySchema = z.object({
  kind: z.enum(PENALTY_KINDS),
  step: z.number().int(),
  gateIndex: z.number().int(),
  elapsed: z.number(),
  seconds: z.number(),
  measured: z.number().nullable().default(null),
});

export const runSchema = z.object({
  format: z.literal(RUN_FORMAT),
  version: z.literal(RUN_VERSION),
  id: z.string().min(1),
  courseId: z.string(),
  courseRevision: z.string(),
  courseName: z.string(),
  pilot: z.string(),
  aircraft: z.object({ id: z.string().nullable(), classId: z.string().nullable() }),
  source: z.object({ kind: z.enum(["rpos", "demo"]), hz: z.number() }),
  startedAt: z.string(),
  appVersion: z.string(),
  result: z.object({
    status: z.enum(["finished", "dnf"]),
    /** Why a DNF did not finish (absent in runs saved before v0.4). */
    dnfReason: z.enum(DNF_REASONS).nullable().default(null),
    raw: z.number(),
    penaltyTotal: z.number(),
    total: z.number(),
    lapTimes: z.array(z.number()),
  }),
  passes: z.array(passSchema),
  penalties: z.array(penaltySchema),
  track: z.object({
    fields: z.array(z.string()),
    samples: z.array(z.array(z.number().nullable())),
  }),
});
export type Run = z.infer<typeof runSchema>;
export type SourceKind = Run["source"]["kind"];

export function parseRun(data: unknown): Run {
  return runSchema.parse(data);
}

export interface RunMeta {
  id: string;
  courseName: string;
  pilot: string;
  aircraftId: string | null;
  classId: string | null;
  source: SourceKind;
  sourceHz: number;
  startedAt: string;
  appVersion: string;
}

/** Build the stored run from the engine's final state and the recorded fixes. */
export function buildRun(snap: RaceSnapshot, track: readonly Fix[], meta: RunMeta): Run {
  if (snap.status !== "finished" && snap.status !== "dnf") throw new Error("Only a finished or DNF race becomes a run");
  return {
    format: RUN_FORMAT,
    version: RUN_VERSION,
    id: meta.id,
    courseId: snap.courseId,
    courseRevision: snap.revision,
    courseName: meta.courseName,
    pilot: meta.pilot,
    aircraft: { id: meta.aircraftId, classId: meta.classId },
    source: { kind: meta.source, hz: Math.round(meta.sourceHz * 10) / 10 },
    startedAt: meta.startedAt,
    appVersion: meta.appVersion,
    result: {
      status: snap.status,
      dnfReason: snap.dnfReason,
      raw: snap.raw,
      penaltyTotal: snap.penaltyTotal,
      total: snap.total,
      lapTimes: snap.lapTimes,
    },
    passes: snap.passes,
    penalties: snap.penalties,
    track: {
      fields: [...TRACK_FIELDS],
      samples: track.map((f) => [f.t, f.lon, f.lat, f.altMslM, f.aglM, f.headingDeg, f.pitchDeg, f.rollDeg, f.gsMs]),
    },
  };
}

/** Collects the fixes of one attempt: a short pre-roll before the start, everything while racing. */
export class Recorder {
  private preroll: Fix[] = [];
  private fixes: Fix[] = [];
  private recording = false;

  constructor(
    private readonly prerollS = 3,
    private readonly minSpacingS = 0.05,
  ) {}

  reset(): void {
    this.preroll = [];
    this.fixes = [];
    this.recording = false;
  }

  /** Feed every fix, plus whether the race is running after it. */
  push(fix: Fix, running: boolean): void {
    if (!this.recording) {
      this.preroll.push(fix);
      while (this.preroll.length > 0 && this.preroll[0]!.t < fix.t - this.prerollS) this.preroll.shift();
      if (running) {
        this.recording = true;
        this.fixes = [...this.preroll];
      }
      return;
    }
    const last = this.fixes[this.fixes.length - 1];
    if (!last || fix.t - last.t >= this.minSpacingS - 1e-9) this.fixes.push(fix);
  }

  track(): Fix[] {
    return [...this.fixes];
  }
}
