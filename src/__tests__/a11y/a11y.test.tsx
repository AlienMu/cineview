/**
 * N7 — accessibility.
 *
 * Four gaps the audit measured as literally zero in framework source:
 *   1. `prefers-reduced-motion`   — 0 references outside tests
 *   2. `inert` on inactive scenes — 0 in JSX (only pointerEvents:'none')
 *   3. `aria-live` announcement   — 0 repo-wide
 *   4. keyboard access in drag    — 0 keydown handlers on the drag path
 *
 * These assert rendered behaviour, not that an attribute string appears somewhere.
 */

import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate } from '../../index';

type MediaListener = () => void;

let reduceMotionMatches = false;
const mediaListeners = new Set<MediaListener>();

function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: query.includes('prefers-reduced-motion') ? reduceMotionMatches : false,
      addEventListener: (_: string, listener: MediaListener) => mediaListeners.add(listener),
      removeEventListener: (_: string, listener: MediaListener) => mediaListeners.delete(listener),
      addListener: (listener: MediaListener) => mediaListeners.add(listener),
      removeListener: (listener: MediaListener) => mediaListeners.delete(listener),
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

beforeEach(() => {
  reduceMotionMatches = false;
  mediaListeners.clear();
  installMatchMedia();
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest.fn(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

function renderDragApp(props: Record<string, unknown> = {}): void {
  render(
    <CineView mode="drag" designWidth={750} {...props}>
      <Scene>
        <Animate animateId="s0" enterAnimation="fade-in">
          <h1>Scene one</h1>
        </Animate>
      </Scene>
      <Scene>
        <Animate animateId="s1" enterAnimation="fade-in">
          <h1>Scene two</h1>
        </Animate>
      </Scene>
      <Scene>
        <Animate animateId="s2" enterAnimation="fade-in">
          <h1>Scene three</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}

function container(): HTMLElement {
  const node = document.querySelector('[data-cineview-container="true"]');
  expect(node).not.toBeNull();
  return node as HTMLElement;
}

function announced(): string {
  const live = document.querySelector('[role="status"]') as HTMLElement | null;
  expect(live).not.toBeNull();
  return live!.textContent ?? '';
}

describe('N7 · drag root is a keyboard-reachable, named region', () => {
  it('names the region and puts it in the tab order', async () => {
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());

    const root = container();
    expect(root).toHaveAttribute('role', 'region');
    expect(root).toHaveAttribute('aria-label', 'Scenes');
    expect(root).toHaveAttribute('aria-roledescription', 'carousel');
    expect(root.tabIndex).toBe(0);
  });

  it('takes the accessible name from a11y.label so two roots stay distinguishable', async () => {
    renderDragApp({ a11y: { label: 'Product tour' } });
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());
    expect(container()).toHaveAttribute('aria-label', 'Product tour');
  });

  it('pages with PageDown/PageUp, Home/End and the axis arrow keys', async () => {
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());
    const root = container();

    expect(announced()).toBe('1 / 3');

    act(() => {
      fireEvent.keyDown(root, { key: 'PageDown' });
    });
    await waitFor(() => expect(announced()).toBe('2 / 3'));

    act(() => {
      fireEvent.keyDown(root, { key: 'PageUp' });
    });
    await waitFor(() => expect(announced()).toBe('1 / 3'));

    act(() => {
      fireEvent.keyDown(root, { key: 'End' });
    });
    await waitFor(() => expect(announced()).toBe('3 / 3'));

    act(() => {
      fireEvent.keyDown(root, { key: 'Home' });
    });
    await waitFor(() => expect(announced()).toBe('1 / 3'));

    // Default axis is 'y', so ArrowDown pages forward.
    act(() => {
      fireEvent.keyDown(root, { key: 'ArrowDown' });
    });
    await waitFor(() => expect(announced()).toBe('2 / 3'));
  });

  it('does not page past either end', async () => {
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());
    const root = container();

    act(() => {
      fireEvent.keyDown(root, { key: 'PageUp' });
    });
    expect(announced()).toBe('1 / 3');

    act(() => {
      fireEvent.keyDown(root, { key: 'End' });
    });
    await waitFor(() => expect(announced()).toBe('3 / 3'));
    act(() => {
      fireEvent.keyDown(root, { key: 'PageDown' });
    });
    expect(announced()).toBe('3 / 3');
  });

  it('leaves keys alone when they originate inside a scene', async () => {
    render(
      <CineView mode="drag" designWidth={750}>
        <Scene>
          <input aria-label="search" />
        </Scene>
        <Scene>
          <h1>Scene two</h1>
        </Scene>
      </CineView>
    );
    await waitFor(() => expect(screen.getByLabelText('search')).toBeInTheDocument());

    act(() => {
      fireEvent.keyDown(screen.getByLabelText('search'), { key: 'PageDown', bubbles: true });
    });
    // An authored control keeps its own keys; the stack must not page underneath it.
    expect(announced()).toBe('1 / 2');
  });
});

describe('N7 · scene changes are announced', () => {
  it('publishes the position in a polite live region that stays in the a11y tree', async () => {
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());

    const live = document.querySelector('[role="status"]') as HTMLElement;
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live.textContent).toBe('1 / 3');
    // Off-screen, but NOT display:none / visibility:hidden — either would remove it
    // from the accessibility tree, which is the opposite of what a live region needs.
    expect(live.style.display).not.toBe('none');
    expect(live.style.visibility).not.toBe('hidden');
    expect(live.style.position).toBe('absolute');
  });
});

describe('N7 · inactive scenes are hidden from assistive tech', () => {
  it('marks hidden scenes both inert and aria-hidden', async () => {
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());

    // Wait for the useEffect that sets inert to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const hidden = Array.from(document.querySelectorAll('[aria-hidden="true"]'));
    expect(hidden.length).toBeGreaterThan(0);
    // aria-hidden alone still leaves Tab stops behind; the two travel together.
    hidden.forEach((node) => {
      expect((node as HTMLElement).inert).toBe(true);
    });

    // The scene the reader is on must not be hidden.
    let node: HTMLElement | null = screen.getByText('Scene one');
    while (node) {
      expect(node.getAttribute('aria-hidden')).not.toBe('true');
      node = node.parentElement;
    }
  });
});

describe('N7 · prefers-reduced-motion', () => {
  it('keeps rendering the content — reduce motion removes motion, not information', async () => {
    reduceMotionMatches = true;
    renderDragApp();
    await waitFor(() => expect(screen.getByText('Scene one')).toBeInTheDocument());
    expect(container()).toHaveAttribute('role', 'region');
    expect(announced()).toBe('1 / 3');
  });
});
