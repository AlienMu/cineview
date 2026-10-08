import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { mkdir, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Gate threshold 1 (plan v3 §11): initial JS = core + scroll input + first presets (<= 40 KiB gzip);
 * the drag module is a separate chunk (<= 12 KiB gzip). Same esbuild settings as the 1.x measurement.
 */
export async function measureSize(repoRoot, outDir) {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const result = await build({
    absWorkingDir: repoRoot,
    entryPoints: { cineview: 'v2/src/index.ts' },
    outdir: outDir,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    treeShaking: true,
    legalComments: 'none',
    metafile: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const files = {};
  for (const name of await readdir(outDir)) {
    if (!name.endsWith('.js')) continue;
    const buf = await readFile(join(outDir, name));
    files[name] = { bytes: buf.byteLength, gzip: gzipSync(buf, { level: 9 }).byteLength };
  }
  const outputs = result.metafile.outputs;
  const entry = Object.keys(outputs).find((k) => outputs[k].entryPoint === 'v2/src/index.ts');
  const initial = new Set();
  const walk = (k) => {
    if (initial.has(k)) return;
    initial.add(k);
    for (const i of outputs[k]?.imports ?? []) if (i.kind !== 'dynamic-import') walk(i.path);
  };
  walk(entry);
  const base = (k) => k.split('/').pop();
  const sum = (keys) => keys.reduce((a, k) => a + (files[base(k)]?.gzip ?? 0), 0);
  const initialGzip = sum([...initial]);
  const lazy = Object.keys(outputs).filter((k) => k.endsWith('.js') && !initial.has(k));
  return { files, initialGzipKiB: +(initialGzip / 1024).toFixed(2), lazyGzipKiB: +(sum(lazy) / 1024).toFixed(2), budget: { initialKiB: 40, dragKiB: 12 } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await measureSize(process.cwd(), 'v2/.size'), null, 1));
}
