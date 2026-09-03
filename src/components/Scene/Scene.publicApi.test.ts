import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('Scene public API typing', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const tscBin = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

  function compileFixture(
    fixtureName: string
  ): { success: true } | { success: false; output: string } {
    const fixturePath = path.join(__dirname, '__fixtures__', fixtureName);
    const result = spawnSync(
      process.execPath,
      [
        tscBin,
        '--noEmit',
        '--pretty',
        'false',
        '--jsx',
        'react-jsx',
        '--target',
        'ES2020',
        '--module',
        'ESNext',
        '--moduleResolution',
        'bundler',
        '--lib',
        'ES2020,DOM,DOM.Iterable',
        '--types',
        'node,react,react-dom',
        '--strict',
        '--esModuleInterop',
        '--allowSyntheticDefaultImports',
        '--allowJs',
        '--checkJs',
        '--skipLibCheck',
        fixturePath,
      ],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      }
    );

    if (result.status === 0) {
      return { success: true };
    }

    return {
      success: false,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`,
    };
  }

  it('accepts the grouped root-first Scene scroll takeover path', () => {
    const result = compileFixture('scene-grouped-public-path.fixture.tsx');

    expect(result).toEqual({ success: true });
  });

  it('rejects legacy scene-level mode and layout props on the public Scene component', () => {
    const result = compileFixture('scene-legacy-public-props.fixture.tsx');

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.output).toContain("Property 'mode' does not exist");
  });

  it('rejects legacy scene-level sizing props on the public Scene component', () => {
    const result = compileFixture('scene-legacy-layout-public-props.fixture.jsx');

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    expect(result.output).toContain("Property 'sceneWidth' does not exist");
  });
});
