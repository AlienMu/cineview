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
});
