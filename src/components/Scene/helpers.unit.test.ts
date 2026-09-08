/**
 * Scene helpers pure function unit tests: resolveSceneAnchor (all anchor cases) and
 * getSceneVisibilityProgress (all phase cases + non-scroll early return). These are
 * side-effect-free layout/progress mapping functions; direct testing is more definitive
 * than indirect coverage through components.
 */
import { resolveSceneAnchor, getSceneVisibilityProgress } from './helpers';
import type { SceneAnchor } from '../../types';

describe('resolveSceneAnchor', () => {
  it('maps each of nine anchors to correct top/left/right/bottom + transform', () => {
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

  it('falls back to top-left for unknown anchor (default branch)', () => {
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

  it('non-scroll mode: isActive determines 1/0', () => {
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

  it('scroll mode but no timelineState: isActive determines 1/0', () => {
    expect(
      getSceneVisibilityProgress({
        effectiveMode: 'scroll',
        isActive: true,
        globalScrollTimelineState: null,
        hasExitAnimation: true,
      })
    ).toBe(1);
  });

  it('phase mapping: before=0 / enter=enterProgress / hold=1', () => {
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

  it('exit phase: with exit animation → 1-exitProgress; without → stays 1', () => {
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

  it('after phase: with exit animation → 0; without → 1', () => {
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
