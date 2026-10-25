// The BUILT app against a throwaway X-Plane folder: install a course's pylons, check the pack X-Plane
// would load and the scenery_packs.ini line, save an edit through the real IPC, and remove the pylons
// again. No network: the edited course already has its terrain elevations, so saving does not look
// them up. XPR_XPLANE_DIR keeps the app away from any real X-Plane on the machine.
import { _electron as electron, expect, test } from "@playwright/test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAIN = path.join(ROOT, "out", "main", "index.js");
const INI = "I\n1000 Version\nSCENERY\n\nSCENERY_PACK *GLOBAL_AIRPORTS*\nSCENERY_PACK Custom Scenery/Someone Elses Pack/\n";

test("installs, edits and removes a course's pylons", async () => {
  const userData = mkdtempSync(path.join(tmpdir(), "racer-e2e-"));
  const xp = mkdtempSync(path.join(tmpdir(), "racer-xp12-"));
  const cs = path.join(xp, "Custom Scenery");
  mkdirSync(path.join(cs, "Someone Elses Pack"), { recursive: true });
  writeFileSync(path.join(cs, "scenery_packs.ini"), INI, "latin1");
  writeFileSync(path.join(userData, "settings.json"), JSON.stringify({ lastCourseId: "daggett-sprint" }));

  const app = await electron.launch({
    args: [MAIN, `--user-data-dir=${userData}`],
    cwd: ROOT,
    env: { ...process.env, XPR_XPLANE_DIR: xp },
  });
  try {
    const win = await app.firstWindow();
    win.on("dialog", (d) => void d.accept());
    await expect(win.getByRole("heading", { name: "Daggett Sprint" })).toBeVisible();
    await expect(win.getByText("Pylons not in X-Plane")).toBeVisible();

    await win.getByRole("button", { name: "Install pylons" }).click();
    await expect(win.getByText("Pylons installed. X-Plane reads scenery at startup: restart it to see them.")).toBeVisible();
    const pack = path.join(cs, "XPR_daggett-sprint");
    expect(readdirSync(pack).sort()).toEqual(["Earth nav data", "objects", "pylon-racer.json"]);
    expect(readdirSync(path.join(pack, "objects")).sort()).toEqual(
      ["blue", "green", "home", "red"].flatMap((m) => [`pylon_${m}.obj`, `pylon_${m}.png`]).sort(),
    );
    expect(readFileSync(path.join(pack, "Earth nav data", "+30-120", "+34-117.dsf")).subarray(0, 8).toString("latin1")).toBe("XPLNEDSF");
    const lines = readFileSync(path.join(cs, "scenery_packs.ini"), "latin1").split("\n");
    expect(lines[lines.indexOf("SCENERY_PACK *GLOBAL_AIRPORTS*") + 1]).toBe("SCENERY_PACK Custom Scenery/XPR_daggett-sprint/");

    // Edit the description and save: the gates are unchanged, so the install stays current.
    await win.getByRole("button", { name: "Edit" }).click();
    await win.getByRole("textbox").last().fill("Edited in the e2e.");
    await win.getByRole("button", { name: "Save" }).click();
    await expect(win.getByText("Course saved.")).toBeVisible();
    await expect(win.getByText("Pylons in X-Plane", { exact: true })).toBeVisible();
    const stored = JSON.parse(readFileSync(path.join(userData, "courses", "daggett-sprint.json"), "utf8"));
    expect(stored.description).toBe("Edited in the e2e.");

    await win.getByRole("button", { name: "Remove" }).click();
    await expect(win.getByText("Pylons removed from X-Plane.")).toBeVisible();
    expect(existsSync(pack)).toBe(false);
    expect(readFileSync(path.join(cs, "scenery_packs.ini"), "latin1")).toBe(INI);
    expect(readdirSync(cs).filter((n) => !n.startsWith("scenery_packs.ini"))).toEqual(["Someone Elses Pack"]);
  } finally {
    await app.close();
  }
});
