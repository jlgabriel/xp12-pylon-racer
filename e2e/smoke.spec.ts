// Smoke test of the BUILT app (run with `npm run test:e2e`, which builds first): it boots with the
// packaged CSP and sandbox, seeds the sample courses into a fresh userData, and a demo flight drives
// the real main-process race loop to a saved run.
import { _electron as electron, expect, test } from "@playwright/test";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAIN = path.join(ROOT, "out", "main", "index.js");
const VERSION: string = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

test("boots, seeds the sample courses and races a demo flight to a saved run", async () => {
  const userData = mkdtempSync(path.join(tmpdir(), "racer-e2e-"));
  const app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    cwd: ROOT,
    env: { ...process.env, XPR_XPLANE_DIR: mkdtempSync(path.join(tmpdir(), "racer-xp12-")) },
  });
  try {
    const win = await app.firstWindow();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle())).toBe(
      `XP Pylon Racer ${VERSION}`,
    );

    await expect(win.getByRole("button", { name: /Munich Sprint/ })).toBeVisible();
    await expect(win.getByRole("button", { name: /Munich Diamond/ })).toBeVisible();
    await win.getByRole("button", { name: /Munich Sprint/ }).click();
    await expect(win.getByRole("heading", { name: "Munich Sprint" })).toBeVisible();

    await win.getByRole("button", { name: "Watch demo" }).click();
    await expect(win.getByText("Racing")).toBeVisible({ timeout: 15_000 });
    // 2.4 km at 80 m/s plus the lead-in: about 35 s.
    // A demo run is saved but never ranks, so it is never a new best.
    await expect(win.getByText("· not ranked")).toBeVisible({ timeout: 50_000 });

    const runs = readdirSync(path.join(userData, "runs")).filter((f) => f.endsWith(".json"));
    expect(runs).toHaveLength(1);
    const run = JSON.parse(readFileSync(path.join(userData, "runs", runs[0]!), "utf8"));
    expect(run).toMatchObject({ courseId: "munich-sprint", result: { status: "finished", penaltyTotal: 0 }, source: { kind: "demo" } });
  } finally {
    await app.close();
  }
});
