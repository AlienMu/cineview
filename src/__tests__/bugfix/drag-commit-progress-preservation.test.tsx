/**
 * Two-track commit contract (2026-06-25, supersedes the single-scalar settle
 * snapshot model).
 *
 * commitDragSceneChange advances the scene index ONLY — it does not build a
 * snapshot, does not carry an elapsed/timeline scalar, and DEFERS onAfterChange.
 * The incoming scene drives its own element track and calls
 * completeDragTransition when that track reaches T, which fires the deferred
 * onAfterChange. These tests exercise that production path through
 * useSceneManager directly.
 */

import { act, renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('commitDragSceneChange two-track behaviour', () => {
  it('advances the scene index and defers onAfterChange after a partial commit', () => {
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

    // onAfterChange is DEFERRED until the incoming scene's element track settles.
    expect(onBeforeChange).toHaveBeenCalledWith(1, 2);
    expect(onAfterChange).not.toHaveBeenCalled();
  });

  it('fires onAfterChange exactly once when completeDragTransition runs', () => {
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

    expect(onAfterChange).not.toHaveBeenCalled();

    act(() => {
      const [, actions] = result.current;
      actions.completeDragTransition();
    });

    const [state] = result.current;
    expect(state.dragRelease).toBeNull();
    expect(state.dragTimelineProgress).toBe(0);
    expect(onAfterChange).toHaveBeenCalledTimes(1);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);
  });

  it('does not fire onAfterChange at commit for a full-progress release either (always deferred)', () => {
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
    // Deferred regardless of release ratio: the incoming scene owns completion.
    expect(onAfterChange).not.toHaveBeenCalled();

    act(() => {
      const [, actions] = result.current;
      actions.completeDragTransition();
    });
    expect(onAfterChange).toHaveBeenCalledWith(1, 0);
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
