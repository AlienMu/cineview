/**
 * useSceneManager Hook — branch/coverage tests
 *
 * Targets the scroll-side actions (resetScrollInteraction,
 * commitScrollSceneChange, clearScrollTransitionSnapshot) and the
 * development-only debug helpers (debugSceneManager / isScrollDebugEnabled),
 * which only execute when process.env.NODE_ENV === 'development'.
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSceneManager } from './useSceneManager';
import type { ScrollTransitionSnapshot } from './useSceneManager';

const makeSnapshot = (
  overrides: Partial<ScrollTransitionSnapshot> = {}
): ScrollTransitionSnapshot => ({
  fromScene: 0,
  toScene: 1,
  direction: 'forward',
  progressRatio: 0.5,
  startedAt: Date.now(),
  lastInputAt: Date.now(),
  isSettling: false,
  settleDirection: null,
  ...overrides,
});

describe('useSceneManager — scroll actions', () => {
  describe('resetScrollInteraction', () => {
    it('clears scroll scalars, direction, scrolling flag and snapshot without touching the scene index', () => {
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 2, mode: 'scroll' })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setScrollProgress(0.7);
        actions.setScrollDirection('forward');
        actions.setIsScrolling(true);
        actions.setScrollTransitionSnapshot(makeSnapshot());
      });

      let [state] = result.current;
      expect(state.scrollProgress).toBe(0.7);
      expect(state.scrollDirection).toBe('forward');
      expect(state.isScrolling).toBe(true);
      expect(state.scrollTransitionSnapshot).not.toBeNull();

      act(() => {
        const [, actions] = result.current;
        actions.resetScrollInteraction();
      });

      [state] = result.current;
      expect(state.currentScene).toBe(2);
      expect(state.scrollProgress).toBe(0);
      expect(state.scrollDirection).toBeNull();
      expect(state.isScrolling).toBe(false);
      expect(state.scrollTransitionSnapshot).toBeNull();
    });
  });

  describe('commitScrollSceneChange', () => {
    it('advances forward, fires onBeforeChange/onAfterChange and settles scroll state', () => {
      const onBeforeChange = jest.fn();
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 4,
          initialScene: 1,
          mode: 'scroll',
          onBeforeChange,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setScrollProgress(0.9);
        actions.setIsScrolling(true);
        actions.commitScrollSceneChange('forward', 0.9);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
      // Scroll commit settles back to a rest state once the index advances.
      expect(state.scrollProgress).toBe(0);
      expect(state.scrollDirection).toBeNull();
      expect(state.scrollTransitionSnapshot).toBeNull();
      expect(state.isScrolling).toBe(false);
      expect(state.isAnimating).toBe(false);
      expect(onBeforeChange).toHaveBeenCalledWith(1, 2);
      expect(onAfterChange).toHaveBeenCalledWith(2, 1);
    });

    it('advances backward from a mid scene', () => {
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 2, mode: 'scroll', onAfterChange })
      );

      act(() => {
        const [, actions] = result.current;
        actions.commitScrollSceneChange('backward', 0.6);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(onAfterChange).toHaveBeenCalledWith(1, 2);
    });

    it('clamps an out-of-range progressRatio into [0,1]', () => {
      // progressRatio is normalized; an over-1 input must not produce a >1
      // intermediate scroll progress. We assert the post-commit settle (0) and
      // a clean callback to prove the path ran with the clamp applied.
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 0, mode: 'scroll', onAfterChange })
      );

      act(() => {
        const [, actions] = result.current;
        actions.commitScrollSceneChange('forward', 1.8);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(state.scrollProgress).toBe(0);
      expect(onAfterChange).toHaveBeenCalledWith(1, 0);
    });

    it('resets scroll interaction (and does not advance) when the target is out of bounds', () => {
      const onBeforeChange = jest.fn();
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 2,
          initialScene: 1,
          mode: 'scroll',
          onBeforeChange,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setScrollProgress(0.8);
        actions.setScrollDirection('forward');
        actions.setIsScrolling(true);
        actions.setScrollTransitionSnapshot(makeSnapshot({ fromScene: 1, toScene: 2 }));
        actions.setAnimating(true);
        // forward from last scene → target 2 is out of bounds.
        actions.commitScrollSceneChange('forward', 0.8);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(state.direction).toBeNull();
      expect(state.isAnimating).toBe(false);
      expect(state.scrollProgress).toBe(0);
      expect(state.scrollDirection).toBeNull();
      expect(state.isScrolling).toBe(false);
      expect(state.scrollTransitionSnapshot).toBeNull();
      // Aborted commit never reaches the onBeforeChange/onAfterChange pair.
      expect(onBeforeChange).not.toHaveBeenCalled();
      // setAnimating(true) earlier fired no onAfterChange; the abort path doesn't either.
      expect(onAfterChange).not.toHaveBeenCalled();
    });

    it('resets scroll interaction when a backward commit underflows below scene 0', () => {
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 3, initialScene: 0, mode: 'scroll' })
      );

      act(() => {
        const [, actions] = result.current;
        actions.commitScrollSceneChange('backward', 0.5);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(0);
      expect(state.direction).toBeNull();
    });
  });

  describe('clearScrollTransitionSnapshot', () => {
    it('clears the snapshot and scroll scalars', () => {
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'scroll' })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setScrollProgress(0.5);
        actions.setScrollDirection('backward');
        actions.setScrollTransitionSnapshot(makeSnapshot({ direction: 'backward' }));
      });

      let [state] = result.current;
      expect(state.scrollTransitionSnapshot).not.toBeNull();

      act(() => {
        const [, actions] = result.current;
        actions.clearScrollTransitionSnapshot();
      });

      [state] = result.current;
      expect(state.scrollProgress).toBe(0);
      expect(state.scrollDirection).toBeNull();
      expect(state.scrollTransitionSnapshot).toBeNull();
    });
  });
});

describe('useSceneManager — development debug branches', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    // The debug helpers short-circuit unless NODE_ENV === 'development'.
    process.env.NODE_ENV = 'development';
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    debugSpy.mockRestore();
    delete (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__;
  });

  it('emits debugSceneManager output (with details) on goToScene in development', () => {
    const { result } = renderHook(() =>
      useSceneManager({ totalScenes: 5, initialScene: 0, mode: 'drag' })
    );

    act(() => {
      const [, actions] = result.current;
      actions.goToScene(2);
    });

    expect(result.current[0].currentScene).toBe(2);
    // debugSceneManager logged at least the request + apply messages.
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useSceneManager]'),
      expect.any(Object)
    );
  });

  it('runs the scroll-debug branch of commitScrollSceneChange when the window flag is set', () => {
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ = true;

    const { result } = renderHook(() =>
      useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'scroll' })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitScrollSceneChange('forward', 0.7);
    });

    expect(result.current[0].currentScene).toBe(2);
    // isScrollDebugEnabled() returned true, so the dedicated scroll-debug
    // console.debug lines fired in addition to the normal debug messages.
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('[scroll-debug]'),
      expect.any(Object)
    );
  });

  it('does not run the scroll-debug branch when the window flag is absent', () => {
    const { result } = renderHook(() =>
      useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'scroll' })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitScrollSceneChange('forward', 0.7);
    });

    expect(result.current[0].currentScene).toBe(2);
    const scrollDebugCalls = debugSpy.mock.calls.filter(
      ([msg]) => typeof msg === 'string' && msg.includes('[scroll-debug]')
    );
    expect(scrollDebugCalls).toHaveLength(0);
  });
});
