// Write a file, or leave the previous one intact — never anything in between. The new content is
// written beside the destination and renamed into place; rename is atomic on NTFS and POSIX alike.
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const TMP_SUFFIX = ".racer-tmp";

export function writeFileAtomic(file: string, data: string | Uint8Array): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + TMP_SUFFIX;
  if (typeof data === "string") writeFileSync(tmp, data, "utf8");
  else writeFileSync(tmp, data);
  try {
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}
