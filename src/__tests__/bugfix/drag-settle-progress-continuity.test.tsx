/**
 * Drag Settle Progress Continuity — two-track contract (2026-06-25).
 *
 * Supersedes the single-scalar snapshot model. commitDragSceneChange advances
 * the scene index and DEFERS onAfterChange; it does not carry an elapsed/timeline
 * scalar nor build a snapshot. completeDragTransition (called by the incoming
 * scene when its element track reaches T) fires the deferred onAfterChange.
 */

import { act, renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('commitDragSceneChange progress continuity (two-track)', () => {
  it('advances the index and defers onAfterChange on a partial commit', () => {
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
    // Deferred: the incoming scene owns completion.
    expect(onAfterChange).not.toHaveBeenCalled();
  });

  it('defers onAfterChange even at full progress (incoming scene owns completion)', () => {
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
    expect(onAfterChange).not.toHaveBeenCalled();

    act(() => {
      const [, actions] = result.current;
      actions.completeDragTransition();
    });
    expect(onAfterChange).toHaveBeenCalledWith(1, 0);
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

  it('clears state and calls onAfterChange when completeDragTransition runs', () => {
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
