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
