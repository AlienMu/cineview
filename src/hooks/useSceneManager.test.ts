/**
 * useSceneManager Hook Tests
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useSceneManager } from './useSceneManager';

describe('useSceneManager', () => {
  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      const [state] = result.current;

      expect(state.currentScene).toBe(0);
      expect(state.isAnimating).toBe(false);
      expect(state.direction).toBeNull();
    });

    it('should initialize with custom initial scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      const [state] = result.current;

      expect(state.currentScene).toBe(2);
    });

    it('should clamp initial scene to valid range', () => {
      const { result: result1 } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: -1,
        })
      );

      expect(result1.current[0].currentScene).toBe(0);

      const { result: result2 } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 10,
        })
      );

      expect(result2.current[0].currentScene).toBe(4);
    });

    it('should accept mode option', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          mode: 'drag',
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('canGoNext and canGoPrev', () => {
    it('should correctly determine if can go next', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 3,
          initialScene: 0,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(true);
      expect(actions.canGoPrev()).toBe(false);
    });

    it('should correctly determine if can go prev', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 3,
          initialScene: 2,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(true);
    });

    it('should handle middle scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(true);
      expect(actions.canGoPrev()).toBe(true);
    });

    it('should handle single scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 1,
          initialScene: 0,
        })
      );

      const [, actions] = result.current;

      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(false);
    });
  });

  describe('goToScene', () => {
    it('should navigate to specified scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(3);
      expect(state.direction).toBe('forward');
    });

    it('should set backward direction when going to previous scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 3,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(state.direction).toBe('backward');
    });

    it('should call onBeforeChange callback', () => {
      const onBeforeChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 0,
          onBeforeChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      expect(onBeforeChange).toHaveBeenCalledWith(0, 2);
    });

    it('should call onAfterChange when animated is false', () => {
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, false);
      });

      expect(onAfterChange).toHaveBeenCalledWith(2);
    });

    it('should set isAnimating when animated is true', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, true);
      });

      const [state] = result.current;
      expect(state.isAnimating).toBe(true);
    });

    it('should not animate when animated is false', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, false);
      });

      const [state] = result.current;
      expect(state.isAnimating).toBe(false);
    });

    it('should warn for invalid scene index (negative)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(-1);
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: -1'));

      consoleSpy.mockRestore();
    });

    it('should warn for invalid scene index (too large)', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(10);
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid scene index: 10'));

      consoleSpy.mockRestore();
    });

    it('should not change scene if already at target', () => {
      const onBeforeChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
          onBeforeChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      expect(onBeforeChange).not.toHaveBeenCalled();
    });

    it('should allow transitions in drag mode while animating', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1, true);
      });

      const [state1] = result.current;
      expect(state1.currentScene).toBe(1);

      // Try to navigate while animating (should work in drag mode)
      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3, true);
      });

      const [state2] = result.current;
      expect(state2.currentScene).toBe(3);
    });
  });

  describe('nextScene', () => {
    it('should navigate to next scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 1,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
    });

    it('should not navigate beyond last scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 4,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.nextScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(4);
    });
  });

  describe('prevScene', () => {
    it('should navigate to previous scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
    });

    it('should not navigate before first scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 0,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.prevScene();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(0);
    });
  });

  describe('setAnimating', () => {
    it('should update animating state', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(true);
      });

      const [state1] = result.current;
      expect(state1.isAnimating).toBe(true);

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      const [state2] = result.current;
      expect(state2.isAnimating).toBe(false);
    });

    it('should call onAfterChange when animation ends', () => {
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
          initialScene: 2,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(true);
      });

      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      expect(onAfterChange).toHaveBeenCalledWith(2);
    });

    it('should clear direction when animation ends', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, true);
      });

      const [state1] = result.current;
      expect(state1.direction).toBe('forward');

      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });

      const [state2] = result.current;
      expect(state2.direction).toBeNull();
    });
  });

  describe('drag release state (two-track model)', () => {
    it('should commit drag scene change and DEFER onAfterChange until the transition completes', () => {
      const onBeforeChange = jest.fn();
      const onAfterChange = jest.fn();

      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 4,
          initialScene: 1,
          mode: 'drag',
          onBeforeChange,
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setDragProgress(0.6);
        actions.setDragTimelineProgress(0.6);
        actions.setRenderProgress(0.6);
        actions.setIsDragging(true);
        // Two-track commit advances the scene index only; the incoming scene's
        // element track continues independently. No elapsed/snapshot is built.
        actions.commitDragSceneChange('forward', 0.6);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
      expect(state.direction).toBe('forward');
      expect(state.isAnimating).toBe(false);
      expect(state.dragProgress).toBe(0);
      expect(state.renderProgress).toBe(0);
      expect(state.isDragging).toBe(false);
      // No global element-timeline scalar / snapshot exists anymore.
      expect(state.dragRelease).toBeNull();
      expect(onBeforeChange).toHaveBeenCalledWith(1, 2);
      // Deferred: onAfterChange fires later via completeDragTransition.
      expect(onAfterChange).not.toHaveBeenCalled();
    });

    it('should fire onAfterChange when completeDragTransition is called by the incoming scene', () => {
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 4,
          initialScene: 1,
          mode: 'drag',
          onAfterChange,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.commitDragSceneChange('forward', 0.75);
      });

      // Deferred until the incoming scene's element track reaches T.
      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        const [, actions] = result.current;
        actions.completeDragTransition();
      });

      const [state] = result.current;
      expect(state.dragProgress).toBe(0);
      expect(state.dragTimelineProgress).toBe(0);
      expect(state.dragRelease).toBeNull();
      expect(state.direction).toBeNull();
      expect(onAfterChange).toHaveBeenCalledWith(2, 1);
    });

    it('fires onAfterChange once when the element settle completes BEFORE the render commit (order-independent join)', () => {
      // Regression: in the CineView path the page-slide (render lane) runs on a
      // fixed slideDuration (~800ms) while the incoming scene's element settle
      // runs on its own T_self. When T_self < slideDuration the element track
      // reaches T — and fires completeDragTransition — BEFORE the render lane
      // commits. The deferred onSceneDidChange must still fire exactly once; the
      // two arms form an order-independent join, not a settle-arrives-second
      // assumption.
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'drag', onAfterChange })
      );

      act(() => {
        const [, actions] = result.current;
        // Outgoing scene publishes the settle directive at release (before commit).
        actions.setDragRelease({ mode: 'settle', direction: 'forward', targetSceneIndex: 2 });
      });

      act(() => {
        const [, actions] = result.current;
        // Incoming scene's element track reaches T FIRST → settle arm arrives
        // before the render-lane commit arm.
        actions.completeDragTransition();
      });

      // Render commit has not happened yet → the deferred callback waits.
      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        const [, actions] = result.current;
        // Render lane finishes → commit advances the scene index and closes the join.
        actions.commitDragSceneChange('forward', 0.6);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
      // direction / dragRelease are cleared at the JOIN, not prematurely by the
      // settle arm while the page was still sliding.
      expect(state.direction).toBeNull();
      expect(state.dragRelease).toBeNull();
      expect(onAfterChange).toHaveBeenCalledTimes(1);
      expect(onAfterChange).toHaveBeenCalledWith(2, 1);
    });

    it('should publish a tokenized release directive via setDragRelease', () => {
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'drag' })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setDragRelease({ mode: 'settle', direction: 'forward', targetSceneIndex: 2 });
      });

      let [state] = result.current;
      expect(state.dragRelease).not.toBeNull();
      expect(state.dragRelease).toMatchObject({
        mode: 'settle',
        direction: 'forward',
        targetSceneIndex: 2,
      });
      const firstToken = state.dragRelease?.token;
      expect(typeof firstToken).toBe('number');

      // A second publish gets a higher token (monotonic, StrictMode-safe).
      act(() => {
        const [, actions] = result.current;
        actions.setDragRelease({ mode: 'bounce', direction: 'forward', targetSceneIndex: 2 });
      });
      [state] = result.current;
      expect(state.dragRelease?.token).toBeGreaterThan(firstToken as number);

      // Clearing sets it back to null.
      act(() => {
        const [, actions] = result.current;
        actions.setDragRelease(null);
      });
      [state] = result.current;
      expect(state.dragRelease).toBeNull();
    });

    it('should reset drag interaction state without changing the current scene', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 4,
          initialScene: 2,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setDragProgress(0.4);
        actions.setDragTimelineProgress(0.4);
        actions.setRenderProgress(0.4);
        actions.setIsDragging(true);
        actions.setDragRelease({ mode: 'settle', direction: 'forward', targetSceneIndex: 3 });
        actions.resetDragInteraction();
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
      expect(state.dragProgress).toBe(0);
      expect(state.dragTimelineProgress).toBe(0);
      expect(state.renderProgress).toBe(0);
      expect(state.isDragging).toBe(false);
      expect(state.dragRelease).toBeNull();
    });

    it('should reset drag interaction when a committed target scene is out of bounds', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 2,
          initialScene: 1,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setDragProgress(0.8);
        actions.setIsDragging(true);
        actions.commitDragSceneChange('forward', 0.8);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(1);
      expect(state.direction).toBeNull();
      expect(state.isAnimating).toBe(false);
      expect(state.dragProgress).toBe(0);
      expect(state.dragTimelineProgress).toBe(0);
      expect(state.isDragging).toBe(false);
      expect(state.dragRelease).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle zero scenes', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 0,
        })
      );

      const [state, actions] = result.current;

      expect(state.currentScene).toBe(0);
      expect(actions.canGoNext()).toBe(false);
      expect(actions.canGoPrev()).toBe(false);
    });

    it('should handle rapid scene changes', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 10,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(1, false);
        actions.goToScene(2, false);
        actions.goToScene(3, false);
        actions.goToScene(4, false);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(4);
    });

    it('should handle callbacks being undefined', () => {
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 5,
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2);
      });

      // Should not throw
      expect(result.current[0].currentScene).toBe(2);
    });
  });
});
