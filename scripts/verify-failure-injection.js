#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cineview-gate-'));

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });
}

function expectFailure(label, result, expectedOutput) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) {
    throw new Error(`${label} did not fail under deliberate fault injection`);
  }
  if (expectedOutput && !output.includes(expectedOutput)) {
    throw new Error(`${label} failed for the wrong reason:\n${output.slice(-2000)}`);
  }
  process.stdout.write(`✓ ${label} rejects the injected failure\n`);
}

try {
  const warningTest = path.join(tempRoot, 'unexpected-console.test.ts');
  fs.writeFileSync(
    warningTest,
    "test('injected warning', () => { console.warn('injected warning'); });\n",
    'utf8'
  );
  const warningConfig = path.join(tempRoot, 'jest.config.js');
  fs.writeFileSync(
    warningConfig,
    `module.exports = {\n` +
      `  rootDir: ${JSON.stringify(tempRoot)},\n` +
      `  transform: { '^.+\\\\.tsx?$': ${JSON.stringify(require.resolve('ts-jest'))} },\n` +
      `  testEnvironment: ${JSON.stringify(require.resolve('jest-environment-jsdom'))},\n` +
      `  setupFilesAfterEnv: [${JSON.stringify(path.join(root, 'src/setupTests.ts'))}],\n` +
      `  testMatch: ['**/*.test.ts'],\n` +
      `};\n`,
    'utf8'
  );
  expectFailure(
    'warning gate',
    run(process.execPath, [
      require.resolve('jest/bin/jest'),
      '--config',
      warningConfig,
      warningTest,
    ]),
    'Unexpected console output'
  );

  fs.writeFileSync(
    path.join(tempRoot, 'coverage-source.ts'),
    'export const choose = (value: boolean): number => (value ? 1 : 2);\n',
    'utf8'
  );
  fs.writeFileSync(
    path.join(tempRoot, 'coverage.test.ts'),
    "import { choose } from './coverage-source'; test('one branch', () => expect(choose(true)).toBe(1));\n",
    'utf8'
  );
  const coverageConfig = path.join(tempRoot, 'coverage.jest.config.js');
  fs.writeFileSync(
    coverageConfig,
    `module.exports = {\n` +
      `  rootDir: ${JSON.stringify(tempRoot)},\n` +
      `  transform: { '^.+\\\\.tsx?$': ${JSON.stringify(require.resolve('ts-jest'))} },\n` +
      `  testEnvironment: 'node',\n` +
      `  testMatch: ['**/coverage.test.ts'],\n` +
      `  collectCoverageFrom: ['coverage-source.ts'],\n` +
      `  coverageThreshold: { global: { branches: 100 } },\n` +
      `};\n`,
    'utf8'
  );
  expectFailure(
    'coverage gate',
    run(process.execPath, [
      require.resolve('jest/bin/jest'),
      '--config',
      coverageConfig,
      '--coverage',
      '--runInBand',
    ]),
    'coverage threshold for branches'
  );

  expectFailure(
    'duplication gate',
    run(path.join(root, 'node_modules/.bin/jscpd'), [
      '--config',
      path.join(root, '.jscpd.json'),
      '--threshold',
      '0',
      path.join(root, 'src'),
    ])
  );

  expectFailure(
    'bundle-size gate',
    run(process.execPath, [path.join(root, 'scripts/verify-build.js')], {
      env: { ...process.env, CINEVIEW_MAX_BUNDLE_SIZE_KB: '0' },
    }),
    '超过目标'
  );

  const propertyManglingScript = path.join(tempRoot, 'property-mangling.mjs');
  fs.writeFileSync(
    propertyManglingScript,
    `const entries = [\n` +
      `  { fileName: 'cineview.es.mjs' },\n` +
      `  { fileName: 'cineview.umd.js' },\n` +
      `];\n` +
      `const mangle = { toplevel: true, properties: true };\n`,
    'utf8'
  );
  expectFailure(
    'property-mangling gate',
    run(process.execPath, [path.join(root, 'scripts/verify-build.js')], {
      env: { ...process.env, CINEVIEW_MINIFY_SCRIPT: propertyManglingScript },
    }),
    'must not enable property mangling'
  );
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
