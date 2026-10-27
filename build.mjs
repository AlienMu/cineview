/**
 * 2.0 build: ESM only (plan v3 §19).
 *
 *   dist/cineview.js        production entry (minified); drag input is a lazy chunk
 *   dist/dev/cineview.js    development entry (readable, craft warnings on)
 *   dist/cineview.css       boot styles for the page <head> (plan v3 §10)
 *   dist/head.js            the inline <head> snippet that sets `.cv-js`, with its CSP hash
 *   dist/types/             public declarations (index.d.ts; jsx.d.ts = React 19 JSX), checked
 *                              by compiling types-test/usage.tsx against them
 *
 * Size budget (plan v3 §11 threshold 1, raised from 40 by the owner on 2026-10-28): initial JS =
 * entry + its static imports <= 44 KiB gzip;
 * the drag chunk <= 12 KiB gzip. Over budget fails the build.
 *
 *   node build.mjs           build both, print sizes, enforce the budget
 *   node build.mjs --json    same, sizes as JSON on stdout
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(here, 'src/index.ts');
const BUDGET_KIB = { initial: 44, drag: 12 };
/** Baseline browsers (plan v3 §2). */
const TARGET = ['chrome111', 'edge111', 'firefox128', 'safari16.4', 'ios16.4'];

export async function bundle(outdir, dev) {
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
/**
 * gzip size a lazy chunk ADDS: every output reachable from the first output whose inputs match
 * `entry`, its static imports included, MINUS what the initial graph already loads. The graph is
 * shared, so counting shared chunks here would charge the same bytes twice (review F-15).
 */
async function lazyGraphKiB(metafile, entry, initialPaths) {
  const outputs = metafile.outputs;
  const start = Object.entries(outputs).find(([, o]) =>
    (o.inputs ? Object.keys(o.inputs) : []).some((i) => entry.test(i))
  );
  if (!start) {
    console.error(`budget: no output takes an input matching ${entry}`);
    return 0;
  }
  const seen = new Set();
  const walk = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    for (const i of outputs[k]?.imports ?? []) if (i.kind === 'import-statement') walk(i.path);
  };
  walk(start[0]);
  let bytes = 0;
  for (const k of seen) {
    if (initialPaths.has(k)) continue;
    bytes += gzipSync(await readFile(k), { level: 9 }).byteLength;
  }
  return +(bytes / 1024).toFixed(2);
}

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
  return { initialKiB: +(initialBytes / 1024).toFixed(2), lazyKiB: lazy, initial };
}

/**
 * The package is `"type": "module"`, so TypeScript under `node16`/`nodenext` reads its declarations
 * as ES modules and needs explicit extensions on relative imports. The source keeps bundler-style
 * imports; the emitted declarations get `.js` (or `/index.js` for a directory).
 */
async function addDeclarationExtensions(dir) {
  const { readdir, readFile, writeFile, stat } = await import('node:fs/promises');
  const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.d.ts'));
  for (const file of files) {
    const path = join(dir, file);
    const text = await readFile(path, 'utf8');
    const out = [];
    let last = 0;
    for (const m of text.matchAll(/(from\s+|import\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g)) {
      const spec = m[3];
      let fixed = spec;
      if (!/\.(js|json|css)$/.test(spec)) {
        const base = join(dirname(path), spec);
        const isDir = await stat(base).then((s) => s.isDirectory(), () => false);
        fixed = isDir ? `${spec}/index.js` : `${spec}.js`;
      }
      out.push(text.slice(last, m.index), m[1], m[2], fixed, m[2]);
      last = m.index + m[0].length;
    }
    out.push(text.slice(last));
    const next = out.join('');
    if (next !== text) await writeFile(path, next);
  }
}

async function main() {
  const prod = await bundle(join(here, 'dist'), false);
  await bundle(join(here, 'dist/dev'), true);
  // Public declarations, then a compile check of their use (internals unreachable, React 19 JSX).
  {
    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    execFileSync(process.execPath, [tsc, '-p', join(here, 'tsconfig.types.json')], {
      stdio: 'inherit',
    });
    await addDeclarationExtensions(join(here, 'dist/types'));
    // The Node-resolution check imports 'cineview' as a dependency: link it to this package.
    {
      const { mkdir, symlink, lstat } = await import('node:fs/promises');
      const link = join(here, 'types-test/nodenext/node_modules/cineview');
      await mkdir(dirname(link), { recursive: true });
      if (!(await lstat(link).catch(() => null))) await symlink(here, link, 'dir');
    }
    // Bundler resolution (types-test/tsconfig.json) and Node's own (tsconfig.nodenext.json).
    for (const config of ['types-test/tsconfig.json', 'types-test/tsconfig.nodenext.json']) {
      execFileSync(process.execPath, [tsc, '-p', join(here, config)], { stdio: 'inherit' });
    }
  }
  const report = await sizes(prod);
  // The drag chunk is the one whose inputs include src/input/drag.ts; a name prefix would report 0
  // silently if the chunk were renamed (review F-15). Its static imports load with it.
  const dragKiB = await lazyGraphKiB(prod, /(^|\/)input\/drag\.ts$/, report.initial);
  // Boot stylesheet and head snippet, generated from the same preset definitions as the runtime.
  {
    const out = join(here, 'dist/.boot.mjs');
    await build({
      entryPoints: [join(here, 'src/boot.ts')],
      outfile: out,
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      define: { __DEV__: 'false' },
      logLevel: 'warning',
    });
    const { bootCss, HEAD_SNIPPET } = await import(`${out}?${Date.now()}`);
    await rm(out);
    await writeFile(join(here, 'dist/cineview.css'), `${bootCss()}\n`);
    const surface = await import(`${pathToFileURL(join(here, 'surface.mjs')).href}`);
    await surface.buildSurface();
    const hash = createHash('sha256').update(HEAD_SNIPPET).digest('base64');
    await writeFile(
      join(here, 'dist/head.js'),
      `// Inline in <head>, before cineview.css. CSP: script-src 'sha256-${hash}'\n${HEAD_SNIPPET}\n`
    );
  }

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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
