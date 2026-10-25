import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { courseRevision, type Course } from "../src/core/course/course";
import { demoFlight } from "../src/core/demo/demoFlight";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { packCourse } from "../src/core/files/share";
import { writeZip } from "../src/core/files/zip";
import type { Run } from "../src/core/run/run";
import { RaceSession } from "../src/core/session/raceSession";
import { courseFile, importFiles, zlibCodec } from "../src/main/sharing";
import { Storage } from "../src/main/storage";

const daggett = sampleCourses().find((c) => c.id === "daggett-sprint")!;
let userData: string;
let storage: Storage;

beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), "racer-share-"));
  storage = new Storage(userData);
  storage.init();
});

function fly(course: Course, pilot: string, id: string): Run {
  const session = new RaceSession(course, { pilot, appVersion: "0.4.0", newId: () => id, nowIso: () => "2026-10-21T12:00:00Z" });
  let run: Run | null = null;
  for (const f of demoFlight(course, { rateHz: 10 })) run = session.feed(f, { kind: "demo", hz: 10, aircraft: "Extra" }).run ?? run;
  return run!;
}

const file = (name: string, data: Uint8Array) => ({ name, data });

describe("importing a course", () => {
  it("adds a new course and opens it", () => {
    const course = { ...daggett, id: "friends-course", name: "Friend's Course" };
    const r = importFiles(storage, [file("Friend's Course.pylonrace", packCourse(course, zlibCodec))]);
    expect(r).toEqual({ courseId: "friends-course", lines: ["Friend's Course: course added."], failed: 0 });
    expect(storage.getCourse("friends-course")).toEqual(course);
  });

  it("recognizes a course it already has", () => {
    const r = importFiles(storage, [file("d.pylonrace", courseFile(daggett))]);
    expect(r.lines).toEqual(["Daggett Sprint: already in your library."]);
    expect(storage.listCourses().filter((c) => c.name === "Daggett Sprint")).toHaveLength(1);
  });

  it("keeps both when a different course has the same id", () => {
    const moved = { ...daggett, gates: daggett.gates.map((g) => ({ ...g, widthM: g.widthM + 10 })) };
    const r = importFiles(storage, [file("d.pylonrace", courseFile(moved))]);
    expect(r.courseId).toBe("daggett-sprint-2");
    expect(r.lines[0]).toMatch(/course added \(a different course/);
    expect(courseRevision(storage.getCourse("daggett-sprint")!)).toBe(courseRevision(daggett));
  });

  it("reports bad files one by one and imports the good ones", () => {
    const r = importFiles(storage, [
      file("notes.txt", new TextEncoder().encode("hello")),
      file("ok.pylonrace", courseFile({ ...daggett, id: "other", name: "Other" })),
    ]);
    expect(r.failed).toBe(1);
    expect(r.courseId).toBe("other");
    expect(r.lines[0]).toMatch(/^notes\.txt: This isn't a Pylon Racer file/);
  });
});

describe("runs are not shared", () => {
  it("refuses a v0.4.0-pre .pylonrun with a clear line, and imports nothing from it", () => {
    const run = fly(daggett, "Rodeo", "rodeo-run");
    const course = { ...daggett, id: "new-one", name: "New One" };
    const enc = new TextEncoder();
    const pylonrun = writeZip(
      [
        { name: "run.json", data: enc.encode(JSON.stringify(run)) },
        { name: "course.json", data: enc.encode(JSON.stringify(course)) },
      ],
      zlibCodec,
    );
    const r = importFiles(storage, [file("r.pylonrun", pylonrun)]);
    expect(r).toMatchObject({ courseId: null, failed: 1 });
    expect(r.lines[0]).toMatch(/^r\.pylonrun: Pylon Racer shares courses, not runs/);
    expect(storage.listRuns()).toEqual([]);
    expect(storage.getCourse("new-one")).toBeNull();
  });

  it("leaves the runs/imported folder of v0.4.0-pre unread", () => {
    mkdirSync(path.join(userData, "runs", "imported"), { recursive: true });
    writeFileSync(path.join(userData, "runs", "imported", "rodeo-run.json"), JSON.stringify(fly(daggett, "Rodeo", "rodeo-run")));
    storage.saveRun(fly(daggett, "Juan", "my-run"));
    const again = new Storage(userData);
    expect(again.listRuns().map((r) => r.id)).toEqual(["my-run"]);
    expect(again.getRun("rodeo-run")).toBeNull();
  });
});
