// Session log in userData (pylon-racer.log), truncated at every launch. Plain lines, timestamped.
// It is what a user can send when something goes wrong, so it must never throw.
import { appendFileSync, writeFileSync } from "node:fs";

export const LOG_FILE_NAME = "pylon-racer.log";

let file: string | null = null;

function write(level: string, message: string, err?: unknown): void {
  const detail = err instanceof Error ? ` — ${err.stack ?? err.message}` : err !== undefined ? ` — ${String(err)}` : "";
  const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}${detail}\n`;
  if (!file) return;
  try {
    appendFileSync(file, line, "utf8");
  } catch {
    /* logging must never break the app */
  }
}

export const log = {
  init(path: string): void {
    file = path;
    try {
      writeFileSync(path, "", "utf8");
    } catch {
      file = null;
    }
  },
  info: (m: string): void => write("INFO", m),
  warn: (m: string, e?: unknown): void => write("WARN", m, e),
  error: (m: string, e?: unknown): void => write("ERROR", m, e),
};
