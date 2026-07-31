import { useRef } from 'react';
import { render } from '@testing-library/react';
import { useScrollInputBindings } from './useScrollInputBindings';

function defineTouches(event: Event, touches: Array<{ clientX: number; clientY: number }>): void {
  Object.defineProperty(event, 'touches', {
    configurable: true,
    value: touches,
  });
}

function InputHarness({ applyDelta }: { applyDelta: (delta: number) => boolean }): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useScrollInputBindings({
    rootRef,
    direction: 'y',
    getViewportSpan: () => 900,
    applyNativeScrollDelta: applyDelta,
  });
  return <div ref={rootRef} data-testid="root" data-cineview-container="true" />;
}

describe('useScrollInputBindings ownership', () => {
  it('ignores an already-consumed wheel event', () => {
    const applyDelta = jest.fn(() => true);
    const { getByTestId } = render(<InputHarness applyDelta={applyDelta} />);
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    });
    event.preventDefault();

    getByTestId('root').dispatchEvent(event);

    expect(applyDelta).not.toHaveBeenCalled();
  });

  it('ignores an already-consumed touch move and advances its local anchor', () => {
    const applyDelta = jest.fn(() => true);
    const { getByTestId } = render(<InputHarness applyDelta={applyDelta} />);
    const root = getByTestId('root');

    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    defineTouches(start, [{ clientX: 100, clientY: 500 }]);
    root.dispatchEvent(start);

    const consumedMove = new Event('touchmove', { bubbles: true, cancelable: true });
    defineTouches(consumedMove, [{ clientX: 100, clientY: 300 }]);
    consumedMove.preventDefault();
    root.dispatchEvent(consumedMove);
    expect(applyDelta).not.toHaveBeenCalled();

    const nextMove = new Event('touchmove', { bubbles: true, cancelable: true });
    defineTouches(nextMove, [{ clientX: 100, clientY: 250 }]);
    root.dispatchEvent(nextMove);

    expect(applyDelta).toHaveBeenCalledTimes(1);
    expect(applyDelta).toHaveBeenCalledWith(50);
  });

  it('advances the touch anchor when a boundary rejects movement so reversal works immediately', () => {
    const applyDelta = jest
      .fn<boolean, [delta: number]>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    const { getByTestId } = render(<InputHarness applyDelta={applyDelta} />);
    const root = getByTestId('root');

    const start = new Event('touchstart', { bubbles: true, cancelable: true });
    defineTouches(start, [{ clientX: 100, clientY: 500 }]);
    root.dispatchEvent(start);

    const rejectedForwardMove = new Event('touchmove', { bubbles: true, cancelable: true });
    defineTouches(rejectedForwardMove, [{ clientX: 100, clientY: 300 }]);
    root.dispatchEvent(rejectedForwardMove);

    const reverseMove = new Event('touchmove', { bubbles: true, cancelable: true });
    defineTouches(reverseMove, [{ clientX: 100, clientY: 350 }]);
    root.dispatchEvent(reverseMove);

    expect(applyDelta).toHaveBeenNthCalledWith(1, 200);
    expect(applyDelta).toHaveBeenNthCalledWith(2, -50);
  });

  it('ignores an already-consumed global keyboard event', () => {
    const applyDelta = jest.fn(() => true);
    render(<InputHarness applyDelta={applyDelta} />);
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();

    window.dispatchEvent(event);

    expect(applyDelta).not.toHaveBeenCalled();
  });
});
