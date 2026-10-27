/**
 * Builds the in-sim display plugin, tests its parser, and lays it out the way X-Plane loads it:
 *
 *   npm run plugin   ->  plugin/out/XPPylonRacer/win_x64/XPPylonRacer.xpl   (mac_x64, lin_x64 elsewhere)
 *                        plugin/build/.../xpr_listen   (the plugin's ears without the sim)
 *
 * The X-Plane SDK 4.3.0 is downloaded from Laminar into plugin/sdk/ the first time (not committed)
 * and checked against its hash. On Windows CMake comes from Visual Studio (Build Tools is enough),
 * found with vswhere; elsewhere from the PATH. The release workflow runs this same script on each
 * system and zips the three folders into one plugin download.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'plugin');
const SDK = join(SRC, 'sdk');
const BUILD = join(SRC, 'build');
const OUT = join(SRC, 'out', 'XPPylonRacer');

const SDK_URL = 'https://developer.x-plane.com/wp-content/plugins/code-sample-generation/sdk_zip_files/XPSDK430.zip';
const SDK_SHA256 = 'b9875ab27b593927b4f9b3e0ddfffe7401ee5dce6d86b50aea0da65f70ff7816';

const version = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string }).version;
const win = process.platform === 'win32';
const mac = process.platform === 'darwin';

async function fetchSdk(): Promise<void> {
  if (existsSync(join(SDK, 'SDK', 'CHeaders', 'XPLM', 'XPLMDisplay.h'))) return;
  console.log(`X-Plane SDK: ${SDK_URL}`);
  const res = await fetch(SDK_URL);
  if (!res.ok) throw new Error(`SDK download failed: HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  const sha = createHash('sha256').update(zip).digest('hex');
  if (sha !== SDK_SHA256) throw new Error(`SDK download is not XPSDK430.zip (sha256 ${sha})`);
  mkdirSync(SDK, { recursive: true });
  const file = join(SDK, 'XPSDK430.zip');
  writeFileSync(file, zip);
  // bsdtar reads zips on Windows 10+ and macOS; GNU tar does not (and Git Bash puts one first in the
  // PATH). On Windows only what it needs: the Mac frameworks hold symlinks Windows cannot make.
  if (process.platform === 'linux') execFileSync('unzip', ['-q', '-o', file, '-d', SDK], { stdio: 'inherit' });
  else if (mac) execFileSync('tar', ['-xf', file, '-C', SDK], { stdio: 'inherit' });
  else
    execFileSync(join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'tar.exe'), ['-xf', file, '-C', SDK, 'SDK/CHeaders', 'SDK/Libraries/Win', 'SDK/license.txt'], {
      stdio: 'inherit',
    });
}

function cmakeDir(): string {
  if (!win) return '';
  const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const vs = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], {
    encoding: 'utf8',
  }).trim();
  const bin = join(vs, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin');
  if (!vs || !existsSync(join(bin, 'cmake.exe'))) throw new Error('No Visual Studio with C++ and CMake found (vswhere)');
  return bin;
}

await fetchSdk();
const bin = cmakeDir();
const tool = (name: string): string => (bin ? join(bin, `${name}.exe`) : name);
const run = (exe: string, a: string[]): void => void execFileSync(exe, a, { stdio: 'inherit' });

run(tool('cmake'), ['-S', SRC, '-B', BUILD, `-DXPR_VERSION=${version}`, ...(win ? ['-A', 'x64'] : ['-DCMAKE_BUILD_TYPE=Release'])]);
run(tool('cmake'), ['--build', BUILD, '--config', 'Release']);
run(tool('ctest'), ['--test-dir', BUILD, '-C', 'Release', '--output-on-failure']);

const platform = win ? 'win_x64' : mac ? 'mac_x64' : 'lin_x64';
const built = win ? join(BUILD, 'Release', 'XPPylonRacer.xpl') : join(BUILD, 'XPPylonRacer.xpl');
const dest = join(OUT, platform, 'XPPylonRacer.xpl');
rmSync(join(OUT, platform), { recursive: true, force: true });
mkdirSync(join(OUT, platform), { recursive: true });
copyFileSync(built, dest);
// Apple silicon loads only signed code; an ad-hoc signature is what the linker gives a local build.
if (mac) run('codesign', ['--force', '--sign', '-', dest]);
console.log(`\nXP Pylon Racer plugin ${version}: ${dest}`);
