// Takes the README's screenshots from the renderer preview: `npm run preview:renderer` in one
// terminal, then `npx electron scripts/screenshots.cjs`. The preview runs the real core on demo
// flights (?mockracer), sped up (?fast) and ranked like real runs (?ranked), so nothing needs the
// simulator. Writes media/*.png at 1280×800 (the pinned view at 420×640).
const { app, BrowserWindow } = require("electron");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const URL = "http://localhost:5298/?mockracer&ranked&fast=6";
const OUT = path.join(__dirname, "..", "media");

app.disableHardwareAcceleration();

/** Runs in the page: small helpers to drive the UI the way a user would. */
const HELPERS = `
  window.__sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__button = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
  window.__course = async (name) => {
    [...document.querySelectorAll(".course")].find((b) => b.querySelector(".course-name").textContent === name).click();
    await window.__sleep(600);
  };
  window.__fly = async () => {
    window.__button("Watch demo").click();
    await window.__sleep(1500);
    for (let i = 0; i < 240 && !window.__button("Watch demo"); i++) await window.__sleep(250);
    await window.__sleep(800);
  };
  window.__pilot = async (name) => {
    document.querySelector(".pilot-button").click();
    await window.__sleep(200);
    const existing = [...document.querySelectorAll(".pilot-item button")].find((b) => b.textContent === name);
    if (existing) existing.click();
    else {
      window.__button("New pilot…").click();
      await window.__sleep(200);
      const input = document.querySelector(".pilot-menu input");
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, name);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.form.requestSubmit();
    }
    await window.__sleep(400);
  };
`;

async function shot(win, name) {
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage();
  writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
  console.log(`media/${name}.png`);
}

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1280, height: 800, useContentSize: true, show: false, webPreferences: { offscreen: true } });
  win.webContents.setZoomFactor(1);
  const run = (js) => win.webContents.executeJavaScript(`(async () => { ${js} })()`);
  await win.loadURL(URL);
  await run(HELPERS);
  await run(`await window.__sleep(1500);`);

  // Two pilots race the Daggett Air Show: a ranking, a result with splits.
  await run(`await window.__pilot("Rook"); await window.__course("Daggett Air Show"); await window.__fly();`);
  await run(`await window.__pilot("Maverick"); await window.__fly(); await window.__fly();`);
  await run(`document.querySelector(".race").scrollTop = 120;`);
  await shot(win, "race-result");
  await run(`document.querySelector(".race").scrollTop = 10000;`);
  await shot(win, "ranking");

  // Mid-race on the Stead oval.
  await run(`await window.__course("Stead Pylon Oval"); window.__button("Watch demo").click(); await window.__sleep(9000);`);
  await shot(win, "racing");
  await run(`window.__button("Stop demo")?.click(); await window.__sleep(300);`);

  // The designer on the Grand Canyon run, a gate open.
  await run(`await window.__course("Grand Canyon West River Run"); window.__button("Edit").click(); await window.__sleep(2500);
             document.querySelectorAll(".gate-row")[8].click(); await window.__sleep(2500);`);
  await shot(win, "designer");
  await run(`window.__button("Close").click(); await window.__sleep(300);`);

  // Pinned on top, in a corner over the simulator.
  await run(`window.__button("Pin on top").click(); await window.__course("Stead Pylon Oval"); window.__button("Watch demo").click(); await window.__sleep(6000);`);
  win.setContentSize(420, 640);
  await shot(win, "pinned");
  app.quit();
});
