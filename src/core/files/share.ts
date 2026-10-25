// The exchange file — how a course travels between pilots without a server:
//   .pylonrace  ZIP with course.json
// The scenery is never shipped: the receiving app builds it on install. The JSON keeps its own
// format/version fields and is validated with zod on the way in, like a file from disk.
//
// Unpacking also accepts bare JSON (a native course, or the old pylon-race tool's course.json), so
// one "Import…" takes every file the app understands. Runs are not shared (Juan, 2026-10-24: courses
// travel, results stay on the computer); the .pylonrun files of v0.4.0-pre get a clear "no".
import { parseCourse, type Course } from "../course/course";
import { importRctCourse, isRctCourse } from "../course/importRct";
import { RUN_FORMAT } from "../run/run";
import { isZip, readZip, writeZip, type ZipCodec } from "./zip";

export const COURSE_EXT = "pylonrace";
export const IMPORT_EXTS = [COURSE_EXT, "json"] as const;

const COURSE_ENTRY = "course.json";
const RUN_ENTRY = "run.json";

export class ShareFileError extends Error {}

const RUNS_NOT_SHARED = "Pylon Racer shares courses, not runs: .pylonrun files are no longer imported";

const enc = new TextEncoder();
const json = (value: unknown): Uint8Array => enc.encode(JSON.stringify(value, null, 1) + "\n");

export function packCourse(course: Course, codec: ZipCodec, modified?: Date): Uint8Array {
  return writeZip([{ name: COURSE_ENTRY, data: json(course) }], codec, modified);
}

/** Read any file the app can import. Throws ShareFileError, ZipError or a ZodError. */
export function unpack(bytes: Uint8Array, codec: ZipCodec, nowIso: string): Course {
  if (isZip(bytes)) {
    const entries = new Map(readZip(bytes, codec).map((e) => [e.name, e.data]));
    if (entries.has(RUN_ENTRY)) throw new ShareFileError(RUNS_NOT_SHARED);
    const courseBytes = entries.get(COURSE_ENTRY);
    if (courseBytes) return parseCourse(parseJson(courseBytes));
    throw new ShareFileError("This ZIP has no course in it");
  }

  const data = parseJson(bytes);
  if (isRctCourse(data)) return importRctCourse(data, nowIso);
  const format = typeof data === "object" && data !== null ? (data as { format?: unknown }).format : undefined;
  if (format === RUN_FORMAT) throw new ShareFileError(RUNS_NOT_SHARED);
  return parseCourse(data);
}

/** A file name for sharing: "Daggett Sprint.pylonrace". */
export function courseFileName(course: Pick<Course, "name">): string {
  return `${fileSafe(course.name) || "course"}.${COURSE_EXT}`;
}

/** Keep letters, digits, spaces and a few marks; drop what Windows, macOS or Linux refuse. */
function fileSafe(text: string): string {
  return text
    .replace(/[^\p{L}\p{N} ._()'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60)
    .trim();
}

function parseJson(bytes: Uint8Array): unknown {
  const text = new TextDecoder().decode(bytes).replace(/^﻿/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new ShareFileError("This isn't a Pylon Racer file (not a ZIP or JSON)");
  }
}
