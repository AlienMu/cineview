import { act, renderHook } from '@testing-library/react';
import { useFirstSceneEnter, type UseFirstSceneEnterParams } from './useFirstSceneEnter';

describe('useFirstSceneEnter', () => {
  const baseParams: UseFirstSceneEnterParams = {
    enabled: true,
    hasFirstScene: true,
    priorityComplete: false,
    timeoutMs: 3000,
    emitRecoverableError: () => false,
    getPreloadCounts: () => ({ loadedCount: 0, totalCount: 0 }),
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts at (active=true, ready=false) while enabled and assets are pending', () => {
    const { result } = renderHook(() => useFirstSceneEnter(baseParams));

    expect(result.current.firstSceneEnterActive).toBe(true);
    expect(result.current.firstSceneEnterReady).toBe(false);
  });

  it('flips ready=true (window stays active) once priority assets settle', () => {
    const { result, rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: baseParams,
    });

    expect(result.current.firstSceneEnterReady).toBe(false);

    act(() => {
      rerender({ ...baseParams, priorityComplete: true });
    });

    expect(result.current.firstSceneEnterReady).toBe(true);
    expect(result.current.firstSceneEnterActive).toBe(true);
  });

  it('clears the armed timeout when priority assets settle after it was scheduled', () => {
    const emit = jest.fn(() => false);
    const { result, rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, emitRecoverableError: emit, timeoutMs: 1000 },
    });

    // Timer is armed (assets pending). Now settle before it fires.
    act(() => {
      rerender({
        ...baseParams,
        emitRecoverableError: emit,
        timeoutMs: 1000,
        priorityComplete: true,
      });
    });

    expect(result.current.firstSceneEnterReady).toBe(true);

    // Advancing past the original timeout must NOT fire the error — the effect
    // cleanup cleared the armed timer when priorityComplete flipped.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('a preempt signal clears an already-armed timeout', () => {
    const emit = jest.fn(() => false);
    const { rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, emitRecoverableError: emit, timeoutMs: 1000 },
    });

    // Timer armed; preempt before it fires.
    act(() => {
      rerender({ ...baseParams, emitRecoverableError: emit, timeoutMs: 1000, preemptSignal: true });
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it('handleComplete clears the window (active=false) without touching ready', () => {
    const { result, rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, priorityComplete: true },
    });
    rerender({ ...baseParams, priorityComplete: true });

    expect(result.current.firstSceneEnterReady).toBe(true);

    act(() => {
      result.current.handleComplete();
    });

    expect(result.current.firstSceneEnterActive).toBe(false);
    expect(result.current.firstSceneEnterReady).toBe(true);
  });

  it('on timeout with no preventDefault, reveals statically (both flags false)', () => {
    const emit = jest.fn(() => false);
    const { result } = renderHook(() =>
      useFirstSceneEnter({ ...baseParams, emitRecoverableError: emit, timeoutMs: 1000 })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(emit).toHaveBeenCalledWith(
      'FIRST_SCENE_TIMEOUT',
      expect.any(String),
      expect.objectContaining({ sceneIndex: 0 })
    );
    expect(result.current.firstSceneEnterActive).toBe(false);
    expect(result.current.firstSceneEnterReady).toBe(false);
  });

  it('on timeout with preventDefault (handled), holds at initial (active=true, ready=false)', () => {
    const emit = jest.fn(() => true);
    const { result } = renderHook(() =>
      useFirstSceneEnter({ ...baseParams, emitRecoverableError: emit, timeoutMs: 1000 })
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.firstSceneEnterActive).toBe(true);
    expect(result.current.firstSceneEnterReady).toBe(false);
  });

  it('a preempt signal clears both flags (gesture took the track)', () => {
    const { result, rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, priorityComplete: true },
    });
    rerender({ ...baseParams, priorityComplete: true });
    expect(result.current.firstSceneEnterReady).toBe(true);

    act(() => {
      rerender({ ...baseParams, priorityComplete: true, preemptSignal: true });
    });

    expect(result.current.firstSceneEnterActive).toBe(false);
    expect(result.current.firstSceneEnterReady).toBe(false);
  });

  it('when disabled, starts at (active=false, ready=false) and never gates', () => {
    const { result } = renderHook(() => useFirstSceneEnter({ ...baseParams, enabled: false }));

    expect(result.current.firstSceneEnterActive).toBe(false);
    expect(result.current.firstSceneEnterReady).toBe(false);
  });

  it('skips gating when hasFirstScene is false', () => {
    // Line 91: if (!hasFirstScene) return — effect bails out, ready stays false.
    const { result } = renderHook(() =>
      useFirstSceneEnter({ ...baseParams, hasFirstScene: false, priorityComplete: true })
    );
    expect(result.current.firstSceneEnterReady).toBe(false);
    expect(result.current.firstSceneEnterActive).toBe(true); // enabled=true, window opens
  });

  it('ignores a deps-change re-run once ranRef is already set (line 90-91)', () => {
    // Run the hook to completion (priorityComplete=true sets ranRef).
    const { result, rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, priorityComplete: true },
    });
    expect(result.current.firstSceneEnterReady).toBe(true);

    // Change a dep (timeoutMs) to trigger an effect re-run; ranRef is true so
    // the early-return at line 90 fires and no second startEnter runs.
    act(() => {
      rerender({ ...baseParams, priorityComplete: true, timeoutMs: 9999 });
    });
    // Still ready; active unchanged.
    expect(result.current.firstSceneEnterReady).toBe(true);
    expect(result.current.firstSceneEnterActive).toBe(true);
  });

  it('timeout callback no-ops when ranRef is already true (line 115)', () => {
    const emit = jest.fn(() => false);
    const { rerender } = renderHook((props) => useFirstSceneEnter(props), {
      initialProps: { ...baseParams, emitRecoverableError: emit, timeoutMs: 1000 },
    });

    // Preempt sets ranRef=true before the timer fires.
    act(() => {
      rerender({ ...baseParams, emitRecoverableError: emit, timeoutMs: 1000, preemptSignal: true });
    });

    // Timer fires (not cleared by preempt effect); ranRef=true so early-return
    // at line 115 fires — emit must NOT be called.
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(emit).not.toHaveBeenCalled();
  });
});
