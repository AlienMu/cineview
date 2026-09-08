import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(fixtureRoot, '../..');

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function expectSuccess(label, result) {
  if (result.status === 0) return;
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  throw new Error(`${label} failed:\n${output.slice(-3000)}`);
}

function expectFailure(label, script, env, expectedOutput) {
  const result = spawnSync(process.execPath, [script], {
    cwd: fixtureRoot,
    env: { ...process.env, CINEVIEW_ACC_SKIP_BUILD: '1', ...env },
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) {
    throw new Error(`${label} did not fail under deliberate fault injection`);
  }
  if (!output.includes(expectedOutput)) {
    throw new Error(`${label} failed for the wrong reason:\n${output.slice(-3000)}`);
  }
  console.log(`✓ ${label} rejects the injected failure`);
}

expectSuccess('framework library build', run('pnpm', ['build'], repositoryRoot));
expectSuccess('browser acceptance fixture build', run('pnpm', ['build:acceptance'], fixtureRoot));

expectFailure(
  'drag browser assertion gate',
  'acceptance-drag.mjs',
  { CINEVIEW_ACC_INJECT: 'assertion' },
  'browser acceptance assertion failed'
);
expectFailure(
  'active scene inert gate',
  'acceptance-drag.mjs',
  { CINEVIEW_ACC_INJECT: 'active-scene-hidden' },
  'current scene is missing or hidden from assistive technology'
);
expectFailure(
  'active scene aria-hidden gate',
  'acceptance-drag.mjs',
  { CINEVIEW_ACC_INJECT: 'active-scene-aria-hidden' },
  'current scene is missing or hidden from assistive technology'
);
expectFailure(
  'drag browser route wiring gate',
  'acceptance-drag.mjs',
  { CINEVIEW_ACC_ROUTE: '/#/does-not-exist' },
  'fixture root [data-page="framework-drag-acceptance"] not found'
);
expectFailure(
  'drag preview startup gate',
  'acceptance-drag.mjs',
  {
    CINEVIEW_ACC_PREVIEW_CMD: 'false',
    CINEVIEW_ACC_STARTUP_TIMEOUT_MS: '500',
  },
  'preview server did not become ready'
);
expectFailure(
  'scroll browser assertion gate',
  'acceptance-scroll.mjs',
  { CINEVIEW_SCROLL_ACC_INJECT: 'assertion' },
  'scroll browser acceptance assertion failed'
);
expectFailure(
  'scroll first-frame progress gate',
  'acceptance-scroll.mjs',
  { CINEVIEW_SCROLL_ACC_INJECT: 'forward-progress' },
  'zone A first forward interior frame did not publish exact one-pixel progress'
);
expectFailure(
  'scroll reverse endpoint gate',
  'acceptance-scroll.mjs',
  { CINEVIEW_SCROLL_ACC_INJECT: 'reverse-endpoint' },
  'zone A exact endpoint reverse skipped its required segment-interior frame'
);
expectFailure(
  'scroll browser route wiring gate',
  'acceptance-scroll.mjs',
  { CINEVIEW_SCROLL_ACC_ROUTE: '/#/does-not-exist' },
  'fixture root [data-page="framework-scroll-acceptance"] not found'
);
expectFailure(
  'scroll preview startup gate',
  'acceptance-scroll.mjs',
  {
    CINEVIEW_SCROLL_ACC_PREVIEW_CMD: 'false',
    CINEVIEW_SCROLL_ACC_STARTUP_TIMEOUT_MS: '500',
  },
  'scroll preview server did not become ready'
);

expectFailure(
  'production profile long-task gate',
  'profile-production.mjs',
  { CINEVIEW_PROFILE_INJECT: 'long-task', CINEVIEW_PROFILE_RUNS: '1' },
  'production profile budget or workload check failed'
);
