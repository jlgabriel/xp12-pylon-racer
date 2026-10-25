// Sharing through the BUILT app: a .pylonrace opened from the command line (what a double-click
// does on Windows), files dropped on the window (a course, and a v0.4.0-pre .pylonrun that is
// refused: runs are not shared), and a course shared back through the save dialog (stubbed in main,
// the one thing Playwright cannot click).
import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { demoFlight } from "../src/core/demo/demoFlight";
import { sampleCourses } from "../src/core/demo/sampleCourses";
import { packCourse, unpack } from "../src/core/files/share";
import { writeZip, type ZipCodec } from "../src/core/files/zip";
import type { Run } from "../src/core/run/run";
import { RaceSession } from "../src/core/session/raceSession";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAIN = path.join(ROOT, "out", "main", "index.js");
const codec: ZipCodec = {
  deflateRaw: (d) => deflateRawSync(d),
  inflateRaw: (d, max) => inflateRawSync(d, { maxOutputLength: Math.max(1, max) }),
};

/** The page's DOM, as far as the drop needs it (the e2e compiles without DOM types). */
interface PageGlobals {
  DataTransfer: new () => { items: { add(file: unknown): void } };
  File: new (parts: unknown[], name: string) => unknown;
  DragEvent: new (type: string, init: object) => unknown;
  dispatchEvent(event: unknown): boolean;
}

test("opens a shared course, takes dropped files and shares a course back", async () => {
  const userData = mkdtempSync(path.join(tmpdir(), "racer-e2e-"));
  const files = mkdtempSync(path.join(tmpdir(), "racer-files-"));
  const daggett = sampleCourses().find((c) => c.id === "daggett-sprint")!;
  const friends = { ...daggett, id: "friends-loop", name: "Friend's Loop", gates: daggett.gates.map((g) => ({ ...g, widthM: 110 })) };
  const coursePath = path.join(files, "Friend's Loop.pylonrace");
  writeFileSync(coursePath, packCourse(friends, codec));

  const session = new RaceSession(friends, { pilot: "Rodeo", appVersion: "0.4.0", newId: () => "rodeo-run", nowIso: () => new Date().toISOString() });
  let run: Run | null = null;
  for (const f of demoFlight(friends, { rateHz: 10 })) run = session.feed(f, { kind: "demo", hz: 10, aircraft: "Extra" }).run ?? run;
  const enc = new TextEncoder();
  const runBytes = [...writeZip([{ name: "run.json", data: enc.encode(JSON.stringify(run)) }], codec)];
  const second = { ...friends, id: "second-loop", name: "Second Loop", gates: friends.gates.map((g) => ({ ...g, widthM: 120 })) };
  const secondBytes = [...packCourse(second, codec)];

  const app = await electron.launch({
    args: [MAIN, coursePath, `--user-data-dir=${userData}`],
    cwd: ROOT,
    env: { ...process.env, XPR_XPLANE_DIR: mkdtempSync(path.join(tmpdir(), "racer-xp12-")) },
  });
  try {
    const win = await app.firstWindow();
    await expect(win.getByRole("heading", { name: "Friend's Loop" })).toBeVisible();
    await expect(win.getByText("Friend's Loop: course added.")).toBeVisible();

    // A real drop event, with a File the way the OS hands it to the page.
    await win.evaluate(
      ({ run, course }) => {
        const page = globalThis as unknown as PageGlobals;
        const dt = new page.DataTransfer();
        dt.items.add(new page.File([new Uint8Array(run)], "Friend's Loop - Rodeo.pylonrun"));
        dt.items.add(new page.File([new Uint8Array(course)], "Second Loop.pylonrace"));
        page.dispatchEvent(new page.DragEvent("drop", { dataTransfer: dt, cancelable: true }));
      },
      { run: runBytes, course: secondBytes },
    );
    await expect(win.getByText(/Rodeo\.pylonrun: Pylon Racer shares courses, not runs/)).toBeVisible();
    await expect(win.getByText("Second Loop: course added.")).toBeVisible();
    await expect(win.getByRole("heading", { name: "Second Loop" })).toBeVisible();

    const out = path.join(files, "shared.pylonrace");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog;
    }, out);
    await win.getByRole("button", { name: "Share…" }).first().click();
    await expect(win.getByText(/^Saved shared\.pylonrace\./)).toBeVisible();
    expect(unpack(new Uint8Array(readFileSync(out)), codec, "")).toEqual(second);
  } finally {
    await app.close();
  }
});
