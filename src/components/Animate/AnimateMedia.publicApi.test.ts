import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * tsc fixture: proves AnimateVideo's public prop surface is minimal.
 * Legal minimal usage compiles; illegal props like enterAnimation/stagger trigger type errors (excess property check).
 * Aligns with Scene.publicApi.test compilation fixture pattern.
 */
describe('AnimateVideo public API typing', () => {
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
        '--skipLibCheck',
        fixturePath,
        '--skipDefaultLibCheck',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    );

    if (result.status === 0) {
      return { success: true };
    }
    return {
      success: false,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`,
    };
  }

  it('accepts the minimal public surface for AnimateVideo', () => {
    const result = compileFixture('animate-media-public-path.fixture.tsx');
    expect(result).toEqual({ success: true });
  });

  it('rejects stagger while accepting explicit media animation controls', () => {
    const result = compileFixture('animate-video-illegal-props.fixture.tsx');
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.output).toContain('stagger');
  });
});
