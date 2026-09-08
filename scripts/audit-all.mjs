import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
let failed = false;
for (const directory of ['.', 'site', 'examples/minimal', 'examples/performance-test']) {
  console.log(`Auditing ${directory}`);
  const result = spawnSync('pnpm', ['--dir', directory, 'audit', '--audit-level=low'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) failed = true;
}
if (failed) process.exitCode = 1;
