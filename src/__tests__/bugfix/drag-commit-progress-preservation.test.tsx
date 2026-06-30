/**
 * Two-track commit contract (2026-06-26, supersedes the deferred-onSceneDidChange
 * model).
 *
 * commitDragSceneChange advances the scene index AND fires onAfterChange now —
 * scene-switch-complete = render commit. The incoming scene drives its own
 * element track and calls completeDragTransition when that track reaches T; that
 * arm is now CLEANUP ONLY (clears dragRelease/direction/scalars), it does not
 * fire the public callback. These tests exercise that production path through
 * useSceneManager directly.
 */

import { act, renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('commitDragSceneChange two-track behaviour', () => {
  it('advances the scene index and fires onAfterChange at commit after a partial commit', () => {
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

    // Scene advanced to target.
    expect(state.currentScene).toBe(2);
    expect(state.direction).toBe('forward');

    // Drag/render state is cleared at commit.
    expect(state.dragProgress).toBe(0);
    expect(state.renderProgress).toBe(0);
    expect(state.isDragging).toBe(false);

    // No global element-timeline scalar / snapshot exists in the two-track model.
    expect(state.dragRelease).toBeNull();

    // onAfterChange fires AT commit (scene-switch-complete = render commit).
    expect(onBeforeChange).toHaveBeenCalledWith(1, 2);
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);
  });

  it('fires onAfterChange once at commit; completeDragTransition only cleans up', () => {
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

    // Fired at commit, exactly once.
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);

    act(() => {
      const [, actions] = result.current;
      actions.completeDragTransition();
    });

    const [state] = result.current;
    expect(state.dragRelease).toBeNull();
    expect(state.dragTimelineProgress).toBe(0);
    // Cleanup only — no second callback.
    expect(onAfterChange).toHaveBeenCalledTimes(1);
  });

  it('fires onAfterChange at commit for a full-progress release too', () => {
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
    // Fires at commit regardless of release ratio: scene-switch-complete = render
    // commit. The incoming scene's element track continues independently after.
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(1, 0);

    act(() => {
      const [, actions] = result.current;
      // Element track reached T → cleanup only, no second callback.
      actions.completeDragTransition();
    });
    expect(onAfterChange).toHaveBeenCalledTimes(1);
  });

  it('preserves backward commit direction', () => {
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
    expect(onBeforeChange).toHaveBeenCalledWith(2, 1);
  });
});
