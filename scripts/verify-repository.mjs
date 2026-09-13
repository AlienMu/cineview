import { execFileSync } from 'node:child_process';

const ignored = execFileSync(
  'git',
  ['ls-files', '--cached', '--ignored', '--exclude-per-directory=.gitignore', '-z'],
  { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
)
  .split('\0')
  .filter(Boolean);

if (ignored.length) {
  console.error(`Local-only files are tracked by Git:\n${ignored.join('\n')}`);
  console.error('Remove these paths from the index with git rm --cached; keep their local copies.');
  process.exitCode = 1;
} else {
  console.log('Repository scope passed: no ignored files are tracked.');
}
