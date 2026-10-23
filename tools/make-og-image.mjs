// Renders tools/og-image.html into icons/og-image.png, the 1200×630 link preview for hosted copies.
// Uses Google Chrome in headless mode with a throwaway profile (set CHROME to its path if it lives
// elsewhere) and needs the network for the web fonts. Usage: node tools/make-og-image.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'mezzanine-og-'));
try {
  execFileSync(chrome, [
    '--headless=new', '--user-data-dir=' + profile, '--no-first-run', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=10000',
    '--screenshot=' + resolve('icons/og-image.png'), pathToFileURL(resolve('tools/og-image.html')).href,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
} finally {
  rmSync(profile, { recursive: true, force: true });
}
console.log('wrote icons/og-image.png');
