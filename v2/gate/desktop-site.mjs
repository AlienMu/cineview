import { build, preview } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundle } from '../build.mjs';
import fixtureConfig from '../vite.config.mjs';

/** Build only the V2 composition fixture. No HMR or historical comparator input. */
export async function prepareDesktopSite(output, entry = 'combinations') {
  if (!['combinations', 'integrated'].includes(entry))
    throw new Error(`Unknown V2 fixture ${entry}`);
  const directory = resolve(output),
    runtime = resolve(directory, 'runtime');
  await mkdir(directory, { recursive: true });
  const metafile = await bundle(runtime, false);
  // The isolated output is outside a V2 package. Preserve the entry's element registration
  // instead of inheriting the repository package's CSS-only sideEffects annotation.
  await writeFile(
    resolve(runtime, 'package.json'),
    JSON.stringify({ type: 'module', sideEffects: true })
  );
  await writeFile(resolve(directory, 'runtime-metafile.json'), JSON.stringify(metafile, null, 2));
  await build({
    ...fixtureConfig,
    configFile: false,
    resolve: {
      ...fixtureConfig.resolve,
      alias: { ...fixtureConfig.resolve.alias, '@v2': resolve(runtime, 'cineview.js') },
    },
    define: { __DEV__: 'false' },
    build: {
      outDir: resolve(directory, 'site'),
      emptyOutDir: true,
      ...(entry === 'integrated' ? { assetsInlineLimit: 0 } : {}),
      rollupOptions: { input: { [entry]: resolve(`v2/fixtures/${entry}.html`) } },
    },
  });
  return resolve(directory, 'site');
}

/** Serve that built fixture with Vite preview, retaining any existing development servers. */
export async function serveDesktopSite(directory, port = 4382) {
  const server = await preview({
    configFile: false,
    root: resolve('v2/fixtures'),
    build: { outDir: resolve(directory) },
    preview: { host: '127.0.0.1', port, strictPort: true },
  });
  server.printUrls();
  return server;
}
