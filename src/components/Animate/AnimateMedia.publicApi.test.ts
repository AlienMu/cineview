import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * tsc fixture:证明 AnimateVideo 的公共 prop 面是最小集——合法最小用法
 * 编译通过;enterAnimation/stagger 等非法 prop 触发类型错误(excess property check)。
 * 对齐 Scene.publicApi.test 的编译夹具模式。
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
        // TypeScript 6 raises TS5112 when files are passed on the command line
        // while a tsconfig.json exists. These fixtures deliberately compile under
        // flags spelled out below, not under the repo config, so skipping it is
        // the intent — the flag just makes that explicit.
        '--ignoreConfig',
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
        '--strict',
        '--esModuleInterop',
        '--allowSyntheticDefaultImports',
        '--skipLibCheck',
        // Spelled out because --ignoreConfig also drops tsconfig's `types`, and
        // TypeScript 6 no longer pulls every node_modules/@types entry in
        // implicitly — without this the framework's own `process` references fail
        // to resolve and the fixture reports errors that are not about its props.
        '--types',
        'node',
        fixturePath,
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
