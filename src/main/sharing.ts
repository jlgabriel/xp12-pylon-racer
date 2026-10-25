// Exchange files on the main side: the zlib codec, packing a stored course, and importing whatever
// the user hands us (dialog, drop, or a double-clicked file) into storage.
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { ZodError } from "zod";
import type { Course } from "../core/course/course";
import { packCourse, unpack } from "../core/files/share";
import type { ZipCodec } from "../core/files/zip";
import type { ImportReport } from "../shared/racerApi";
import { log } from "./log";
import type { Storage } from "./storage";

export const zlibCodec: ZipCodec = {
  deflateRaw: (data) => deflateRawSync(data, { level: 9 }),
  inflateRaw: (data, maxBytes) => inflateRawSync(data, { maxOutputLength: Math.max(1, maxBytes) }),
};

/** A file bigger than this is not one of ours (a course packs to a few KB). */
export const MAX_IMPORT_BYTES = 32 * 1024 * 1024;

export function courseFile(course: Course): Uint8Array {
  return packCourse(course, zlibCodec, new Date());
}

interface Outcome {
  courseId: string | null;
  line: string;
}

/** Import files one by one; a bad file is reported in its line and never stops the others. */
export function importFiles(storage: Storage, files: readonly { name: string; data: Uint8Array }[]): ImportReport {
  const report: ImportReport = { courseId: null, lines: [], failed: 0 };
  for (const f of files) {
    try {
      if (f.data.length > MAX_IMPORT_BYTES) throw new Error("The file is too big to be a course");
      const o = importOne(storage, f.data);
      if (o.courseId) report.courseId = o.courseId;
      report.lines.push(o.line);
      log.info(`imported ${f.name}: ${o.line}`);
    } catch (e) {
      report.failed++;
      report.lines.push(`${f.name}: ${importErrorText(e)}`);
      log.warn(`import failed: ${f.name}`, e);
    }
  }
  return report;
}

function importOne(storage: Storage, data: Uint8Array): Outcome {
  const course = unpack(data, zlibCodec, new Date().toISOString());
  const known = new Set(storage.listCourses().map((c) => c.id));
  const stored = storage.addCourse(course);
  return {
    courseId: stored.id,
    line: known.has(stored.id)
      ? `${stored.name}: already in your library.`
      : `${stored.name}: course added${stored.id !== course.id ? " (a different course with that name is kept too)" : ""}.`,
  };
}

function importErrorText(e: unknown): string {
  if (e instanceof ZodError) return "not a valid Pylon Racer course (it may come from a newer version of the app).";
  return e instanceof Error ? e.message : String(e);
}
