import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { Storage } from "../src/main/storage";

const rules = sampleCourses().find((c) => c.id === "kdag-rules-test")!;
let storage: Storage;
let userData: string;

beforeEach(() => {
  userData = mkdtempSync(path.join(tmpdir(), "racer-storage-"));
  storage = new Storage(userData);
  storage.init();
});

describe("sample courses", () => {
  it("take the newer text of the same revision on the next launch", () => {
    storage.saveCourse({ ...rules, description: "old words", updatedAt: "2026-10-18T00:00:00Z" });
    new Storage(userData).init();
    expect(storage.getCourse(rules.id)!.description).toBe(rules.description);
  });

  it("are left alone once the user saved them", () => {
    storage.saveCourse({ ...rules, description: "my notes", updatedAt: "2026-10-22T10:00:00Z" });
    new Storage(userData).init();
    expect(storage.getCourse(rules.id)!.description).toBe("my notes");
  });

  it("are left alone after a user's edit, even one stamped earlier than the shipped text", () => {
    storage.saveCourse({ ...rules, name: "My rules", updatedAt: "2026-10-18T09:30:00.000Z" });
    new Storage(userData).init();
    expect(storage.getCourse(rules.id)!.name).toBe("My rules");
  });

  it("are left alone when the user moved a gate", () => {
    const moved = { ...rules, updatedAt: "2026-10-18T00:00:00Z", gates: rules.gates.map((g) => ({ ...g, widthM: 120 })) };
    storage.saveCourse(moved);
    new Storage(userData).init();
    expect(storage.getCourse(rules.id)!.gates[0]!.widthM).toBe(120);
  });

  it("stay deleted", () => {
    storage.deleteCourse(rules.id);
    new Storage(userData).init();
    expect(storage.getCourse(rules.id)).toBeNull();
  });
});
