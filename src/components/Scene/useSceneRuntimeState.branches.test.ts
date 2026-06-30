/**
 * Branch coverage for useSceneRuntimeState — the pure mode-aware runtime-state
 * resolver. No framer-motion / DOM is involved; it is a useMemo over plain
 * inputs, so each branch is exercised by rendering the hook with a crafted
 * params object and asserting the resolved SceneRuntimeState.
 *
 * Expected values are derived by reading the resolver (useSceneRuntimeState.ts):
 *  - drag: exiting/entering pass through; isActive -> 'active'; else
 *    sceneOffset===0 ? 'inactive' : 'parked'.
 *  - scroll WITH a scrollTimelineState: phase enter/exit/hold/after mapping,
 *    then the fallbacks (isActive / backdrop / offset).
 *  - scroll WITHOUT a timeline: the transitionProgress / incomingScene path.
 *  - neither mode (defensive default): isActive ? 'active' : 'inactive'.
 */

import { renderHook } from '@testing-library/react';
import { useSceneRuntimeState } from './useSceneRuntimeState';
import type { ScrollMode, ScrollTimelineState } from '../../types';
import type { SceneState } from './types';

type Params = Parameters<typeof useSceneRuntimeState>[0];

function base(overrides: Partial<Params> = {}): Params {
  return {
    slideMode: 'drag' as ScrollMode,
    sceneState: 'active' as SceneState,
    isActive: false,
    sceneOffset: 0,
    globalScrollProgress: 0,
    globalScrollDirection: null,
    globalIsScrolling: false,
    globalScrollBackdropActive: false,
    hasExitAnimation: false,
    scrollTimelineState: null,
    ...overrides,
  };
}

function run(overrides: Partial<Params>) {
  return renderHook((p: Params) => useSceneRuntimeState(p), {
    initialProps: base(overrides),
  }).result.current;
}

function timeline(phase: ScrollTimelineState['phase']): ScrollTimelineState {
  // Only `phase` is read by the resolver; the rest is filler that satisfies the
  // type. Values are inert for the branch under test.
  return {
    phase,
    progress: 0,
    enterProgress: 0,
    exitProgress: 0,
    activeProgress: 0,
  } as unknown as ScrollTimelineState;
}

describe('useSceneRuntimeState — drag mode branches', () => {
  it('passes through exiting and entering scene states', () => {
    expect(run({ slideMode: 'drag', sceneState: 'exiting' })).toBe('exiting');
    expect(run({ slideMode: 'drag', sceneState: 'entering' })).toBe('entering');
  });

  it('returns active when the scene is active (non-exit/enter state)', () => {
    expect(run({ slideMode: 'drag', sceneState: 'active', isActive: true })).toBe('active');
  });

  it('returns inactive at offset 0 and parked otherwise when not active', () => {
    expect(run({ slideMode: 'drag', sceneState: 'active', isActive: false, sceneOffset: 0 })).toBe(
      'inactive'
    );
    expect(run({ slideMode: 'drag', sceneState: 'active', isActive: false, sceneOffset: 1 })).toBe(
      'parked'
    );
  });
});

describe('useSceneRuntimeState — scroll mode with a scrollTimelineState', () => {
  it('maps phase enter -> entering', () => {
    expect(run({ slideMode: 'scroll', scrollTimelineState: timeline('enter') })).toBe('entering');
  });

  it('maps phase exit -> exiting (with exit anim) / covered (without)', () => {
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('exit'), hasExitAnimation: true })
    ).toBe('exiting');
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('exit'), hasExitAnimation: false })
    ).toBe('covered');
  });

  it('maps phase hold -> active when active, covered otherwise', () => {
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('hold'), isActive: true })
    ).toBe('active');
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('hold'), isActive: false })
    ).toBe('covered');
  });

  it('maps phase after -> parked (with exit anim) / covered (without)', () => {
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('after'), hasExitAnimation: true })
    ).toBe('parked');
    expect(
      run({ slideMode: 'scroll', scrollTimelineState: timeline('after'), hasExitAnimation: false })
    ).toBe('covered');
  });

  it('falls back to active for an unknown phase when the scene is active', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: timeline('before' as ScrollTimelineState['phase']),
        isActive: true,
      })
    ).toBe('active');
  });

  it('falls back to covered for an unknown phase when backdrop is active', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: timeline('before' as ScrollTimelineState['phase']),
        isActive: false,
        globalScrollBackdropActive: true,
      })
    ).toBe('covered');
  });

  it('falls back to inactive/parked by offset for an unknown phase otherwise', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: timeline('before' as ScrollTimelineState['phase']),
        isActive: false,
        globalScrollBackdropActive: false,
        sceneOffset: 0,
      })
    ).toBe('inactive');
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: timeline('before' as ScrollTimelineState['phase']),
        isActive: false,
        globalScrollBackdropActive: false,
        sceneOffset: 2,
      })
    ).toBe('parked');
  });
});

describe('useSceneRuntimeState — scroll mode without a timeline (progress path)', () => {
  it('active + scrolling + progress -> exiting (with exit anim) / covered (without)', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: true,
        globalIsScrolling: true,
        globalScrollProgress: 0.5,
        hasExitAnimation: true,
      })
    ).toBe('exiting');
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: true,
        globalIsScrolling: true,
        globalScrollProgress: 0.5,
        hasExitAnimation: false,
      })
    ).toBe('covered');
  });

  it('backdrop active -> covered (when not the exiting-active case)', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollBackdropActive: true,
      })
    ).toBe('covered');
  });

  it('incoming forward scene with progress -> entering', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollDirection: 'forward',
        sceneOffset: 1,
        globalScrollProgress: 0.5,
      })
    ).toBe('entering');
  });

  it('incoming backward scene with progress -> entering', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollDirection: 'backward',
        sceneOffset: -1,
        globalScrollProgress: 0.5,
      })
    ).toBe('entering');
  });

  it('active with no transition -> active', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: true,
        globalIsScrolling: false,
        globalScrollProgress: 0,
      })
    ).toBe('active');
  });

  it('idle non-incoming scene -> inactive at offset 0 / parked otherwise', () => {
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollProgress: 0,
        sceneOffset: 0,
      })
    ).toBe('inactive');
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollProgress: 0,
        sceneOffset: 3,
      })
    ).toBe('parked');
  });

  it('incoming scene below the progress epsilon is NOT yet entering', () => {
    // transitionProgress 0.0005 <= 0.001 -> not entering; falls to offset path.
    expect(
      run({
        slideMode: 'scroll',
        scrollTimelineState: null,
        isActive: false,
        globalScrollDirection: 'forward',
        sceneOffset: 1,
        globalScrollProgress: 0.0005,
      })
    ).toBe('parked');
  });
});

describe('useSceneRuntimeState — defensive default (neither drag nor scroll)', () => {
  it('returns active/inactive purely by isActive', () => {
    expect(run({ slideMode: 'visibility' as ScrollMode, isActive: true })).toBe('active');
    expect(run({ slideMode: 'visibility' as ScrollMode, isActive: false })).toBe('inactive');
  });
});
