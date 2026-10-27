// Bundle the 2.0 drag page's script (site/src/hero-drag/main.ts and the v1 geometry it imports) to
// site/public/hero/drag/drag.js. The v2 runtime stays an external import (copied by copy-v2-runtime).
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
await build({
  entryPoints: [join(site, 'src/hero-drag/main.ts')],
  outfile: join(site, 'public/hero/drag/drag.js'),
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  banner: { js: "import '/v2/cineview.js';" },
  logLevel: 'warning',
});
