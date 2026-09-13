#!/usr/bin/env node
/**
 * Real-device acceptance wrapper for drag/scroll paths
 * Runs closing-acceptance.mjs with performance monitoring
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const base = process.env.CINEVIEW_SITE_URL ?? 'http://127.0.0.1:4174';
const outputDir = new URL('../../output/acceptance-run/', import.meta.url);
mkdirSync(outputDir, { recursive: true });

console.log(`Running acceptance tests against ${base}`);
console.log(`Output: ${outputDir.pathname}`);

const env = {
  ...process.env,
  CINEVIEW_SITE_URL: base,
};

const child = spawn('node', ['./tools/closing-acceptance.mjs'], {
  cwd: new URL('../', import.meta.url).pathname,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  console.log(`Acceptance tests exited with code ${code}`);
  process.exit(code ?? 1);
});
