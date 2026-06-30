/**
 * Scene helpers 纯函数直测：resolveSceneAnchor（全 anchor case）与
 * getSceneVisibilityProgress（全 phase case + 非 scroll 早退）。这两个是无副作用的
 * 布局/进度映射函数，直测比经组件间接覆盖更确定。
 */
import { resolveSceneAnchor, getSceneVisibilityProgress } from './helpers';
import type { SceneAnchor } from '../../types';

describe('resolveSceneAnchor', () => {
  it('九个 anchor 各自映射到正确的 top/left/right/bottom + transform', () => {
    expect(resolveSceneAnchor('top-left')).toEqual({ top: 0, left: 0 });
    expect(resolveSceneAnchor('top-center')).toEqual({
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
    });
    expect(resolveSceneAnchor('top-right')).toEqual({ top: 0, right: 0 });
    expect(resolveSceneAnchor('center-left')).toEqual({
      top: '50%',
      left: 0,
      transform: 'translateY(-50%)',
    });
    expect(resolveSceneAnchor('center')).toEqual({
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    });
    expect(resolveSceneAnchor('center-right')).toEqual({
      top: '50%',
      right: 0,
      transform: 'translateY(-50%)',
    });
    expect(resolveSceneAnchor('bottom-left')).toEqual({ bottom: 0, left: 0 });
    expect(resolveSceneAnchor('bottom-center')).toEqual({
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
    });
    expect(resolveSceneAnchor('bottom-right')).toEqual({ bottom: 0, right: 0 });
  });

  it('未知 anchor 回退到 top-left（default 分支）', () => {
    expect(resolveSceneAnchor('nope' as SceneAnchor)).toEqual({ top: 0, left: 0 });
  });
});

describe('getSceneVisibilityProgress', () => {
  const makeState = (
    phase: 'before' | 'enter' | 'hold' | 'exit' | 'after',
    enterProgress = 0,
    exitProgress = 0
  ) =>
    ({
      phase,
      enterProgress,
      exitProgress,
      sceneProgress: 0,
      rangeStart: 0,
      rangeEnd: 0,
      rangeLength: 0,
      enterLength: 0,
      exitLength: 0,
    }) as NonNullable<
      Parameters<typeof getSceneVisibilityProgress>[0]['globalScrollTimelineState']
    >;

  it('非 scroll 模式：isActive 决定 1/0', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'drag',
        isActive: true,
        globalScrollTimelineState: makeState('enter'),
        hasExitAnimation: true,
      })
    ).toBe(1);
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'drag',
        isActive: false,
        globalScrollTimelineState: makeState('enter'),
        hasExitAnimation: true,
      })
    ).toBe(0);
  });

  it('scroll 模式但无 timelineState：isActive 决定 1/0', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: null,
        hasExitAnimation: true,
      })
    ).toBe(1);
  });

  it('各 phase 映射：before=0 / enter=enterProgress / hold=1', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('before'),
        hasExitAnimation: true,
      })
    ).toBe(0);
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('enter', 0.42),
        hasExitAnimation: true,
      })
    ).toBe(0.42);
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('hold'),
        hasExitAnimation: true,
      })
    ).toBe(1);
  });

  it('exit phase：有退场动画 → 1-exitProgress；无退场 → 保持 1', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('exit', 0, 0.3),
        hasExitAnimation: true,
      })
    ).toBeCloseTo(0.7);
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('exit', 0, 0.3),
        hasExitAnimation: false,
      })
    ).toBe(1);
  });

  it('after phase：有退场动画 → 0；无退场 → 1', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('after'),
        hasExitAnimation: true,
      })
    ).toBe(0);
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: makeState('after'),
        hasExitAnimation: false,
      })
    ).toBe(1);
  });
});
