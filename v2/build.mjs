/**
 * 2.0 build: ESM only (plan v3 §19).
 *
 *   v2/dist/cineview.js        production entry (minified); drag input is a lazy chunk
 *   v2/dist/dev/cineview.js    development entry (readable, craft warnings on)
 *
 * Size budget (plan v3 §11 threshold 1): initial JS = entry + its static imports <= 40 KiB gzip;
 * the drag chunk <= 12 KiB gzip. Over budget fails the build.
 *
 *   node v2/build.mjs           build both, print sizes, enforce the budget
 *   node v2/build.mjs --json    same, sizes as JSON on stdout
 */
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, 'src/index.ts');
const BUDGET_KIB = { initial: 40, drag: 12 };
/** Baseline browsers (plan v3 §2). */
const TARGET = ['chrome111', 'edge111', 'firefox128', 'safari16.4', 'ios16.4'];

async function bundle(outdir, dev) {
  await rm(outdir, { recursive: true, force: true });
  const result = await build({
    entryPoints: { cineview: ENTRY },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: TARGET,
    minify: !dev,
    treeShaking: true,
    legalComments: 'none',
    chunkNames: 'chunks/[name]-[hash]',
    define: { __DEV__: dev ? 'true' : 'false' },
    metafile: true,
    sourcemap: dev ? 'linked' : false,
    logLevel: 'warning',
  });
  return result.metafile;
}

/** gzip sizes of the initial graph (static imports from the entry) and of each lazy chunk. */
async function sizes(metafile) {
  const outputs = metafile.outputs;
  const entry = Object.keys(outputs).find((k) => outputs[k].entryPoint);
  const initial = new Set();
  const walk = (k) => {
    if (initial.has(k)) return;
    initial.add(k);
    for (const i of outputs[k]?.imports ?? []) if (i.kind === 'import-statement') walk(i.path);
  };
  walk(entry);
  const gz = async (k) => gzipSync(await readFile(k), { level: 9 }).byteLength;
  let initialBytes = 0;
  for (const k of initial) initialBytes += await gz(k);
  const lazy = {};
  for (const k of Object.keys(outputs)) {
    if (!k.endsWith('.js') || initial.has(k)) continue;
    lazy[relative(here, k)] = +((await gz(k)) / 1024).toFixed(2);
  }
  return { initialKiB: +(initialBytes / 1024).toFixed(2), lazyKiB: lazy };
}

const prod = await bundle(join(here, 'dist'), false);
await bundle(join(here, 'dist/dev'), true);
const report = await sizes(prod);
const dragKiB = Object.entries(report.lazyKiB)
  .filter(([k]) => /\/drag-/.test(k))
  .reduce((a, [, v]) => a + v, 0);
const over = [];
if (report.initialKiB > BUDGET_KIB.initial) over.push(`initial ${report.initialKiB} KiB`);
if (dragKiB > BUDGET_KIB.drag) over.push(`drag ${dragKiB} KiB`);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...report, dragKiB, budget: BUDGET_KIB, over }, null, 1));
} else {
  console.log(
    `initial ${report.initialKiB} KiB gzip (budget ${BUDGET_KIB.initial}), drag ${dragKiB} KiB (budget ${BUDGET_KIB.drag})`
  );
}
if (over.length) {
  console.error(`Over budget: ${over.join(', ')}`);
  process.exit(1);
}
