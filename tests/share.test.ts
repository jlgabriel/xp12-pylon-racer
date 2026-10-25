import { readFileSync } from "node:fs";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { demoFlight } from "../src/core/demo/demoFlight";
import { courseFileName, packCourse, ShareFileError, unpack } from "../src/core/files/share";
import { crc32, isZip, readZip, writeZip, ZipError, type ZipCodec } from "../src/core/files/zip";
import type { Run } from "../src/core/run/run";
import { RaceSession } from "../src/core/session/raceSession";

const codec: ZipCodec = {
  deflateRaw: (d) => deflateRawSync(d),
  inflateRaw: (d, max) => inflateRawSync(d, { maxOutputLength: Math.max(1, max) }),
};
const enc = new TextEncoder();
const NOW = "2026-10-21T12:00:00Z";
const daggett = sampleCourses().find((c) => c.id === "daggett-sprint")!;

function flownRun(): Run {
  const session = new RaceSession(daggett, { pilot: "Juan", appVersion: "0.4.0", newId: () => "run-1", nowIso: () => NOW });
  let run: Run | null = null;
  for (const f of demoFlight(daggett, { rateHz: 10 })) run = session.feed(f, { kind: "demo", hz: 10, aircraft: "Extra" }).run ?? run;
  return run!;
}

describe("zip", () => {
  it("round-trips stored and deflated entries, names in UTF-8", () => {
    const entries = [
      { name: "course.json", data: enc.encode(JSON.stringify({ a: "x".repeat(2000) })) },
      { name: "ñandú.bin", data: new Uint8Array([1, 2, 3]) },
      { name: "empty", data: new Uint8Array(0) },
    ];
    const zip = writeZip(entries, codec);
    expect(isZip(zip)).toBe(true);
    const back = readZip(zip, codec);
    expect(back.map((e) => e.name)).toEqual(["course.json", "ñandú.bin", "empty"]);
    back.forEach((e, i) => expect([...e.data]).toEqual([...entries[i]!.data]));
    expect(zip.length).toBeLessThan(500); // the repetitive JSON was deflated
  });

  it("reads a ZIP written by another tool (Windows' Compress-Archive)", () => {
    const zip = new Uint8Array(readFileSync(new URL("fixtures/external.zip", import.meta.url)));
    const entries = readZip(zip, codec);
    const course = entries.find((e) => e.name === "course.json");
    expect(course).toBeDefined();
    expect(JSON.parse(new TextDecoder().decode(course!.data)).name).toBe("Daggett Sprint");
  });

  it("knows the standard CRC-32", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });

  it("refuses damaged, truncated and oversized files", () => {
    const zip = writeZip([{ name: "a.json", data: enc.encode("{".repeat(5000)) }], codec);
    expect(() => readZip(zip.subarray(0, zip.length - 30), codec)).toThrow(ZipError);
    expect(() => readZip(new Uint8Array(10), codec)).toThrow(ZipError);
    const flipped = zip.slice();
    flipped[40] = flipped[40]! ^ 0xff; // inside the deflated body
    expect(() => readZip(flipped, codec)).toThrow(ZipError);
    expect(() => readZip(zip, codec, 1000)).toThrow(/more than this app ever writes/);
  });
});

describe("exchange files", () => {
  it("a .pylonrace carries the course unchanged", () => {
    expect(unpack(packCourse(daggett, codec), codec, NOW)).toEqual(daggett);
  });

  it("takes bare JSON too: a native course, the old tool's course.json", () => {
    expect(unpack(enc.encode("﻿" + JSON.stringify(daggett)), codec, NOW)).toEqual(daggett);
    const rct = readFileSync(new URL("fixtures/munich_multicolor.json", import.meta.url));
    expect(unpack(new Uint8Array(rct), codec, NOW).gates.length).toBeGreaterThan(2);
  });

  it("refuses runs, as a v0.4.0-pre .pylonrun or as bare JSON", () => {
    const run = flownRun();
    const pylonrun = writeZip(
      [
        { name: "run.json", data: enc.encode(JSON.stringify(run)) },
        { name: "course.json", data: enc.encode(JSON.stringify(daggett)) },
      ],
      codec,
    );
    expect(() => unpack(pylonrun, codec, NOW)).toThrow(/shares courses, not runs/);
    expect(() => unpack(enc.encode(JSON.stringify(run)), codec, NOW)).toThrow(/shares courses, not runs/);
  });

  it("says plainly when a file is not one of ours", () => {
    expect(() => unpack(enc.encode("hello"), codec, NOW)).toThrow(ShareFileError);
    expect(() => unpack(writeZip([{ name: "readme.txt", data: enc.encode("hi") }], codec), codec, NOW)).toThrow(/no course in it/);
    expect(() => unpack(enc.encode(JSON.stringify({ format: "pylon-racer/course", version: 1 })), codec, NOW)).toThrow();
  });

  it("names the file after the course", () => {
    expect(courseFileName({ name: "KDAG: Rules/Test?" })).toBe("KDAG Rules Test.pylonrace");
  });
});
