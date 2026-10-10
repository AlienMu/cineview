import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Browser checks (P1.11, plan §15): the phase-1 probes, and the phase-2 ones as they come, in each
 * engine named on the command line (chromium, webkit; default chromium); per engine a log and a
 * JSON summary in review/v2-phase1-checks/.
 * Starts the dev server when it is not running and builds v2/dist when missing (first.mjs serves
 * its stylesheet). Chromium is Chrome unless CV_CHROMIUM names another build.
 *
 *   node v2/gate/checks.mjs webkit chromium [--only=motion,drag]
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const base = 'http://127.0.0.1:4360';
const PROBES = [
  'first',
  'enter',
  'output',
  'stagger',
  'motion',
  'drag',
  'video',
  'events',
  'react',
  'view',
  'stack',
  'covered',
  'deck',
  'track',
  'fixed',
];
const args = process.argv.slice(2);
const engines = args.filter((a) => !a.startsWith('--'));
if (!engines.length) engines.push('chromium');
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');
const probes = only ? PROBES.filter((p) => only.includes(p)) : PROBES;
const out = join(root, 'review/v2-phase1-checks');
mkdirSync(out, { recursive: true });

const up = async () => {
  try {
    return (await fetch(`${base}/motion.html`)).ok;
  } catch {
    return false;
  }
};
let server = null;
if (!(await up())) {
  const vite = join(
    dirname(createRequire(import.meta.url).resolve('vite/package.json')),
    'bin/vite.js'
  );
  server = spawn(process.execPath, [vite, '--config', join(root, 'v2/vite.config.mjs')], {
    cwd: root,
    stdio: 'ignore',
  });
  for (let i = 0; i < 150 && !(await up()); i++) await new Promise((r) => setTimeout(r, 200));
  if (!(await up())) throw new Error('dev server did not start on 4360');
}
if (!existsSync(join(root, 'v2/dist/cineview.css'))) {
  execFileSync(process.execPath, [join(root, 'v2/build.mjs')], { cwd: root, stdio: 'inherit' });
}

const run = (probe, engine) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, 'probes', `${probe}.mjs`), base], {
      cwd: root,
      env: { ...process.env, CV_ENGINE: engine },
    });
    let text = '';
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    const timer = setTimeout(() => child.kill(), 300_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, text });
    });
  });

const summary = {};
let failed = 0;
try {
  for (const engine of engines) {
    summary[engine] = {};
    let log = '';
    for (const probe of probes) {
      const { code, text } = await run(probe, engine);
      const lines = text.split('\n');
      const fails = lines.filter((l) => l.startsWith('FAIL'));
      const result = {
        pass: code === 0,
        ok: lines.filter((l) => l.startsWith('ok')).length,
        fail: fails.length,
        failures: fails.map((l) => l.slice(0, 300)),
      };
      summary[engine][probe] = result;
      if (!result.pass) failed++;
      log += `==== ${probe} (${engine})\n${text}\n`;
      console.log(
        `${result.pass ? 'PASS' : 'FAIL'} ${engine.padEnd(8)} ${probe.padEnd(8)} ok ${result.ok}${result.fail ? `, fail ${result.fail}` : ''}${code !== 0 && !result.fail ? ` (exit ${code})` : ''}`
      );
      for (const f of result.failures.slice(0, 5)) console.log(`     ${f}`);
    }
    writeFileSync(join(out, `${engine}.log`), log);
    const at = new Date().toISOString();
    writeFileSync(
      join(out, `${engine}.json`),
      JSON.stringify({ at, probes: summary[engine] }, null, 1)
    );
  }
  console.log(`logs and summaries in ${out}`);
} finally {
  server?.kill();
}
process.exit(failed ? 1 : 0);
