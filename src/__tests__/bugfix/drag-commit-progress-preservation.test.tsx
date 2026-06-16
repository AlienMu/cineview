/**
 * Drag Settle Progress Continuity — Targeted Progress Assertion Tests
 *
 * Task flow: 2026-06-11-drag-release-progress-settle
 *
 * These tests verify that:
 * 1. commitDragSceneChange preserves dragTimelineProgress and sharedElapsedMs
 *    instead of resetting to 0 (production path through useSceneManager).
 * 2. The settle animation (dragTransitionSnapshot) conveys the correct progress
 *    to the target scene so it can continue from the drag-end position.
 */

import { act, renderHook } from '@testing-library/react';
import { useSceneManager } from '../../hooks/useSceneManager';

describe('commitDragSceneChange progress continuity', () => {
  it('preserves dragTimelineProgress after partial commit (0.6 → settle needed)', () => {
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
      // Simulate drag to 60% and commit. The settle should continue from 60%.
      actions.setDragProgress(0.6);
      actions.setDragTimelineProgress(0.6);
      actions.setRenderProgress(0.6);
      actions.setSharedElapsedMs(480);
      actions.setSharedTimelineDurationMs(800);
      actions.setIsDragging(true);
      actions.commitDragSceneChange('forward', 0.6, 480, 800);
    });

    const [state] = result.current;

    // Scene changed to target
    expect(state.currentScene).toBe(2);
    expect(state.direction).toBe('forward');

    // Drag/reset state is cleared
    expect(state.dragProgress).toBe(0);
    expect(state.renderProgress).toBe(0);
    expect(state.isDragging).toBe(false);

    // KEY: Timeline progress and shared elapsed MUST be preserved
    expect(state.dragTimelineProgress).toBe(0.6);
    expect(state.sharedElapsedMs).toBe(480);
    expect(state.sharedTimelineDurationMs).toBe(800);

    // KEY: Snapshot must exist so the target scene can settle from 60% → 100%
    expect(state.dragTransitionSnapshot).not.toBeNull();
    expect(state.dragTransitionSnapshot).toEqual({
      fromScene: 1,
      toScene: 2,
      direction: 'forward',
      progressRatio: 0.6,
      sharedElapsedMs: 480,
      sharedTimelineDurationMs: 800,
    });

    // onAfterChange should NOT be called yet (settle is pending)
    expect(onAfterChange).not.toHaveBeenCalled();
  });

  it('does NOT create snapshot when commit is at full progress (100% → no settle needed)', () => {
    const onBeforeChange = jest.fn();
    const onAfterChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 0,
        mode: 'drag',
        onBeforeChange,
        onAfterChange,
      })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('forward', 1, 800, 800);
    });

    const [state] = result.current;

    expect(state.currentScene).toBe(1);
    expect(state.dragTimelineProgress).toBe(1);
    expect(state.sharedElapsedMs).toBe(800);
    // No settle needed: snapshot is null
    expect(state.dragTransitionSnapshot).toBeNull();
    // onAfterChange should be called immediately (no settle pending)
    expect(onAfterChange).toHaveBeenCalledWith(1, 0);
  });

  it('creates snapshot at 0% progress so target scene can settle from beginning', () => {
    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 0,
        mode: 'drag',
      })
    );

    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('forward', 0, 0, 800);
    });

    const [state] = result.current;
    // 0% progress means settle starts from beginning — snapshot is still created
    // to convey the clean handoff to the target scene.
    expect(state.dragTransitionSnapshot).not.toBeNull();
    expect(state.dragTransitionSnapshot?.progressRatio).toBe(0);
    expect(state.dragTransitionSnapshot?.sharedElapsedMs).toBe(0);
    expect(state.dragTimelineProgress).toBe(0);
    expect(state.sharedElapsedMs).toBe(0);
  });

  it('preserves backward commit progress (reverse drag settle)', () => {
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
      actions.commitDragSceneChange('backward', 0.4, 320, 800);
    });

    const [state] = result.current;

    expect(state.currentScene).toBe(1);
    expect(state.direction).toBe('backward');
    expect(state.dragTimelineProgress).toBe(0.4);
    expect(state.sharedElapsedMs).toBe(320);
    expect(state.dragTransitionSnapshot).not.toBeNull();
    expect(state.dragTransitionSnapshot?.progressRatio).toBe(0.4);
    expect(state.dragTransitionSnapshot?.direction).toBe('backward');
  });

  it('clears snapshot and calls onAfterChange when settle completes (clearDragTransitionSnapshot)', () => {
    const onAfterChange = jest.fn();

    const { result } = renderHook(() =>
      useSceneManager({
        totalScenes: 3,
        initialScene: 1,
        mode: 'drag',
        onAfterChange,
      })
    );

    // First commit (creates snapshot)
    act(() => {
      const [, actions] = result.current;
      actions.commitDragSceneChange('forward', 0.6, 480, 800);
    });

    let [state] = result.current;
    expect(state.dragTransitionSnapshot).not.toBeNull();

    // Then clear the snapshot (settle complete)
    act(() => {
      const [, actions] = result.current;
      actions.clearDragTransitionSnapshot();
    });

    [state] = result.current;
    expect(state.dragTransitionSnapshot).toBeNull();
    expect(state.dragTimelineProgress).toBe(0);
    expect(state.sharedElapsedMs).toBe(0);
    expect(onAfterChange).toHaveBeenCalledWith(2, 1);
  });
});
