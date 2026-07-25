import { createEvent, fireEvent, render } from '@testing-library/react';
import type { PanInfo } from 'framer-motion';
import { useNativePointerDrag } from './useNativePointerDrag';

function Harness({
  onStart,
  onPan,
  onEnd,
}: {
  onStart: () => void;
  onPan: (event: PointerEvent, info: PanInfo) => void;
  onEnd: (event: PointerEvent, info: PanInfo) => void;
}): JSX.Element {
  const handlers = useNativePointerDrag({
    enabled: true,
    onStart,
    onPan,
    onEnd,
  });

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
  it('converts a pointer sequence into the existing PanInfo contract', () => {
    const onStart = jest.fn();
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
    dispatchPointer('pointerUp', { pointerId: 1, clientX: 100, clientY: 40 });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onPan).toHaveBeenCalledTimes(1);
    expect(onPan.mock.calls[0][1].offset).toEqual({ x: 0, y: -120 });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][1].offset).toEqual({ x: 0, y: -160 });
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

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onPan).toHaveBeenCalledTimes(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0][1].offset).toEqual({ x: 0, y: -220 });
  });
});
