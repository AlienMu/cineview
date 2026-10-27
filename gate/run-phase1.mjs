import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * P1.12 regression measurement: the phase-0 gate cases for 2.0 on the current code, with the same
 * harness, run as the production build would (no development checks: CV_DEV=0). Chrome: capacity
 * and mix sweeps, heavy fixture (copy 400, as calibrated in phase 0), main-thread blocking. WebKit:
 * the fixed-N cases. Output has the phase-0 shapes, in review/v2-phase1-regression/, to set against
 * review/v2-phase0-gate-20261008/. 1.x is unchanged since phase 0 and only re-run with --with-v1,
 * except in the heavy fixture: the phase-0 prototype never started scroll scenes' canvases and
 * videos (it sent cv-activate only under drag), so its heavy scroll numbers are no baseline and
 * 1.x runs beside 2.0 there.
 *
 *   node gate/run-phase1.mjs [chrome] [webkit] [--with-v1]
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);
const v1 = args.includes('--with-v1');
const parts = args.filter((a) => !a.startsWith('--'));
if (!parts.length) parts.push('chrome', 'webkit');
const out = join(root, 'review/v2-phase1-regression');
mkdirSync(out, { recursive: true });

// Own dev server, without development checks, on a port of its own.
const port = 4363;
const base = `http://127.0.0.1:${port}`;
process.env.CV_BASE = base;
const up = async () => {
  try {
    return (await fetch(`${base}/v2.html`)).ok;
  } catch {
    return false;
  }
};
const vite = join(dirname(createRequire(import.meta.url).resolve('vite/package.json')), 'bin/vite.js');
const server = spawn(process.execPath, [vite, '--config', join(root, 'vite.config.mjs')], {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, CV_DEV: '0', CV_PORT: String(port) },
});
try {
  for (let i = 0; i < 150 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await up())) throw new Error(`dev server did not start on ${port}`);

  // First visits optimise dependencies and reload: keep that out of the samples.
  const { chromium, webkit } = await import('playwright');
  for (const part of parts) {
    const engine = part === 'webkit' ? webkit : chromium;
    const browser = await engine.launch(
      part === 'webkit' ? {} : process.env.CV_CHROMIUM ? { executablePath: process.env.CV_CHROMIUM } : { channel: 'chrome' }
    );
    for (const page of v1 ? ['/v2.html', '/v2-heavy.html', '/v1/index.html', '/v1/heavy.html'] : ['/v2.html', '/v2-heavy.html', '/v1/heavy.html']) {
      const p = await browser.newPage();
      await p.goto(base + page);
      await p.waitForTimeout(2000);
      await p.close();
    }
    await browser.close();
  }

  if (parts.includes('chrome')) {
    const { runCapacitySweep } = await import('./run-capacity.mjs');
    const { runHeavy } = await import('./run-heavy.mjs');
    const { runStress } = await import('./run-stress.mjs');
    console.log('== Chrome capacity and mix sweeps');
    await runCapacitySweep(join(out, 'capacity-chrome.json'), { v1 });
    console.log('== Chrome heavy fixture');
    await runHeavy(join(out, 'heavy-chrome.json'), { v1: true, copies: v1 ? [40, 160, 400] : [400] });
    console.log('== Chrome main-thread blocking');
    await runStress(join(out, 'stress-chrome.json'), { v1 });
  }
  if (parts.includes('webkit')) {
    const { runEngines } = await import('./run-engines.mjs');
    console.log('== WebKit fixed-N cases');
    await runEngines(join(out, 'engines-webkit.json'), { engines: ['webkit'], v1 });
  }
  console.log(`results in ${out}`);
} finally {
  server.kill();
}
