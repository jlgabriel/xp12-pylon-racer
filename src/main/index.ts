// Electron main — window lifecycle, IPC registration and the hardening: sandboxed renderer, no
// navigation, no permissions, and a CSP on the packaged renderer. All I/O lives behind main/ipc.ts.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, session, shell } from "electron";
import { findInstallations, readVersion } from "./findInstallations";
import { Installer } from "./installer";
import { applyOnTop, registerIpc, type IpcHandle } from "./ipc";
import { LOG_FILE_NAME, log } from "./log";
import { mayNavigate } from "./navigation";
import { RaceController } from "./race";
import { Storage } from "./storage";
import { TelemetryHub } from "./telemetry";
import icon from "../../resources/icon.png?asset";

declare const __APP_VERSION__: string;

// electron-vite sets this in dev (the Vite dev-server URL); undefined in a packaged build.
const RENDERER_URL = process.env["ELECTRON_RENDERER_URL"];

log.init(join(app.getPath("userData"), LOG_FILE_NAME));

// Log, then crash as Node would have: registering these handlers suppresses the default exit, and a
// main process limping on in an unknown state is worse than a crash.
const fatal = (what: string) => (e: unknown) => {
  log.error(`${what} — quitting`, e);
  console.error(`[main] ${what}:`, e);
  process.exit(1);
};
process.on("uncaughtException", fatal("uncaught exception in main"));
process.on("unhandledRejection", fatal("unhandled promise rejection in main"));

// Packaged renderer only: Vite's dev HMR needs inline scripts and a websocket. img-src allows https
// for the designer's map tiles; every other fetch goes through main.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

// One instance: a second launch (double-clicking a .pylonrace while the app runs) hands its files to
// the first and quits. Two instances would also fight over the telemetry ports.
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();

const OPENABLE = /\.pylonrace$/i;
/** Exchange files on a command line (Windows and Linux pass the double-clicked file as an argument). */
const filesIn = (argv: readonly string[]): string[] => argv.slice(1).filter((a) => OPENABLE.test(a) && existsSync(a));
let ipc: IpcHandle | null = null;
const toOpen: string[] = filesIn(process.argv);
const openFiles = (paths: readonly string[]): void => {
  if (ipc) ipc.openFiles(paths);
  else toOpen.push(...paths);
};

const storage = new Storage(app.getPath("userData"));
const hub = new TelemetryHub();
const race = new RaceController(storage, hub);
// Laminar's installation list is read once: it names every X-Plane 12 on the machine, the first
// usable one is the default, and the pilot can point at another (Settings override). The e2e sets
// XPR_XPLANE_DIR so it never installs into a real simulator.
let foundXplane: string | null = null;
const xplaneDir = (): string => {
  const override = process.env["XPR_XPLANE_DIR"] ?? storage.readSettings().xplaneDir;
  if (override) return override;
  foundXplane ??= findInstallations().find((i) => i.usable)?.path ?? "";
  return foundXplane;
};
const xplaneVersion = (): string | null => (xplaneDir() ? (readVersion(xplaneDir()) ?? null) : null);
const installer = new Installer(xplaneDir, __APP_VERSION__);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    // Small enough to sit in a corner over the simulator (the narrow layout drops the side list).
    minWidth: 380,
    minHeight: 320,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0b0e16", // --surface-0, so the window does not flash another color on load
    icon, // the taskbar and window icon in dev and on Linux; packaged Windows and macOS use the bundle's
    title: `XP Pylon Racer ${__APP_VERSION__}`,
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The page's <title> would otherwise replace the versioned window title on load.
  win.on("page-title-updated", (event) => event.preventDefault());
  win.once("ready-to-show", () => win.show());
  if (storage.readSettings().onTop) applyOnTop(win, true);

  race.attach({
    live: (u) => {
      if (!win.isDestroyed()) win.webContents.send("racer:live", u);
    },
    runSaved: (r) => {
      if (!win.isDestroyed()) win.webContents.send("racer:runSaved", r);
    },
  });
  win.on("closed", () => race.detach());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  const guard = (event: { preventDefault(): void }, url: string): void => {
    if (mayNavigate(url, RENDERER_URL)) return;
    event.preventDefault();
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);
  win.webContents.on("did-fail-load", (_e, code, desc, url) => log.error(`renderer failed to load (${code} ${desc}): ${url}`));
  win.webContents.on("render-process-gone", (_e, d) => log.error(`renderer gone: ${d.reason} (exit ${d.exitCode})`));

  if (RENDERER_URL) void win.loadURL(RENDERER_URL);
  else void win.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}

// macOS opens documents through this event, possibly before ready.
app.on("open-file", (event, file) => {
  event.preventDefault();
  if (OPENABLE.test(file)) openFiles([file]);
});

app.on("second-instance", (_event, argv) => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
  openFiles(filesIn(argv));
});

app.whenReady().then(() => {
  if (!firstInstance) return;
  log.info(
    `XP Pylon Racer ${__APP_VERSION__} · Electron ${process.versions.electron} · ${process.platform} ${process.arch} · ` +
      `${app.isPackaged ? "packaged" : "dev"} · userData ${app.getPath("userData")}`,
  );
  log.info(`X-Plane folder ${xplaneDir() || "(none found)"} · version ${xplaneVersion() ?? "unknown"}`);
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  if (!RENDERER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [CSP] } });
    });
  }

  storage.init();
  ipc = registerIpc({ storage, race, installer, xplaneDir, xplaneVersion, userData: app.getPath("userData") });
  ipc.openFiles(toOpen.splice(0));
  hub.start();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  hub.stop();
  log.info("quitting");
});
