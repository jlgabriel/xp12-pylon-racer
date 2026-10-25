// Renders the icons in resources/ from their SVG sources: `npm run icons` (runs under Electron, so it
// needs no image library). Writes, for each source:
//   <name>.png   1024×1024 (electron-builder makes the app's .icns and Linux icons from icon.png)
//   <name>.ico   16–256 px, PNG entries (Windows: the app and the .pylonrace files)
//   <name>.icns  128–1024 px, PNG entries (macOS: the .pylonrace files)
// The outputs are committed; run this again only after changing an SVG.
const { app, BrowserWindow } = require("electron");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "resources");
const SOURCES = ["icon", "pylonrace"];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const ICNS = [
  ["ic07", 128],
  ["ic08", 256],
  ["ic09", 512],
  ["ic10", 1024],
];

app.disableHardwareAcceleration();

async function render(win, svg, size) {
  const html = `<html><body style="margin:0;background:transparent"><img width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`;
  win.setContentSize(size, size);
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
  await new Promise((r) => setTimeout(r, 150));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  return img.resize({ width: size, height: size, quality: "best" }).toPNG();
}

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([size, data], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e);
    head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); // planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map(([, d]) => d)]);
}

function icns(entries) {
  const parts = entries.map(([type, data]) => {
    const h = Buffer.alloc(8);
    h.write(type, 0, "ascii");
    h.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([h, data]);
  });
  const h = Buffer.alloc(8);
  h.write("icns", 0, "ascii");
  h.writeUInt32BE(8 + parts.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([h, ...parts]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } });
  win.webContents.setFrameRate(1);
  for (const name of SOURCES) {
    const svg = readFileSync(path.join(DIR, `${name}.svg`), "utf8");
    const png = async (s) => render(win, svg, s);
    writeFileSync(path.join(DIR, `${name}.png`), await png(1024));
    const small = [];
    for (const s of ICO_SIZES) small.push([s, await png(s)]);
    writeFileSync(path.join(DIR, `${name}.ico`), ico(small));
    const big = [];
    for (const [type, s] of ICNS) big.push([type, await png(s)]);
    writeFileSync(path.join(DIR, `${name}.icns`), icns(big));
    console.log(`resources/${name}: png, ico, icns`);
  }
  app.quit();
});
