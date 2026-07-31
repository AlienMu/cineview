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

      // D-F6: the non-animated path carries the true from-index too.
      expect(onAfterChange).toHaveBeenCalledWith(2, 0);
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
    it('should commit drag scene change and fire onAfterChange AT commit (scene-switch-complete = render commit)', () => {
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
        // Two-track commit advances the scene index AND fires onAfterChange now —
        // the page-slide reaching the target IS the scene-switch-complete moment.
        // The incoming scene's element track continues independently afterward.
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
      // Fires at commit, not deferred to the element track.
      expect(onAfterChange).toHaveBeenCalledTimes(1);
      expect(onAfterChange).toHaveBeenCalledWith(2, 1);
    });

    it('fires onAfterChange at commit, then completeDragTransition only cleans up (no second fire)', () => {
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

      // Fired at commit, exactly once.
      expect(onAfterChange).toHaveBeenCalledTimes(1);
      expect(onAfterChange).toHaveBeenCalledWith(2, 1);

      act(() => {
        const [, actions] = result.current;
        // Element track reached T → cleanup only, no second callback.
        actions.completeDragTransition();
      });

      const [state] = result.current;
      expect(state.dragProgress).toBe(0);
      expect(state.dragTimelineProgress).toBe(0);
      expect(state.dragRelease).toBeNull();
      expect(state.direction).toBeNull();
      expect(onAfterChange).toHaveBeenCalledTimes(1);
    });

    it('fires onAfterChange once at commit even when the element settle arm arrives first (order-independent cleanup join)', () => {
      // Regression: in the CineView path the page-slide (render lane) runs on a
      // fixed slideDuration (~800ms) while the incoming scene's element settle
      // runs on its own T_self. When T_self < slideDuration the element track
      // reaches T — and fires completeDragTransition — BEFORE the render lane
      // commits. The public onSceneDidChange fires at commit (exactly once); the
      // early element arm only records its arrival so the commit can run the state
      // cleanup. The two arms form an order-independent join for CLEANUP, not for
      // the callback.
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
        // before the render-lane commit arm. Only records arrival (no callback).
        actions.completeDragTransition();
      });

      // Commit has not happened yet → the callback has not fired.
      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        const [, actions] = result.current;
        // Render lane finishes → commit advances the index, fires the callback,
        // and (since the element arm already arrived) runs the cleanup now.
        actions.commitDragSceneChange('forward', 0.6);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
      // direction / dragRelease are cleared at the JOIN close (element arm already
      // arrived), not prematurely while the page was still sliding.
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

    it('should publish an "enter" release directive for programmatic goToScene in drag mode', () => {
      // Programmatic navigation must drive the destination scene's element-track
      // enter. Without a directive, the incoming scene would snap to rest with no
      // enter animation. The 'enter' directive targets the new scene and stays
      // OUT of the gesture join (it must not set expectedSettle / settleArrived),
      // so it cannot corrupt a later gesture commit.
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'drag', onAfterChange })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(3, true);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(3);
      expect(state.dragRelease).toMatchObject({
        mode: 'enter',
        direction: 'forward',
        targetSceneIndex: 3,
      });
      // Animated path defers onAfterChange to setAnimating(false); not fired yet.
      expect(onAfterChange).not.toHaveBeenCalled();

      // The element arm of a real gesture join must NOT have been armed by the
      // programmatic enter: a stray completeDragTransition here records nothing.
      act(() => {
        const [, actions] = result.current;
        actions.completeDragTransition();
      });
      expect(onAfterChange).not.toHaveBeenCalled();

      // CineView's animated-settle timer closes the programmatic nav, clearing the
      // directive and firing onAfterChange exactly once.
      act(() => {
        const [, actions] = result.current;
        actions.setAnimating(false);
      });
      const [settled] = result.current;
      expect(settled.dragRelease).toBeNull();
      expect(onAfterChange).toHaveBeenCalledTimes(1);
    });

    it('should NOT publish a release directive for programmatic goToScene in scroll mode', () => {
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 4, initialScene: 1, mode: 'scroll' })
      );

      act(() => {
        const [, actions] = result.current;
        actions.goToScene(2, true);
      });

      const [state] = result.current;
      expect(state.currentScene).toBe(2);
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
        // Bounce release: the settle join is NOT outstanding, so the reset
        // performs the full teardown (directive cleared).
        actions.setDragRelease({ mode: 'bounce', direction: 'forward', targetSceneIndex: 3 });
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

    it('preserves an outstanding settle release across a gesture-level reset (D-F1)', () => {
      // Rush re-grab tap: the previous release's settle join is still open (the
      // committed-to scene's element track is completing, preempted in place by
      // the new gesture) when the tap ends in resetDragInteraction. The live
      // settle directive must SURVIVE — clearing it would snap the mid-enter
      // elements to terminal (useAnimateDrag reads dragRelease.mode === 'settle'
      // to keep the cross-commit continuation alive).
      const { result } = renderHook(() =>
        useSceneManager({
          totalScenes: 4,
          initialScene: 2,
          mode: 'drag',
        })
      );

      act(() => {
        const [, actions] = result.current;
        actions.setDragRelease({ mode: 'settle', direction: 'forward', targetSceneIndex: 3 });
        actions.commitDragSceneChange('forward', 0.6);
        // The rush re-grab + tap: dragging turned on, then the tiny-progress
        // release resets the interaction.
        actions.setIsDragging(true);
        actions.resetDragInteraction();
      });

      const [state, actions] = result.current;
      expect(state.currentScene).toBe(3);
      expect(state.isDragging).toBe(false);
      expect(state.dragProgress).toBe(0);
      // The settle directive survives the reset.
      expect(state.dragRelease).toEqual(
        expect.objectContaining({ mode: 'settle', targetSceneIndex: 3 })
      );

      // The join still closes normally once the element track reaches T.
      act(() => {
        actions.completeDragTransition();
      });
      const [closed] = result.current;
      expect(closed.dragRelease).toBeNull();
      expect(closed.direction).toBeNull();
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

  // D-F6: programmatic animated goToScene — the settle-timer close
  // (setAnimating(false)) must report the TRUE from-index and must not clobber a
  // real gesture's release directive that superseded the 'enter' directive.
  describe('programmatic goToScene settle close (D-F6)', () => {
    it('passes the recorded from-index to onAfterChange at the settle close', () => {
      const onAfterChange = jest.fn();
      const { result } = renderHook(() =>
        useSceneManager({ totalScenes: 3, mode: 'drag', onAfterChange })
      );

      act(() => {
        result.current[1].goToScene(1, true);
      });
      expect(onAfterChange).not.toHaveBeenCalled();

      act(() => {
        result.current[1].setAnimating(false);
      });

      // Previously onAfterChange fired with only (1): CineView then fell back to
      // its already-updated currentSceneRef and emitted fromIndex === toIndex.
      expect(onAfterChange).toHaveBeenCalledTimes(1);
      expect(onAfterChange).toHaveBeenCalledWith(1, 0);
    });

    it('the settle close clears its own enter directive', () => {
      const { result } = renderHook(() => useSceneManager({ totalScenes: 3, mode: 'drag' }));

      act(() => {
        result.current[1].goToScene(1, true);
      });
      expect(result.current[0].dragRelease?.mode).toBe('enter');

      act(() => {
        result.current[1].setAnimating(false);
      });
      expect(result.current[0].dragRelease).toBeNull();
    });

    it('a late settle timer does NOT clear a real gesture release that superseded the enter directive', () => {
      const { result } = renderHook(() => useSceneManager({ totalScenes: 3, mode: 'drag' }));

      // Programmatic nav publishes the 'enter' directive and arms the timer.
      act(() => {
        result.current[1].goToScene(1, true);
      });

      // Before the timer expires, a real gesture releases: its settle directive
      // (newer token) replaces the 'enter' directive.
      act(() => {
        result.current[1].setDragRelease({
          mode: 'settle',
          direction: 'forward',
          targetSceneIndex: 2,
          progressRatio: 0.5,
        });
      });
      const gestureRelease = result.current[0].dragRelease;
      expect(gestureRelease?.mode).toBe('settle');

      // The stale goToScene timer fires. It must only clear ITS OWN directive
      // (token compare) — clearing the live settle release would snap the
      // incoming scene's element track to rest mid-continuation.
      act(() => {
        result.current[1].setAnimating(false);
      });
      expect(result.current[0].dragRelease).toBe(gestureRelease);
    });
  });

  // B2: runtime children shrink — conditional rendering can reduce totalScenes
  // below the active index; the manager must re-clamp and unhang isAnimating.
  describe('runtime totalScenes shrink (B2)', () => {
    it('re-clamps the active index when scenes are removed at runtime', () => {
      const { result, rerender } = renderHook(
        (props: { totalScenes: number }) => useSceneManager({ ...props, mode: 'drag' }),
        { initialProps: { totalScenes: 3 } }
      );

      act(() => {
        result.current[1].goToScene(2, false);
      });
      expect(result.current[0].currentScene).toBe(2);

      rerender({ totalScenes: 2 });
      expect(result.current[0].currentScene).toBe(1);
    });

    it('unhangs isAnimating when the transition target scene is removed', () => {
      const { result, rerender } = renderHook(
        (props: { totalScenes: number }) => useSceneManager({ ...props, mode: 'drag' }),
        { initialProps: { totalScenes: 3 } }
      );

      act(() => {
        result.current[1].goToScene(2, true);
      });
      expect(result.current[0].isAnimating).toBe(true);
      expect(result.current[0].currentScene).toBe(2);

      // The active scene disappears: without the re-clamp effect the index stays
      // out of range (blank viewport) and CineView's settle effect early-returns
      // on the missing scene, so isAnimating hangs forever.
      rerender({ totalScenes: 2 });
      expect(result.current[0].currentScene).toBe(1);
      expect(result.current[0].isAnimating).toBe(false);
      expect(result.current[0].direction).toBeNull();
    });

    it('keeps an in-range index untouched when scenes shrink above it', () => {
      const { result, rerender } = renderHook(
        (props: { totalScenes: number }) => useSceneManager({ ...props, mode: 'drag' }),
        { initialProps: { totalScenes: 4 } }
      );

      act(() => {
        result.current[1].goToScene(1, false);
      });

      rerender({ totalScenes: 3 });
      expect(result.current[0].currentScene).toBe(1);
    });
  });
});
