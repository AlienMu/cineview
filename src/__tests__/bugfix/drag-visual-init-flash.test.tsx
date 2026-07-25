/**
 * Bug D-P1-1: one-frame visual flash in drag mode — re-scoped for the
 * first-screen cold-start enter spec.
 *
 * ORIGINAL BUG: a rested, active scene resolves to { mode: 'rest',
 * localProgress: 1 }, i.e. its fade-in element should render at the animate
 * (terminal) opacity. If visualMotion were seeded with 0, the FIRST committed
 * frame would render initial (opacity 0) and only the post-paint useEffect
 * would correct it to terminal — a visible flash. The fix seeds visualMotion
 * synchronously from resolveVisualState so the first commit already matches the
 * post-effect value.
 *
 * WHY THE OLD ASSERTION IS NOW WRONG: under the first-screen cold-start enter
 * spec, the first scene (index 0) in drag mode no longer rests at terminal on
 * its first frame. It is held at its enter-INITIAL frame (opacity 0) until
 * priority assets settle, after which CineView drives the shared timeline once
 * to play a single enter. So "first frame must be terminal (~1)" is no longer
 * a valid premise for the first scene — opacity 0 there is the designed,
 * driver-gated start, not an accidental unseeded flash.
 *
 * WHAT STILL MATTERS (and is verified here): the seed must always match the
 * RESOLVED render-time state so there is never an effect-driven jump between
 * the first committed frame and the steady state. Concretely:
 *   1. Cold start: the first frame is the controlled enter-initial (0) AND it
 *      STAYS 0 across re-renders/effects until the driver advances the
 *      timeline. An unseeded accident would instead be corrected toward the
 *      resolved value by an effect; a stuck-at-0 that never reaches terminal
 *      would mean the driver is dead. We prove it's a *controlled* start by
 *      driving the captured driver to completion and watching it reach
 *      terminal.
 *   2. After the enter completes, the first scene rests at terminal and every
 *      committed frame renders ~1 — never dropping back to 0. This is the
 *      surviving original anti-flash guarantee (seed == resolved rest value).
 *
 * This test observes the resolved opacity the motion.div mock applies at RENDER
 * time (pre-effect), in render order, which is exactly where a seed/effect
 * mismatch flash would live. The first-scene driver's animate() is captured so
 * the test drives the timeline deterministically (no real rAF under jsdom).
 */

import React, { createRef } from 'react';
import { render, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CineView, Scene, Animate, Position } from '../../index';
import type { CineViewRef } from '../../types';

// Records the resolved opacity at the moment each Animate element renders, in
// render order. The first entry for a given animate id is its first-frame
// (pre-effect) opacity; the sequence lets us assert there is no flash jump.
const renderOpacityLog: Array<{ id: string; opacity: number }> = [];

// First-scene driver controllers captured from animate(). The driver is a
// plain-number animation; we do NOT auto-run it so the enter sweep is
// observable and deterministic.
interface DriverController {
  target: number;
  onUpdate?: (latest: number) => void;
  onComplete?: () => void;
  stopped: boolean;
}
let driverControllers: DriverController[] = [];

function resolveMotionLike(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { get?: unknown }).get === 'function'
  ) {
    return (value as { get: () => unknown }).get();
  }
  return value;
}

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactLib = require('react');

  const createMotionValueStub = (initial: number) => {
    let current = initial;
    const listeners = new Set<(value: number) => void>();
    return {
      get: () => current,
      set: (value: number) => {
        current = value;
        listeners.forEach((listener) => listener(current));
      },
      on: (event: string, listener: (value: number) => void) => {
        if (event !== 'change') {
          return () => undefined;
        }
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };

  const MotionDiv = ReactLib.forwardRef(
    ({ children, style, onPanStart, onPan, onPanEnd, ...props }: any, ref: any) => {
      const animateId = props['data-cineview-animate-id'];
      const resolvedStyle: Record<string, unknown> = {};
      if (style) {
        for (const key of Object.keys(style)) {
          resolvedStyle[key] = resolveMotionLike(style[key]);
        }
      }

      // Capture the per-frame opacity for cineview-animate elements at the
      // moment of render (before effects run / correct the value).
      if (animateId && style && 'opacity' in style) {
        const opacity = resolveMotionLike(style.opacity);
        if (typeof opacity === 'number') {
          renderOpacityLog.push({ id: animateId, opacity });
        }
        // Two-track model: the element track is a MotionValue driven by the
        // scene's own useElementTrack, which updates WITHOUT a React re-render
        // (real framer-motion binds style={motionValue} straight to the DOM).
        // Mirror that: subscribe to the opacity motion value's change events so
        // driver ticks are logged exactly as the browser would paint them.
        const opacityValue = style.opacity;
        if (
          opacityValue &&
          typeof opacityValue === 'object' &&
          typeof opacityValue.on === 'function'
        ) {
          ReactLib.useEffect(() => {
            return opacityValue.on('change', (latest: unknown) => {
              if (typeof latest === 'number') {
                renderOpacityLog.push({ id: animateId, opacity: latest });
              }
            });
          }, [opacityValue, animateId]);
        }
      }

      return ReactLib.createElement('div', { ref, ...props, style: resolvedStyle }, children);
    }
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    __esModule: true,
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      set: jest.fn(),
    }),
    useMotionValue: (initial: number) => {
      // Stable across renders, like real framer-motion. The two-track element
      // track relies on a single persistent MotionValue instance; a fresh stub
      // per render would swap identity mid-animation.
      const ref: { current: ReturnType<typeof createMotionValueStub> | null } =
        ReactLib.useRef(null);
      if (ref.current === null) {
        ref.current = createMotionValueStub(initial);
      }
      return ref.current;
    },
    useTransform: (
      source: { get: () => number; on?: (e: string, l: (v: number) => void) => () => void },
      transform: (value: number) => number
    ) => {
      const motionValue = createMotionValueStub(transform(source.get()));
      source.on?.('change', (value) => {
        motionValue.set(transform(value));
      });
      return motionValue;
    },
    animate: (
      _value: { set?: (next: number) => void } | number,
      target: number,
      options?: { onUpdate?: (latest: number) => void; onComplete?: () => void }
    ) => {
      const controller: DriverController = {
        target,
        onUpdate: options?.onUpdate,
        onComplete: options?.onComplete,
        stopped: false,
      };
      driverControllers.push(controller);
      // Do NOT auto-run: the test drives onUpdate/onComplete so the cold-start
      // enter sweep is observable frame by frame.
      return {
        stop: () => {
          controller.stopped = true;
        },
      };
    },
  };
});

const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

function lastOpacityFor(id: string): number | undefined {
  for (let i = renderOpacityLog.length - 1; i >= 0; i -= 1) {
    if (renderOpacityLog[i].id === id) {
      return renderOpacityLog[i].opacity;
    }
  }
  return undefined;
}

function renderDragApp() {
  const cineViewRef = createRef<CineViewRef>();
  // No preloadImages: priority assets are vacuously complete, so the
  // first-scene driver is created immediately (priorityComplete is true).
  const utils = render(
    <CineView
      ref={cineViewRef}
      mode="drag"
      modes={{ drag: { direction: 'y', transitionDuration: 800 } }}
      config={{ size: 750 }}
    >
      <Scene>
        <Position at={{ x: 375, y: 220 }}>
          <Animate animateId="flash-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Flash Scene 1</h1>
          </Animate>
        </Position>
      </Scene>
      <Scene>
        <Position at={{ x: 375, y: 220 }}>
          <Animate animateId="next-title" enterAnimation="fade-in" duration={{ enter: 600 }}>
            <h1>Flash Scene 2</h1>
          </Animate>
        </Position>
      </Scene>
    </CineView>
  );
  return { cineViewRef, ...utils };
}

describe('drag visual init flash (D-P1-1, first-scene enter spec)', () => {
  beforeEach(() => {
    renderOpacityLog.length = 0;
    driverControllers = [];
  });

  it('holds the first scene at a controlled enter-initial (0) on the first frame, then the driver reaches terminal — no seed/effect mismatch flash', async () => {
    const { cineViewRef } = renderDragApp();

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });

    // The active scene's fade-in element renders once the async variant parse
    // commits; wait for it to appear in the render log.
    await waitFor(() => {
      expect(renderOpacityLog.some((entry) => entry.id === 'flash-title')).toBe(true);
    });

    // The cold-start driver was created (priority assets are vacuously ready).
    await waitFor(() => {
      expect(driverControllers.length).toBeGreaterThan(0);
    });

    // The very first committed frame is the enter-INITIAL (opacity 0). Under
    // the first-scene cold-start spec this is the designed, driver-gated start,
    // NOT the old unseeded flash.
    const firstFrame = renderOpacityLog.find((entry) => entry.id === 'flash-title');
    expect(firstFrame?.opacity).toBeLessThan(0.01);

    // It must be a *controlled* start: with the timeline not yet advanced, the
    // element STAYS at ~0 across further re-renders/effects. An accidental
    // unseeded value would instead be corrected by an effect; a controlled
    // gate holds the initial frame until the driver moves the timeline.
    await act(async () => {
      await Promise.resolve();
    });
    const maxBeforeDrive = renderOpacityLog
      .filter((entry) => entry.id === 'flash-title')
      .reduce((max, entry) => Math.max(max, entry.opacity), 0);
    expect(maxBeforeDrive).toBeLessThan(0.01);

    // Driving the captured driver mid-way advances the controlled enter — the
    // element leaves initial under driver control, proving the 0 was a live
    // gated start and not a dead stuck value.
    act(() => {
      driverControllers[0].onUpdate?.(300);
    });
    await waitFor(() => {
      expect(lastOpacityFor('flash-title')).toBeGreaterThan(0.05);
    });

    // Completing the enter rests the element at terminal (opacity 1).
    act(() => {
      driverControllers[0].onComplete?.();
    });
    await waitFor(() => {
      expect(lastOpacityFor('flash-title')).toBeGreaterThan(0.99);
    });
  });

  it('renders the rested first scene at terminal (no 0-flash) on every committed frame once the enter has completed', async () => {
    const { cineViewRef } = renderDragApp();

    await waitFor(() => {
      expect(cineViewRef.current?.getCurrentScene()).toBe(0);
    });
    await waitFor(() => {
      expect(driverControllers.length).toBeGreaterThan(0);
    });

    // Complete the cold-start enter so firstSceneEnterActive clears and the
    // scene transitions to its rest (terminal) state.
    act(() => {
      driverControllers[0].onComplete?.();
    });
    await waitFor(() => {
      expect(lastOpacityFor('flash-title')).toBeGreaterThan(0.99);
    });

    // From this point the scene is at rest. This is exactly the condition the
    // original D-P1-1 bug regressed: the seed must equal the resolved rest
    // value (terminal), so any subsequent committed frame must render ~1 and
    // never drop back to 0. Capture the index of the terminal frame, then
    // force re-renders and assert no later frame flashes to 0.
    const terminalStart = renderOpacityLog.length;
    act(() => {
      // A harmless state nudge that re-commits the scene tree.
      cineViewRef.current?.refreshLayout?.();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const framesAfterRest = renderOpacityLog
      .slice(terminalStart)
      .filter((entry) => entry.id === 'flash-title');
    // There must be no flash: every rested frame stays at terminal.
    framesAfterRest.forEach((entry) => {
      expect(entry.opacity).toBeGreaterThan(0.99);
    });
    expect(lastOpacityFor('flash-title')).toBeGreaterThan(0.99);
  });
});
