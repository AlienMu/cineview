import { createEvent, fireEvent, render } from '@testing-library/react';
import type { PanInfo } from 'framer-motion';
import { useNativePointerDrag } from './useNativePointerDrag';

function Harness({
  onStart,
  onPan,
  onEnd,
  onCandidateStart,
  onCandidateEnd,
  captureActiveRef,
  axis = 'y',
}: {
  onStart: (direction: 'forward' | 'backward') => boolean;
  onPan: (event: PointerEvent, info: PanInfo) => void;
  onEnd: (event: PointerEvent, info: PanInfo) => void;
  onCandidateStart?: () => boolean;
  onCandidateEnd?: () => void;
  captureActiveRef?: (ref: { current: boolean }) => void;
  axis?: 'x' | 'y';
}): React.JSX.Element {
  const handlers = useNativePointerDrag({
    enabled: true,
    axis,
    onCandidateStart,
    onCandidateEnd,
    onStart,
    onPan,
    onEnd,
  });
  captureActiveRef?.(handlers.isActiveRef);

  return (
    <div
      data-testid="surface"
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerCancel}
    >
      <button type="button">Control</button>
    </div>
  );
}

describe('useNativePointerDrag', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('does not resume when candidate suspension reports no in-flight continuation', () => {
    const onCandidateStart = jest.fn(() => false);
    const onCandidateEnd = jest.fn();
    const { getByTestId } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        onCandidateStart={onCandidateStart}
        onCandidateEnd={onCandidateEnd}
      />
    );
    const surface = getByTestId('surface');

    fireEvent.pointerDown(surface, {
      pointerId: 41,
      button: 0,
      isPrimary: true,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerUp(surface, { pointerId: 41, clientX: 20, clientY: 20 });

    expect(onCandidateStart).toHaveBeenCalledTimes(1);
    expect(onCandidateEnd).not.toHaveBeenCalled();
  });

  it('resumes a suspended candidate once on direction rejection and not again on pointerup', () => {
    const onCandidateStart = jest.fn(() => true);
    const onCandidateEnd = jest.fn();
    const onStart = jest.fn(() => false);
    const onEnd = jest.fn();
    const { getByTestId } = render(
      <Harness
        onStart={onStart}
        onPan={jest.fn()}
        onEnd={onEnd}
        onCandidateStart={onCandidateStart}
        onCandidateEnd={onCandidateEnd}
      />
    );
    const surface = getByTestId('surface');
    const dispatchPointer = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      clientY: number
    ): void => {
      const event = createEvent[type](surface);
      Object.entries({
        pointerId: 42,
        button: 0,
        isPrimary: true,
        clientX: 20,
        clientY,
      }).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
      });
      fireEvent(surface, event);
    };

    dispatchPointer('pointerDown', 100);
    expect(onCandidateStart).toHaveBeenCalledTimes(1);
    expect(onCandidateEnd).not.toHaveBeenCalled();

    dispatchPointer('pointerMove', 70);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onCandidateEnd).toHaveBeenCalledTimes(1);

    dispatchPointer('pointerUp', 70);
    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('keeps pointer-down as a side-effect-free candidate and rebases at ownership', () => {
    const onStart = jest.fn(() => true);
    const onPan = jest.fn();
    const onEnd = jest.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onPan={onPan} onEnd={onEnd} />);
    const surface = getByTestId('surface');

    const dispatchPointer = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      values: Record<string, number | boolean>
    ): void => {
      const event = createEvent[type](surface);
      Object.entries(values).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
      });
      fireEvent(surface, event);
    };

    dispatchPointer('pointerDown', {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 100,
      clientY: 200,
    });
    dispatchPointer('pointerMove', { pointerId: 1, clientX: 100, clientY: 80 });

    // The ownership frame is a zero baseline: candidate slop is discarded.
    expect(onStart).toHaveBeenCalledWith('forward');
    expect(onPan).not.toHaveBeenCalled();

    dispatchPointer('pointerMove', { pointerId: 1, clientX: 100, clientY: 40 });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onPan).toHaveBeenCalledTimes(1);
    expect(onPan.mock.calls[0][1].offset).toEqual({ x: 0, y: -40 });

    dispatchPointer('pointerUp', { pointerId: 1, clientX: 100, clientY: 20 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][1].offset).toEqual({ x: 0, y: -60 });
  });

  it('reuses PanInfo and its vectors within one owned pointer session while publishing current values', () => {
    const snapshots: Array<{
      phase: 'pan' | 'end';
      info: PanInfo;
      point: PanInfo['point'];
      delta: PanInfo['delta'];
      offset: PanInfo['offset'];
      velocity: PanInfo['velocity'];
      values: PanInfo;
    }> = [];
    const record =
      (phase: 'pan' | 'end') =>
      (_event: PointerEvent, info: PanInfo): void => {
        snapshots.push({
          phase,
          info,
          point: info.point,
          delta: info.delta,
          offset: info.offset,
          velocity: info.velocity,
          values: {
            point: { ...info.point },
            delta: { ...info.delta },
            offset: { ...info.offset },
            velocity: { ...info.velocity },
          },
        });
      };
    let timestamp = 0;
    const performanceNow = jest.spyOn(performance, 'now').mockImplementation(() => timestamp);
    const { getByTestId } = render(
      <Harness onStart={jest.fn(() => true)} onPan={record('pan')} onEnd={record('end')} />
    );
    const surface = getByTestId('surface');
    const dispatchPointer = (
      type: 'pointerDown' | 'pointerMove' | 'pointerUp',
      clientX: number,
      clientY: number
    ): void => {
      const event = createEvent[type](surface);
      Object.entries({
        pointerId: 71,
        button: 0,
        isPrimary: true,
        clientX,
        clientY,
      }).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
      });
      fireEvent(surface, event);
    };

    dispatchPointer('pointerDown', 100, 200);
    timestamp = 10;
    dispatchPointer('pointerMove', 100, 150);
    timestamp = 20;
    dispatchPointer('pointerMove', 90, 110);
    timestamp = 30;
    dispatchPointer('pointerMove', 70, 80);
    dispatchPointer('pointerUp', 60, 70);
    performanceNow.mockRestore();

    expect(snapshots.map(({ phase, values }) => ({ phase, ...values }))).toEqual([
      {
        phase: 'pan',
        point: { x: 90, y: 110 },
        delta: { x: -10, y: -40 },
        offset: { x: -10, y: -40 },
        velocity: { x: -1000, y: -4000 },
      },
      {
        phase: 'pan',
        point: { x: 70, y: 80 },
        delta: { x: -20, y: -30 },
        offset: { x: -30, y: -70 },
        velocity: { x: -2000, y: -3000 },
      },
      {
        phase: 'end',
        point: { x: 60, y: 70 },
        delta: { x: -10, y: -10 },
        offset: { x: -40, y: -80 },
        velocity: { x: -2000, y: -3000 },
      },
    ]);

    const first = snapshots[0];
    snapshots.slice(1).forEach((snapshot) => {
      expect(snapshot.info).toBe(first.info);
      expect(snapshot.point).toBe(first.point);
      expect(snapshot.delta).toBe(first.delta);
      expect(snapshot.offset).toBe(first.offset);
      expect(snapshot.velocity).toBe(first.velocity);
    });
  });

  it('latches a rejected direction while allowing the opposite direction in the same press', () => {
    const onStart = jest.fn((direction: 'forward' | 'backward') => direction === 'backward');
    const onPan = jest.fn();
    const onEnd = jest.fn();
    const { getByTestId } = render(<Harness onStart={onStart} onPan={onPan} onEnd={onEnd} />);
    const surface = getByTestId('surface');

    const pointerDown = createEvent.pointerDown(surface);
    Object.entries({
      pointerId: 8,
      button: 0,
      isPrimary: true,
      clientX: 100,
      clientY: 100,
      cancelable: true,
    }).forEach(([key, value]) => {
      Object.defineProperty(pointerDown, key, { configurable: true, value });
    });
    fireEvent(surface, pointerDown);

    const dispatchPointer = (type: 'pointerMove' | 'pointerUp', clientY: number): void => {
      const event = createEvent[type](surface);
      Object.entries({ pointerId: 8, clientX: 100, clientY }).forEach(([key, value]) => {
        Object.defineProperty(event, key, { configurable: true, value });
      });
      fireEvent(surface, event);
    };

    expect(pointerDown.defaultPrevented).toBe(false);
    expect(onStart).not.toHaveBeenCalled();

    dispatchPointer('pointerMove', 70);
    dispatchPointer('pointerMove', 40);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenLastCalledWith('forward');
    expect(onPan).not.toHaveBeenCalled();

    dispatchPointer('pointerMove', 130);
    expect(onStart).toHaveBeenCalledTimes(2);
    expect(onStart).toHaveBeenLastCalledWith('backward');
    expect(onPan).not.toHaveBeenCalled();

    dispatchPointer('pointerMove', 160);
    expect(onPan).toHaveBeenCalledTimes(1);
    expect(onPan.mock.calls[0][1].offset).toEqual({ x: 0, y: 30 });

    dispatchPointer('pointerUp', 160);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does not claim pointer input originating in a control', () => {
    const onStart = jest.fn();
    const onPan = jest.fn();
    const onEnd = jest.fn();
    const { getByRole } = render(<Harness onStart={onStart} onPan={onPan} onEnd={onEnd} />);
    const button = getByRole('button', { name: 'Control' });

    fireEvent.pointerDown(button, {
      pointerId: 2,
      button: 0,
      isPrimary: true,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(button, { pointerId: 2, clientX: 20, clientY: 0 });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: 20, clientY: 0 });

    expect(onStart).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('finishes from a window pointerup when the captured surface misses the target event', () => {
    const onStart = jest.fn();
    const onPan = jest.fn();
    const onEnd = jest.fn();
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const { getByTestId } = render(<Harness onStart={onStart} onPan={onPan} onEnd={onEnd} />);
    const surface = getByTestId('surface');

    const pointerDown = createEvent.pointerDown(surface);
    Object.entries({
      pointerId: 3,
      button: 0,
      isPrimary: true,
      clientX: 100,
      clientY: 300,
    }).forEach(([key, value]) => {
      Object.defineProperty(pointerDown, key, { configurable: true, value });
    });
    fireEvent(surface, pointerDown);
    const windowUp = createEvent.pointerUp(surface);
    Object.entries({ pointerId: 3, clientX: 100, clientY: 80 }).forEach(([key, value]) => {
      Object.defineProperty(windowUp, key, { configurable: true, value });
    });
    expect((windowUp as PointerEvent).pointerId).toBe(3);
    const pointerUpRegistration = addEventListenerSpy.mock.calls
      .filter(([type]) => type === 'pointerup')
      .slice(-1)[0]?.[1] as EventListener | undefined;
    expect(pointerUpRegistration).toBeDefined();
    pointerUpRegistration?.(windowUp);
    addEventListenerSpy.mockRestore();

    // A pointer-up without a direction-qualified move is still a candidate tap.
    // It must preserve click/default behavior and emit no drag lifecycle events.
    expect(onStart).not.toHaveBeenCalled();
    expect(onPan).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('tears down the previous gesture end listeners when a second primary pointer takes over (D-F7)', () => {
    // Mouse held + touch down: each pointer TYPE has its own isPrimary, so a
    // second pointerdown can arrive while a sample is still tracked. Without
    // running the previous cleanup before the overwrite, every such overlap
    // leaked 4 window/document end listeners.
    const winAdd = jest.spyOn(window, 'addEventListener');
    const winRemove = jest.spyOn(window, 'removeEventListener');
    const docRemove = jest.spyOn(document, 'removeEventListener');
    const { getByTestId } = render(
      <Harness onStart={jest.fn()} onPan={jest.fn()} onEnd={jest.fn()} />
    );
    const surface = getByTestId('surface');

    const down = (pointerId: number): void => {
      const event = createEvent.pointerDown(surface);
      Object.entries({ pointerId, button: 0, isPrimary: true, clientX: 10, clientY: 10 }).forEach(
        ([key, value]) => {
          Object.defineProperty(event, key, { configurable: true, value });
        }
      );
      fireEvent(surface, event);
    };

    down(1);
    const firstEndHandler = winAdd.mock.calls
      .filter(([type]) => type === 'pointerup')
      .slice(-1)[0]?.[1] as EventListener;
    expect(firstEndHandler).toBeDefined();
    expect(winRemove).not.toHaveBeenCalledWith('pointerup', firstEndHandler);

    down(2); // second primary pointer overwrites the sample

    // The first gesture's 4 end listeners (window+document x pointerup+cancel)
    // must have been removed before the overwrite.
    expect(winRemove).toHaveBeenCalledWith('pointerup', firstEndHandler);
    expect(winRemove).toHaveBeenCalledWith('pointercancel', firstEndHandler);
    expect(docRemove).toHaveBeenCalledWith('pointerup', firstEndHandler);
    expect(docRemove).toHaveBeenCalledWith('pointercancel', firstEndHandler);

    winAdd.mockRestore();
    winRemove.mockRestore();
    docRemove.mockRestore();
  });

  it('keeps the replacement primary pointer active and resumes the abandoned candidate once', () => {
    const onCandidateStart = jest.fn(() => true);
    const onCandidateEnd = jest.fn();
    const captured: { activeRef: { current: boolean } | null } = { activeRef: null };
    const { getByTestId } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        onCandidateStart={onCandidateStart}
        onCandidateEnd={onCandidateEnd}
        captureActiveRef={(ref) => {
          captured.activeRef = ref;
        }}
      />
    );
    const surface = getByTestId('surface');

    fireEvent.pointerDown(surface, {
      pointerId: 61,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerDown(surface, {
      pointerId: 62,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });

    expect(onCandidateStart).toHaveBeenCalledTimes(2);
    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
    expect(captured.activeRef?.current).toBe(true);
  });

  it('resumes an unresolved native candidate exactly once on unmount', () => {
    const onCandidateStart = jest.fn(() => true);
    const onCandidateEnd = jest.fn();
    const { getByTestId, unmount } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        onCandidateStart={onCandidateStart}
        onCandidateEnd={onCandidateEnd}
      />
    );

    fireEvent.pointerDown(getByTestId('surface'), {
      pointerId: 63,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    unmount();

    expect(onCandidateStart).toHaveBeenCalledTimes(1);
    expect(onCandidateEnd).toHaveBeenCalledTimes(1);
  });

  it('clears the native suppression window after one completed session', () => {
    jest.useFakeTimers();
    const captured: { activeRef: { current: boolean } | null } = { activeRef: null };
    const { getByTestId } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        captureActiveRef={(ref) => {
          captured.activeRef = ref;
        }}
      />
    );
    const surface = getByTestId('surface');

    fireEvent.pointerDown(surface, {
      pointerId: 64,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(surface, {
      pointerId: 64,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    expect(captured.activeRef?.current).toBe(true);

    jest.runOnlyPendingTimers();
    expect(captured.activeRef?.current).toBe(false);
    jest.useRealTimers();
  });

  it('cancels a pending suppression cleanup when the hook unmounts', () => {
    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
    const captured: { activeRef: { current: boolean } | null } = { activeRef: null };
    const { getByTestId, unmount } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        captureActiveRef={(ref) => {
          captured.activeRef = ref;
        }}
      />
    );
    const surface = getByTestId('surface');

    fireEvent.pointerDown(surface, {
      pointerId: 65,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(surface, {
      pointerId: 65,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    const timerResults = setTimeoutSpy.mock.results;
    const suppressionTimerId = timerResults[timerResults.length - 1]?.value as number;
    expect(suppressionTimerId).toBeDefined();

    unmount();
    expect(captured.activeRef?.current).toBe(false);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(suppressionTimerId);
    expect(() => jest.runOnlyPendingTimers()).not.toThrow();

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

  it('does not let a completed pointer session clear the next native suppression window', () => {
    jest.useFakeTimers();
    const captured: { activeRef: { current: boolean } | null } = { activeRef: null };
    const { getByTestId } = render(
      <Harness
        onStart={jest.fn(() => true)}
        onPan={jest.fn()}
        onEnd={jest.fn()}
        captureActiveRef={(ref) => {
          captured.activeRef = ref;
        }}
      />
    );
    const surface = getByTestId('surface');

    fireEvent.pointerDown(surface, {
      pointerId: 51,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    fireEvent.pointerUp(surface, {
      pointerId: 51,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });

    // Start the next native session before the previous session's zero-delay
    // suppression cleanup runs. The old cleanup must not clear the new owner.
    fireEvent.pointerDown(surface, {
      pointerId: 52,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    expect(captured.activeRef?.current).toBe(true);

    jest.runOnlyPendingTimers();
    expect(captured.activeRef?.current).toBe(true);
    jest.useRealTimers();
  });
});
