import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScrollbarOverlay } from './ScrollbarOverlay';

describe('ScrollbarOverlay', () => {
  it('exposes scrollbar semantics and updates through keyboard input', () => {
    const onScrollToOffset = jest.fn();

    render(
      <ScrollbarOverlay
        direction="y"
        viewportSpan={100}
        scrollContentSpan={300}
        scrollOffset={50}
        isScrolling={false}
        config={{ autoHide: false }}
        onScrollToOffset={onScrollToOffset}
      />
    );

    const scrollbar = screen.getByRole('scrollbar', { name: 'CineView scroll position' });
    expect(scrollbar).toHaveAttribute('aria-orientation', 'vertical');
    expect(scrollbar).toHaveAttribute('aria-valuemin', '0');
    expect(scrollbar).toHaveAttribute('aria-valuemax', '200');
    expect(scrollbar).toHaveAttribute('aria-valuenow', '50');
    expect(scrollbar).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(scrollbar, { key: 'ArrowDown' });
    expect(onScrollToOffset).toHaveBeenLastCalledWith(130);

    fireEvent.keyDown(scrollbar, { key: 'End' });
    expect(onScrollToOffset).toHaveBeenLastCalledWith(200);
  });

  it('reveals an auto-hidden scrollbar while it has keyboard focus', () => {
    const { container } = render(
      <ScrollbarOverlay
        direction="y"
        viewportSpan={100}
        scrollContentSpan={300}
        scrollOffset={0}
        isScrolling={false}
        config={{}}
        onScrollToOffset={jest.fn()}
      />
    );

    const overlay = container.querySelector(
      '[data-cineview-scrollbar-overlay="true"]'
    ) as HTMLDivElement;
    const scrollbar = screen.getByRole('scrollbar', { name: 'CineView scroll position' });

    expect(overlay.style.opacity).toBe('0');
    fireEvent.focus(scrollbar);
    expect(overlay.style.opacity).toBe('1');
    expect(scrollbar.style.outline).toContain('2px solid');
    fireEvent.blur(scrollbar);
    expect(overlay.style.opacity).toBe('0');
    expect(scrollbar.style.outline).toBe('none');
  });

  it('accepts a consumer-provided accessible label', () => {
    render(
      <ScrollbarOverlay
        direction="x"
        viewportSpan={100}
        scrollContentSpan={300}
        scrollOffset={0}
        isScrolling={false}
        config={{ ariaLabel: 'Story timeline' }}
        onScrollToOffset={jest.fn()}
      />
    );

    expect(screen.getByRole('scrollbar', { name: 'Story timeline' })).toHaveAttribute(
      'aria-orientation',
      'horizontal'
    );
  });

  function dispatchPointer(
    target: EventTarget,
    type: string,
    clientY: number,
    pointerId = 7
  ): void {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
    Object.defineProperties(event, {
      pointerId: { configurable: true, value: pointerId },
      pointerType: { configurable: true, value: 'touch' },
    });
    target.dispatchEvent(event);
  }

  function renderPointerScrollbar(onScrollToOffset: jest.Mock): HTMLElement {
    render(
      <ScrollbarOverlay
        direction="y"
        viewportSpan={100}
        scrollContentSpan={300}
        scrollOffset={0}
        isScrolling={false}
        config={{ autoHide: false }}
        onScrollToOffset={onScrollToOffset}
      />
    );

    const scrollbar = screen.getByRole('scrollbar', { name: 'CineView scroll position' });
    jest.spyOn(scrollbar, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 6,
      bottom: 100,
      left: 0,
      width: 6,
      height: 100,
      toJSON: () => ({}),
    });
    return scrollbar;
  }

  it('supports touch and pen dragging through pointer events', () => {
    const onScrollToOffset = jest.fn();
    const scrollbar = renderPointerScrollbar(onScrollToOffset);

    dispatchPointer(scrollbar, 'pointerdown', 10);
    dispatchPointer(window, 'pointermove', 60);
    dispatchPointer(window, 'pointerup', 60);

    expect(onScrollToOffset).toHaveBeenCalled();
    const lastCall = onScrollToOffset.mock.calls[onScrollToOffset.mock.calls.length - 1];
    expect(lastCall?.[0]).toBeGreaterThan(0);
  });

  it('does not let a second pointer take over an active thumb drag', () => {
    const onScrollToOffset = jest.fn();
    const scrollbar = renderPointerScrollbar(onScrollToOffset);

    dispatchPointer(scrollbar, 'pointerdown', 10, 1);
    dispatchPointer(scrollbar, 'pointerdown', 10, 2);
    onScrollToOffset.mockClear();

    dispatchPointer(window, 'pointermove', 60, 1);
    dispatchPointer(window, 'pointerup', 60, 1);

    expect(onScrollToOffset).toHaveBeenCalledTimes(1);
    expect(onScrollToOffset.mock.calls[0]?.[0]).toBeGreaterThan(0);
  });

  it('ignores secondary mouse buttons and non-primary pointers', () => {
    const onScrollToOffset = jest.fn();
    const scrollbar = renderPointerScrollbar(onScrollToOffset);

    const rightClick = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientY: 60,
    });
    Object.defineProperties(rightClick, {
      pointerId: { configurable: true, value: 1 },
      pointerType: { configurable: true, value: 'mouse' },
      isPrimary: { configurable: true, value: true },
    });
    scrollbar.dispatchEvent(rightClick);

    const secondaryTouch = new MouseEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      clientY: 60,
    });
    Object.defineProperties(secondaryTouch, {
      pointerId: { configurable: true, value: 2 },
      pointerType: { configurable: true, value: 'touch' },
      isPrimary: { configurable: true, value: false },
    });
    scrollbar.dispatchEvent(secondaryTouch);

    expect(onScrollToOffset).not.toHaveBeenCalled();
  });
});
