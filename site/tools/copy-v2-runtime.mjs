// Copies the built 2.0 runtime (v2/dist, from `node v2/build.mjs`) into site/public/v2/ for the
// static /hero/ page. Runs before `vite` and `vite build` (predev / prebuild). The copy is ignored by
// Git; the source of truth stays v2/src.
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '../../v2/dist');
const out = join(here, '../public/v2');

export async function copyV2Runtime({ from = dist, to = out } = {}) {
  try {
    await stat(join(from, 'cineview.js'));
  } catch {
    throw new Error(`No 2.0 runtime at ${from}: run \`node v2/build.mjs\` first.`);
  }
  await rm(to, { recursive: true, force: true });
  await mkdir(to, { recursive: true });
  for (const file of ['cineview.js', 'cineview.css', 'chunks']) {
    await cp(join(from, file), join(to, file), { recursive: true });
  }
  return to;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`2.0 runtime copied to ${await copyV2Runtime()}`);
}
