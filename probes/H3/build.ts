/**
 * Builds the probe H3 plugin and lays it out the way X-Plane loads it:
 *
 *   npm run probe:plugin   ->  probes/H3/XPR_H3_Display/win_x64/XPR_H3_Display.xpl
 *                              probes/H3/build/Release/xpr_h3_listen.exe   (the check without the sim)
 *
 * On Windows CMake comes from Visual Studio (Build Tools is enough), found with vswhere; elsewhere
 * from the PATH. The SDK is expected unpacked in probes/H3/sdk/SDK (4.3.0, not committed).
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'plugin');
const BUILD = join(HERE, 'build');
const OUT = join(HERE, 'XPR_H3_Display');

function cmake(): string {
  if (process.platform !== 'win32') return 'cmake';
  const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const vs = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], {
    encoding: 'utf8',
  }).trim();
  const exe = join(vs, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe');
  if (!vs || !existsSync(exe)) throw new Error('No Visual Studio with C++ and CMake found (vswhere)');
  return exe;
}

if (!existsSync(join(HERE, 'sdk', 'SDK', 'CHeaders', 'XPLM', 'XPLMDisplay.h'))) {
  console.error('The X-Plane SDK is missing: unpack XPSDK430.zip into probes/H3/sdk/ (developer.x-plane.com/sdk/plugin-sdk-downloads/)');
  process.exit(1);
}

const exe = cmake();
const run = (a: string[]): void => void execFileSync(exe, a, { stdio: 'inherit' });
run(['-S', SRC, '-B', BUILD, ...(process.platform === 'win32' ? ['-A', 'x64'] : ['-DCMAKE_BUILD_TYPE=Release'])]);
run(['--build', BUILD, '--config', 'Release']);

const platform = process.platform === 'win32' ? 'win_x64' : process.platform === 'darwin' ? 'mac_x64' : 'lin_x64';
const built = process.platform === 'win32' ? join(BUILD, 'Release', 'XPR_H3_Display.xpl') : join(BUILD, 'XPR_H3_Display.xpl');
mkdirSync(join(OUT, platform), { recursive: true });
copyFileSync(built, join(OUT, platform, 'XPR_H3_Display.xpl'));
console.log(`\n${join(OUT, platform, 'XPR_H3_Display.xpl')}`);
