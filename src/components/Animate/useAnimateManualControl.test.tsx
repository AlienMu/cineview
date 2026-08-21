/**
 * Manual control tests: `AnimateProps.enterRef` / `exitRef`.
 *
 * Contract under test (see DESIGN.md "手动控制 + 兜底触发"):
 *   enterRef + no waitFor/delay → the gate NEVER fires on its own; only the ref does.
 *   enterRef + waitFor/delay    → the wait is a FALLBACK: it still self-starts, and a
 *                                 manual call preempts whatever is left of it.
 *   exitRef                     → the automatic exit gate is disabled outright.
 *   scrub lanes (scroll takeover / scene-controlled drag) → refs are reported as
 *                                 unsupported, because progress there has a single
 *                                 owner (scroll position / finger) that would
 *                                 overwrite any manual write on the next frame.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type MutableRefObject, type ReactNode } from 'react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollZoneRuntime, SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import { CineViewRuntimeContext } from '../CineView/runtimeContext';

jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  const React = jest.requireActual('react');

  const MotionDiv = ({
    children,
    style,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & {
    style?: Record<string, unknown>;
  }): JSX.Element => {
    const [, forceRender] = React.useState(0);

    React.useEffect(() => {
      const unsubs = Object.values(style ?? {})
        .filter(
          (
            value
          ): value is {
            get: () => unknown;
            on: (event: 'change', listener: () => void) => () => void;
          } =>
            Boolean(
              value &&
              typeof value === 'object' &&
              'get' in value &&
              typeof value.get === 'function' &&
              'on' in value &&
              typeof value.on === 'function'
            )
        )
        .map((value) =>
          value.on('change', () => {
            queueMicrotask(() => {
              forceRender((count: number) => count + 1);
            });
          })
        );

      return () => {
        unsubs.forEach((unsubscribe) => unsubscribe());
      };
    }, [style]);

    const resolvedStyle = Object.fromEntries(
      Object.entries(style ?? {}).map(([key, value]) => [
        key,
        value && typeof value === 'object' && 'get' in value && typeof value.get === 'function'
          ? value.get()
          : value,
      ])
    );

    return (
      <div
        data-testid="motion-div"
        data-opacity={String(resolvedStyle.opacity ?? '')}
        {...props}
        style={resolvedStyle as React.CSSProperties}
      >
        {children}
      </div>
    );
  };

  return {
    ...actualMotion,
    motion: { div: MotionDiv },
    useAnimation: () => ({
      start: jest.fn().mockResolvedValue(undefined),
      set: jest.fn(),
      stop: jest.fn(),
    }),
  };
});

jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn(() =>
    Promise.resolve({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    })
  ),
}));

function createScrollSceneContext(overrides: Partial<SceneContextType> = {}): SceneContextType {
  return {
    mode: 'scroll',
    isActive: true,
    isVisible: false,
    visibilityProgress: 0,
    isDragging: false,
    dragProgressMotion: { get: () => 0, set: jest.fn() } as never,
    sharedElapsedMotion: { get: () => 0, set: jest.fn() } as never,
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 800,
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
    getTimelineDuration: jest.fn(() => 800),
    enterDuration: 600,
    scrollProgress: 0,
    scrollTimelineState: null,
    ...overrides,
  };
}

function createHostRect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    left: 0,
    right: 100,
    width: 100,
    height: bottom - top,
    x: 0,
    y: top,
    toJSON: () => undefined,
  } as DOMRect;
}

async function flushScroll(): Promise<void> {
  await act(async () => {
    fireEvent.scroll(window);
    await new Promise((resolve) => setTimeout(resolve, 32));
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function readOpacity(): number {
  const node =
    screen
      .getAllByTestId('motion-div')
      .find((element) => element.getAttribute('data-cineview-animate-id') !== null) ??
    screen.getByTestId('motion-div');
  return Number(node.getAttribute('data-opacity') ?? '0');
}

/** Place the host fully inside the viewport so the enter gate is satisfied. */
async function satisfyEnterGate(animateId: string): Promise<void> {
  await waitFor(() => {
    expect(document.querySelector(`[data-cineview-animate-host="${animateId}"]`)).not.toBeNull();
  });
  const host = document.querySelector(`[data-cineview-animate-host="${animateId}"]`) as HTMLElement;
  host.getBoundingClientRect = () => createHostRect(200, 400);
  await flushScroll();
}

/** Move the host up past the top edge so the exit gate is satisfied. */
async function satisfyExitGate(animateId: string): Promise<void> {
  const host = document.querySelector(`[data-cineview-animate-host="${animateId}"]`) as HTMLElement;
  host.getBoundingClientRect = () => createHostRect(-300, -100);
  await flushScroll();
}

function ManualProbe({
  animateId,
  enterRefOut,
  exitRefOut,
  delay,
  children,
}: {
  animateId: string;
  enterRefOut?: (ref: MutableRefObject<(() => void) | null>) => void;
  exitRefOut?: (ref: MutableRefObject<(() => void) | null>) => void;
  delay?: number;
  children: ReactNode;
}): JSX.Element {
  const enterRef = useRef<(() => void) | null>(null);
  const exitRef = useRef<(() => void) | null>(null);
  enterRefOut?.(enterRef);
  exitRefOut?.(exitRef);

  return (
    <Animate
      animateId={animateId}
      enterAnimation="fade-in"
      exitAnimation="fade-out"
      duration={{ enter: 40, exit: 40 }}
      timeline={{ sceneControlled: false, ...(delay === undefined ? {} : { delay }) }}
      enterRef={enterRefOut ? enterRef : undefined}
      exitRef={exitRefOut ? exitRef : undefined}
    >
      {children}
    </Animate>
  );
}

describe('Animate manual control (enterRef / exitRef)', () => {
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  it('never auto-enters when enterRef is passed without a waitFor/delay fallback', async () => {
    let enterRef!: MutableRefObject<(() => void) | null>;

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ManualProbe
          animateId="manual-only"
          enterRefOut={(ref) => {
            enterRef = ref;
          }}
        >
          <article>Manual only</article>
        </ManualProbe>
      </SceneContext.Provider>
    );

    await satisfyEnterGate('manual-only');
    // The gate is satisfied and would normally enter; consumer ownership holds it.
    await advance(120);
    expect(readOpacity()).toBe(0);
    expect(typeof enterRef.current).toBe('function');

    await act(async () => {
      enterRef.current?.();
    });
    await waitFor(() => expect(readOpacity()).toBe(1));
  });

  it('still self-starts after the authored delay when the consumer never calls enterRef', async () => {
    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ManualProbe animateId="fallback-delay" delay={60} enterRefOut={() => {}}>
          <article>Fallback</article>
        </ManualProbe>
      </SceneContext.Provider>
    );

    await satisfyEnterGate('fallback-delay');
    // Still waiting out the fallback delay.
    expect(readOpacity()).toBe(0);

    await advance(140);
    await waitFor(() => expect(readOpacity()).toBe(1));
  });

  it('preempts the remaining fallback wait when enterRef fires mid-delay', async () => {
    let enterRef!: MutableRefObject<(() => void) | null>;

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ManualProbe
          animateId="preempt-delay"
          delay={5000}
          enterRefOut={(ref) => {
            enterRef = ref;
          }}
        >
          <article>Preempt</article>
        </ManualProbe>
      </SceneContext.Provider>
    );

    await satisfyEnterGate('preempt-delay');
    expect(readOpacity()).toBe(0);

    await act(async () => {
      enterRef.current?.();
    });

    // Interrupt means "drop the rest of the timeline and play now" — a 5s delay
    // must not gate this, and it must not restart the wait either.
    await waitFor(() => expect(readOpacity()).toBe(1));
  });

  it('disables the automatic exit gate when exitRef is passed, and exits on call', async () => {
    let exitRef!: MutableRefObject<(() => void) | null>;

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ManualProbe
          animateId="manual-exit"
          exitRefOut={(ref) => {
            exitRef = ref;
          }}
        >
          <article>Manual exit</article>
        </ManualProbe>
      </SceneContext.Provider>
    );

    // No enterRef → the enter gate still drives the entrance normally.
    await satisfyEnterGate('manual-exit');
    await waitFor(() => expect(readOpacity()).toBe(1));

    // Exit gate satisfied, but the consumer owns the exit: stay entered.
    await satisfyExitGate('manual-exit');
    await advance(120);
    expect(readOpacity()).toBe(1);

    await act(async () => {
      exitRef.current?.();
    });
    await waitFor(() => expect(readOpacity()).toBe(0));
  });

  it('keeps a manual exit sticky while the element is still inside the viewport', async () => {
    // Regression: `autoExitSuppressed` only closed the EXIT gate. With the element
    // still on screen and `replayOnReenter` defaulting to true, the very next scroll
    // tick saw phase 'exited' + enterGate true and replayed the entrance — undoing
    // the consumer's exit. Exiting by hand must claim the enter gate too.
    let exitRef!: MutableRefObject<(() => void) | null>;

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ManualProbe
          animateId="sticky-exit"
          exitRefOut={(ref) => {
            exitRef = ref;
          }}
        >
          <article>Sticky exit</article>
        </ManualProbe>
      </SceneContext.Provider>
    );

    await satisfyEnterGate('sticky-exit');
    await waitFor(() => expect(readOpacity()).toBe(1));

    // Exit while the host is STILL fully inside the viewport (enter gate satisfied).
    await act(async () => {
      exitRef.current?.();
    });
    await waitFor(() => expect(readOpacity()).toBe(0));

    // Further measurements must not pull it back in.
    await flushScroll();
    await advance(120);
    await flushScroll();
    expect(readOpacity()).toBe(0);
  });

  it('reports enterRef/exitRef as unsupported on the scroll-takeover (scrub) lane', async () => {
    const reportError = jest.fn();
    const zoneState: SceneScrollTimelineState = {
      zoneId: 'zone-1',
      sceneIndex: 0,
      progressPx: 0,
      totalBudgetPx: 100,
      active: true,
      direction: null,
      approach: 'near',
      sequence: { budgets: {}, totalDurationMs: 0, totalBudgetPx: 100 },
    };
    const zoneRuntime: SceneScrollZoneRuntime = {
      zoneStates: { 'zone-1': zoneState },
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    function ScrubProbe(): JSX.Element {
      const enterRef = useRef<(() => void) | null>(null);
      return (
        <Animate
          animateId="scrub-lane"
          enterAnimation="fade-in"
          duration={{ enter: 40 }}
          enterRef={enterRef}
        >
          <article>Scrub</article>
        </Animate>
      );
    }

    render(
      <CineViewRuntimeContext.Provider value={{ mode: 'scroll', reportError }}>
        <SceneContext.Provider value={createScrollSceneContext()}>
          <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
            <SceneScrollTimelineContext.Provider value={{ zoneStates: { 'zone-1': zoneState } }}>
              <SceneScrollTakeoverContext.Provider value="zone-1">
                <ScrubProbe />
              </SceneScrollTakeoverContext.Provider>
            </SceneScrollTimelineContext.Provider>
          </SceneScrollRuntimeContext.Provider>
        </SceneContext.Provider>
      </CineViewRuntimeContext.Provider>
    );

    await waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_ANIMATION',
          context: expect.objectContaining({ componentId: 'scrub-lane', field: 'enterRef' }),
        })
      );
    });
  });
});
