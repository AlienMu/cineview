/**
 * N7 — `prefers-reduced-motion` (WCAG 2.3.3).
 *
 * Separate file because it needs a framer-motion stub: whether a loop RAN is only
 * observable on the animation controls. Asserting on the rendered transform is not
 * enough — a first attempt did exactly that and the mutation "loop ignores
 * reduce-motion" survived it, because jsdom never paints the tween either way.
 *
 * The line this draws: motion the framework starts by itself is suppressed
 * (persistent loops, the visibility enter/exit tween). Scrub is NOT — that is the
 * user's own pointer or scroll being reflected back, not motion the page decided
 * to play.
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const loopStarts: Array<Record<string, unknown>> = [];

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    useAnimation: () => {
      const controls = actual.useAnimation();
      const start = controls.start.bind(controls);
      return {
        ...controls,
        start: (definition: Record<string, unknown>) => {
          const transition = definition?.transition as Record<string, unknown> | undefined;
          if (transition && transition.repeat === Infinity) loopStarts.push(definition);
          return start(definition);
        },
      };
    },
  };
});

// Imported after jest.mock on purpose: the factory is hoisted above imports, so the
// module graph below already sees the wrapped useAnimation.
import { CineView, Scene, Animate } from '../../index';

let reduceMotionMatches = false;

function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      matches: query.includes('prefers-reduced-motion') ? reduceMotionMatches : false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

beforeEach(() => {
  loopStarts.length = 0;
  reduceMotionMatches = false;
  installMatchMedia();
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = jest.fn(() => ({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  }));
});

function renderLoop(): void {
  render(
    <CineView mode="drag" designWidth={750}>
      <Scene>
        <Animate animateId="looper" loopAnimation="pulse">
          <h1>Looping</h1>
        </Animate>
      </Scene>
      <Scene>
        <h1>Second</h1>
      </Scene>
    </CineView>
  );
}

describe('N7 · reduce motion stops framework-started loops', () => {
  it('starts a repeat:Infinity animation when the OS does not ask for reduced motion', async () => {
    reduceMotionMatches = false;
    renderLoop();
    await waitFor(() => expect(screen.getByText('Looping')).toBeInTheDocument());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    // Control arm: without the preference the loop really does start, so the
    // reduced-motion assertion below is testing suppression, not a dead path.
    expect(loopStarts.length).toBeGreaterThan(0);
  });

  it('never starts one when the OS asks for reduced motion', async () => {
    reduceMotionMatches = true;
    renderLoop();
    await waitFor(() => expect(screen.getByText('Looping')).toBeInTheDocument());
    // Give the effect the same chance to run that the control arm had.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(loopStarts).toHaveLength(0);
    // The content itself is untouched: reduce motion removes motion, not information.
    expect(screen.getByText('Looping')).toBeInTheDocument();
  });
});
