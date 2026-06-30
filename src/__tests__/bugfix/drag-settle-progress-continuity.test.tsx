/**
 * Drag Settle Progress Continuity — two-track contract (2026-06-26).
 *
 * Supersedes the single-scalar snapshot model. commitDragSceneChange advances
 * the scene index AND fires onAfterChange at commit (scene-switch-complete =
 * render commit); it does not carry an elapsed/timeline scalar nor build a
 * snapshot. completeDragTransition (called by the incoming scene when its element
 * track reaches T) is CLEANUP ONLY — it clears the lingering drag state and does
 * not fire the public callback a second time.
 */

import { act, renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('commitDragSceneChange progress continuity (two-track)', () => {
  it('advances the index and fires onAfterChange at commit on a partial commit', () => {
    const onBeforeChange = jest.fn();
    const onAfterChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
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
      actions.commitDragSceneChange('forward', 0.6);
    });

    const [state] = result.current;

    expect(state.currentScene).toBe(2);
    expect(state.direction).toBe('forward');
    expect(state.dragProgress).toBe(0);
    expect(state.renderProgress).toBe(0);
    expect(state.isDragging).toBe(false);
    // Timeline ratio is reported for diagnostics; the element timeline itself
    // lives on the incoming scene, not in a global scalar here.
    expect(state.dragTimelineProgress).toBe(0.6);
    expect(state.dragRelease).toBeNull();
    // Fires at commit; the incoming scene's element track continues independently.
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);
  });

  it('fires onAfterChange at commit even at full progress', () => {
    const onAfterChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 0,
        mode: 'drag',
        onAfterChange,
      })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('forward', 1);
    });

    const [state] = result.current;
    expect(state.currentScene).toBe(1);
    expect(state.dragTimelineProgress).toBe(1);
    // Fires at commit regardless of release ratio.
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(1, 0);

    act(() => {
      const [, actions] = result.current;
      // Element track reached T → cleanup only, no second callback.
      actions.completeDragTransition();
    });
    expect(onAfterChange).toHaveBeenCalledTimes(1);
  });

  it('preserves backward commit progress (reverse drag)', () => {
    const onBeforeChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 2,
        mode: 'drag',
        onBeforeChange,
      })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('backward', 0.4);
    });

    const [state] = result.current;

    expect(state.currentScene).toBe(1);
    expect(state.direction).toBe('backward');
    expect(state.dragTimelineProgress).toBe(0.4);
  });

  it('fires onAfterChange at commit, then clears state when completeDragTransition runs', () => {
    const onAfterChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 1,
        mode: 'drag',
        onAfterChange,
      })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('forward', 0.6);
    });

    act(() => {
      const [, actions] = result.current;
      actions.completeDragTransition();
    });

    const [state] = result.current;
    expect(state.dragRelease).toBeNull();
    expect(state.dragTimelineProgress).toBe(0);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);
  });
});
