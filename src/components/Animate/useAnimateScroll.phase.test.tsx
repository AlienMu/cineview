import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollZoneRuntime, SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import { CineViewRuntimeContext } from '../CineView/runtimeContext';

const animationControlsRegistry: Array<{
  start: jest.Mock;
  set: jest.Mock;
  stop: jest.Mock;
}> = [];

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
        data-y={String(resolvedStyle.y ?? '')}
        {...props}
        style={resolvedStyle as React.CSSProperties}
      >
        {children}
      </div>
    );
  };

  return {
    ...actualMotion,
    motion: {
      div: MotionDiv,
    },
    useAnimation: (): {
      start: jest.Mock;
      set: jest.Mock;
      stop: jest.Mock;
    } => {
      const controlsRef: React.MutableRefObject<{
        start: jest.Mock;
        set: jest.Mock;
        stop: jest.Mock;
      } | null> = React.useRef(null);

      if (!controlsRef.current) {
        controlsRef.current = {
          start: jest.fn().mockResolvedValue(undefined),
          set: jest.fn(),
          stop: jest.fn(),
        };
        animationControlsRegistry.push(controlsRef.current);
      }

      return controlsRef.current;
    },
  };
});

jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn((animation) => {
    if (animation === 'slide-up') {
      return Promise.resolve({
        initial: { y: '100%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '-100%', opacity: 0 },
      });
    }

    return Promise.resolve({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    });
  }),
}));

function createScrollSceneContext(): SceneContextType {
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
  };
}

// A standalone per-scene enter-completion bus mirroring Scene.tsx's
// markAnimateEntered/subscribeAnimateEntered. Spread into a scene context to
// exercise the visibility waitFor path end-to-end: a follower subscribes to its
// leader, and the leader's 'entered' phase fires the follower's launch. Tests
// can also drive markAnimateEntered directly to simulate a leader that already
// completed before the follower mounts.
function createPhaseBus(): {
  markAnimateEntered: (id: string, entered: boolean) => void;
  subscribeAnimateEntered: (leaderId: string, cb: () => void) => () => void;
} {
  const entered = new Set<string>();
  const subs = new Map<string, Set<() => void>>();
  return {
    markAnimateEntered: (id: string, isEntered: boolean): void => {
      if (!isEntered) {
        entered.delete(id);
        return;
      }
      entered.add(id);
      const cbs = subs.get(id);
      if (cbs) {
        subs.delete(id);
        cbs.forEach((cb) => cb());
      }
    },
    subscribeAnimateEntered: (leaderId: string, cb: () => void): (() => void) => {
      if (entered.has(leaderId)) {
        cb();
        return () => {};
      }
      let cbs = subs.get(leaderId);
      if (!cbs) {
        cbs = new Set();
        subs.set(leaderId, cbs);
      }
      cbs.add(cb);
      return () => {
        cbs?.delete(cb);
      };
    },
  };
}

function createZoneState(progressPx: number): SceneScrollTimelineState {
  return {
    zoneId: 'zone-1',
    sceneIndex: 0,
    progressPx,
    totalBudgetPx: 400,
    active: true,
    direction: 'forward',
    sequence: {
      totalDurationMs: 400,
      totalBudgetPx: 400,
      budgets: {
        intro: {
          animateId: 'intro',
          startMs: 0,
          enterStartMs: 0,
          enterEndMs: 100,
          exitStartMs: null,
          exitEndMs: null,
          totalEndMs: 100,
          startPx: 0,
          enterStartPx: 0,
          enterEndPx: 100,
          exitStartPx: null,
          exitEndPx: null,
          totalEndPx: 100,
          phaseStartPx: 0,
          phaseEndPx: 100,
          hasExit: false,
        },
        'phased-probe': {
          animateId: 'phased-probe',
          startMs: 100,
          enterStartMs: 100,
          enterEndMs: 200,
          exitStartMs: null,
          exitEndMs: null,
          totalEndMs: 200,
          startPx: 100,
          enterStartPx: 100,
          enterEndPx: 200,
          exitStartPx: null,
          exitEndPx: null,
          totalEndPx: 400,
          phaseStartPx: 200,
          phaseEndPx: 400,
          hasExit: false,
        },
      },
    },
  };
}

function createZoneRuntime(progressPx: number, version: number): SceneScrollZoneRuntime {
  return {
    version,
    zoneStates: {
      'zone-1': createZoneState(progressPx),
    },
    registerZone: jest.fn(),
    unregisterZone: jest.fn(),
    setZoneElement: jest.fn(),
    registerZoneAnimation: jest.fn(),
    unregisterZoneAnimation: jest.fn(),
  };
}

function createReplayZoneState(progressPx: number): SceneScrollTimelineState {
  return {
    zoneId: 'zone-1',
    sceneIndex: 0,
    progressPx,
    totalBudgetPx: 200,
    active: true,
    direction: 'forward',
    sequence: {
      totalDurationMs: 200,
      totalBudgetPx: 200,
      budgets: {
        'phase-replay-probe': {
          animateId: 'phase-replay-probe',
          startMs: 0,
          enterStartMs: 0,
          enterEndMs: 100,
          exitStartMs: 100,
          exitEndMs: 200,
          totalEndMs: 200,
          startPx: 0,
          enterStartPx: 0,
          enterEndPx: 100,
          exitStartPx: 150,
          exitEndPx: 200,
          totalEndPx: 200,
          phaseStartPx: 50,
          phaseEndPx: 150,
          hasExit: true,
        },
      },
    },
  };
}

function createReplayZoneRuntime(progressPx: number, version: number): SceneScrollZoneRuntime {
  return {
    version,
    zoneStates: {
      'zone-1': createReplayZoneState(progressPx),
    },
    registerZone: jest.fn(),
    unregisterZone: jest.fn(),
    setZoneElement: jest.fn(),
    registerZoneAnimation: jest.fn(),
    unregisterZoneAnimation: jest.fn(),
  };
}

function createSharedPhaseRuntime(progressPx: number, version: number): SceneScrollZoneRuntime {
  return {
    version,
    zoneStates: {
      'zone-1': {
        zoneId: 'zone-1',
        sceneIndex: 0,
        progressPx,
        totalBudgetPx: 1400,
        active: true,
        direction: 'forward',
        sequence: {
          totalDurationMs: 1020,
          totalBudgetPx: 1400,
          budgets: {
            'scenarios-left': {
              animateId: 'scenarios-left',
              startMs: 0,
              enterStartMs: 0,
              enterEndMs: 620,
              exitStartMs: null,
              exitEndMs: null,
              totalEndMs: 620,
              startPx: 0,
              enterStartPx: 0,
              enterEndPx: 850.98,
              exitStartPx: null,
              exitEndPx: null,
              totalEndPx: 850.98,
              phaseStartPx: 252,
              phaseEndPx: 896,
              hasExit: false,
            },
            'scenarios-center': {
              animateId: 'scenarios-center',
              startMs: 0,
              enterStartMs: 0,
              enterEndMs: 760,
              exitStartMs: null,
              exitEndMs: null,
              totalEndMs: 760,
              startPx: 0,
              enterStartPx: 0,
              enterEndPx: 1043.14,
              exitStartPx: null,
              exitEndPx: null,
              totalEndPx: 1043.14,
              phaseStartPx: 392,
              phaseEndPx: 1148,
              hasExit: false,
            },
            'scenarios-right': {
              animateId: 'scenarios-right',
              startMs: 0,
              enterStartMs: 0,
              enterEndMs: 620,
              exitStartMs: null,
              exitEndMs: null,
              totalEndMs: 620,
              startPx: 0,
              enterStartPx: 0,
              enterEndPx: 850.98,
              exitStartPx: null,
              exitEndPx: null,
              totalEndPx: 850.98,
              phaseStartPx: 616,
              phaseEndPx: 1400,
              hasExit: false,
            },
          },
        },
      },
    },
    registerZone: jest.fn(),
    unregisterZone: jest.fn(),
    setZoneElement: jest.fn(),
    registerZoneAnimation: jest.fn(),
    unregisterZoneAnimation: jest.fn(),
  };
}

// Mounts both scroll contexts from one merged runtime: the runtime context
// gets the stable registration API, the timeline context gets the live
// version/zoneStates snapshot. Mirrors how DirectScrollCineView provides them
// as two separate contexts.
function ScrollZoneProviders({
  runtime,
  children,
}: {
  runtime: SceneScrollZoneRuntime;
  children: ReactNode;
}): JSX.Element {
  return (
    <SceneScrollRuntimeContext.Provider value={runtime}>
      <SceneScrollTimelineContext.Provider
        value={{ version: runtime.version, zoneStates: runtime.zoneStates }}
      >
        {children}
      </SceneScrollTimelineContext.Provider>
    </SceneScrollRuntimeContext.Provider>
  );
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

// Fire a scroll event and let the visibility hook's scheduled rAF callback
// (runVisibilityUpdate -> setShouldRunInfiniteState) settle INSIDE an act scope.
// The hook schedules the gate read on requestAnimationFrame; without flushing
// that frame under act, its setState lands after the test's synchronous segment
// and React warns "update not wrapped in act". A bare macrotask wait covers the
// jsdom rAF (≈16ms) plus the microtask the motion-div mock uses to re-render.
async function flushScroll(target: Window | HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.scroll(target as HTMLElement);
    await new Promise((resolve) => setTimeout(resolve, 32));
  });
}

function readMotionOpacity(): number {
  const motionNode =
    screen
      .getAllByTestId('motion-div')
      .find((node) => node.getAttribute('data-cineview-animate-id') !== null) ??
    screen.getByTestId('motion-div');

  return Number(motionNode.getAttribute('data-opacity') ?? '0');
}

function readMotionY(): string {
  const motionNode =
    screen
      .getAllByTestId('motion-div')
      .find((node) => node.getAttribute('data-cineview-animate-id') !== null) ??
    screen.getByTestId('motion-div');

  return motionNode.getAttribute('data-y') ?? '';
}

function renderReplayPhaseProbe(
  initialProgressPx: number,
  initialSceneOverrides: Partial<SceneContextType> = {}
): {
  rerenderAt: (
    progressPx: number,
    version: number,
    sceneOverrides?: Partial<SceneContextType>
  ) => void;
} {
  const sceneContext = createScrollSceneContext();

  const renderTree = (
    progressPx: number,
    version: number,
    sceneOverrides: Partial<SceneContextType> = {}
  ): JSX.Element => {
    return (
      <SceneContext.Provider value={{ ...sceneContext, ...sceneOverrides }}>
        <ScrollZoneProviders runtime={createReplayZoneRuntime(progressPx, version)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="phase-replay-probe"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              timeline={{
                phase: {
                  start: 0.25,
                  end: 0.75,
                },
              }}
            >
              <div>Replay probe</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );
  };

  const { rerender } = render(renderTree(initialProgressPx, 1, initialSceneOverrides));

  return {
    rerenderAt: (
      progressPx: number,
      version: number,
      sceneOverrides: Partial<SceneContextType> = {}
    ) => {
      rerender(renderTree(progressPx, version, sceneOverrides));
    },
  };
}

describe('useAnimateScroll grouped timeline.phase', () => {
  beforeEach(() => {
    animationControlsRegistry.length = 0;
  });

  it('keeps visibility-driven scroll animations working outside a takeover owner', async () => {
    const sceneContext = createScrollSceneContext();

    render(
      <SceneContext.Provider value={sceneContext}>
        <Animate
          animateId="visibility-probe"
          exitAnimation="fade-out"
          timeline={{ sceneControlled: false }}
        >
          <div>Visibility probe</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
    });

    const host = document.querySelector(
      '[data-cineview-animate-host="visibility-probe"]'
    ) as HTMLElement;
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });
    host.getBoundingClientRect = () =>
      ({
        top: 300,
        bottom: 700,
        left: 0,
        right: 100,
        width: 100,
        height: 400,
        x: 0,
        y: 300,
        toJSON: () => undefined,
      }) as DOMRect;
    await flushScroll(window);

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '1');
    });
  });

  it('uses the center/70% preparatory rule for an oversized element taller than the viewport band', async () => {
    const originalInnerHeight = window.innerHeight;
    const sceneContext = createScrollSceneContext();
    let hostRect = createHostRect(700, 2100); // height 1400 > vh - margin

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="oversized-probe"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            timeline={{ sceneControlled: false }}
          >
            <article>Oversized content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-host="oversized-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="oversized-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;

      // top below viewport center -> NOT entered (the standard "fully inside"
      // rule would never fire for an element taller than the viewport).
      await flushScroll(window);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(readMotionOpacity()).toBe(0);

      // top crosses viewport center (500) -> enter.
      hostRect = createHostRect(400, 1800);
      await flushScroll(window);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // bottom still below 70% line (700) -> stays entered.
      hostRect = createHostRect(-200, 1200);
      await flushScroll(window);
      await new Promise((resolve) => setTimeout(resolve, 80));
      expect(readMotionOpacity()).toBe(1);

      // bottom rises past 70% line -> exit.
      hostRect = createHostRect(-900, 500);
      await flushScroll(window);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(0);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('honors a per-Animate enterMargin override over the default gate', async () => {
    const originalInnerHeight = window.innerHeight;
    const sceneContext = createScrollSceneContext();
    // bottom at 800: with default 50px margin the bottom gap (200) clears, so the
    // element would enter; with a 300px margin it must NOT yet enter (800 > 700).
    const hostRect = createHostRect(100, 800);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="margin-probe"
            enterAnimation="fade-in"
            timeline={{ sceneControlled: false }}
            visibility={{ enterMargin: 300 }}
          >
            <article>Custom margin content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-host="margin-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="margin-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      // bottom 800 > vh(1000) - enterMargin(300) = 700 -> gate not satisfied.
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(readMotionOpacity()).toBe(0);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('falls back to the CineView-level enterMargin when no per-Animate override is set', async () => {
    const originalInnerHeight = window.innerHeight;
    const hostRect = createHostRect(100, 800);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll', scrollEnterMargin: 300 }}>
          <main data-cineview-container="true">
            <Animate
              animateId="global-margin-probe"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false }}
            >
              <article>Global margin content</article>
            </Animate>
          </main>
        </CineViewRuntimeContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-host="global-margin-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="global-margin-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      // global 300px margin -> bottom 800 > 700 -> not entered.
      await new Promise((resolve) => setTimeout(resolve, 120));
      expect(readMotionOpacity()).toBe(0);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('holds an explicitly-animated element at its initial frame while only partially inside the viewport', async () => {
    const originalInnerHeight = window.innerHeight;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    try {
      const { container } = render(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <main data-cineview-container="true">
            <Animate
              animateId="partial-doc-content"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false }}
            >
              <article>Partially visible content</article>
            </Animate>
          </main>
        </CineViewRuntimeContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="partial-doc-content"]')
        ).not.toBeNull();
      });

      const host = container.querySelector(
        '[data-cineview-animate-host="partial-doc-content"]'
      ) as HTMLElement;
      // Bottom (1220) is past the viewport bottom (1000): the element is only
      // partially inside, so under the gate model the enter gate is NOT yet
      // satisfied and it must hold at its initial frame (opacity 0). This is the
      // intended replacement for the old scrub model, which mid-entered it.
      host.getBoundingClientRect = () => createHostRect(820, 1220);
      await flushScroll(container.querySelector('[data-cineview-container="true"]') as HTMLElement);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0');

      // Once fully inside with the 50px bottom gap, the enter gate fires.
      host.getBoundingClientRect = () => createHostRect(300, 700);
      await flushScroll(container.querySelector('[data-cineview-container="true"]') as HTMLElement);

      await waitFor(() => {
        expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '1');
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('reveals an element already scrolled past the top at its entered frame without replaying enter', async () => {
    // First measurement with the element already above the viewport top
    // (bottom <= 0): it must snap to the entered frame (opacity 1), not replay
    // an enter tween from initial.
    const originalInnerHeight = window.innerHeight;
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="above-top-probe"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            timeline={{ sceneControlled: false }}
          >
            <article>Above top content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="above-top-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="above-top-probe"]'
      ) as HTMLElement;
      // Already scrolled past: top -600, bottom -200 (entirely above viewport top).
      host.getBoundingClientRect = () => createHostRect(-600, -200);
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('reveals a first-screen element pinned to the viewport bottom on cold start (within enterMargin)', async () => {
    // First-screen cold reveal: an element authored at the bottom of the first
    // screen (e.g. a scroll hint) sits fully inside the viewport but with its
    // bottom edge within enterMargin of the viewport bottom (relBottom 990 >
    // vh - 50 = 950). The scroll-INTO enter gate is designed for elements
    // climbing up from below and never fires here — and with no scroll yet, no
    // later measure ever re-evaluates it. Pre-fix the element stayed at opacity
    // 0 forever. The first-measurement branch must reveal any element already
    // fully inside the viewport (relTop >= 0 && relBottom <= vh) via a normal
    // enter, bypassing the scroll-into bottom margin.
    const originalInnerHeight = window.innerHeight;
    // Scene 0 semantics: firstSceneEnterReady === true means the first screen has
    // settled its priority assets and may reveal. Non-first scenes leave it
    // undefined and keep the strict scroll-into margins.
    const sceneContext = { ...createScrollSceneContext(), firstSceneEnterReady: true };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="first-screen-bottom-probe"
            enterAnimation="fade-in"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>First screen bottom content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="first-screen-bottom-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="first-screen-bottom-probe"]'
      ) as HTMLElement;
      // Fully inside the viewport, but bottom (990) is within enterMargin (50) of
      // the viewport bottom (1000) → the scroll-into enter gate is NOT satisfied.
      host.getBoundingClientRect = () => createHostRect(900, 990);
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('holds an entered no-exit element at its entered frame when replayOnReenter is false', async () => {
    // No authored exit + replayOnReenter:false: once entered, leaving the top
    // must NOT reset to initial — it holds at the entered frame.
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700);
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    const renderAt = (rerender: (ui: JSX.Element) => void, progress: number): void => {
      rerender(
        <SceneContext.Provider value={{ ...sceneContext, scrollProgress: progress }}>
          <Animate
            animateId="no-exit-hold-probe"
            enterAnimation="fade-in"
            visibility={{ replayOnReenter: false }}
            timeline={{ sceneControlled: false }}
          >
            <article>No exit hold content</article>
          </Animate>
        </SceneContext.Provider>
      );
    };

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="no-exit-hold-probe"
            enterAnimation="fade-in"
            visibility={{ replayOnReenter: false }}
            timeline={{ sceneControlled: false }}
          >
            <article>No exit hold content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="no-exit-hold-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="no-exit-hold-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // Leave the top (top edge crosses above the viewport top → relTop < 0).
      // With no exit and replayOnReenter:false, it must stay at the entered frame,
      // not reset to 0.
      hostRect = createHostRect(-60, 340);
      renderAt(rerender, 1);
      await flushScroll(window);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(readMotionOpacity()).toBe(1);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('keeps a no-exit element visible on leave even when replayOnReenter is true', async () => {
    // No authored exitAnimation: the element must stay at its entered frame
    // (opacity 1) when it leaves the top, regardless of replayOnReenter. Without
    // an exit animation there is no exit — "no exit => stay visible". (Previously
    // replayOnReenter:true reset it to opacity 0, which read as a snap-disappear.)
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700);
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    const renderAt = (rerender: (ui: JSX.Element) => void, progress: number): void => {
      rerender(
        <SceneContext.Provider value={{ ...sceneContext, scrollProgress: progress }}>
          <Animate
            animateId="no-exit-replay-probe"
            enterAnimation="fade-in"
            timeline={{ sceneControlled: false }}
          >
            <article>No exit replay content</article>
          </Animate>
        </SceneContext.Provider>
      );
    };

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="no-exit-replay-probe"
            enterAnimation="fade-in"
            timeline={{ sceneControlled: false }}
          >
            <article>No exit replay content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="no-exit-replay-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="no-exit-replay-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // Leave the top (top edge crosses above the viewport top → relTop < 0). With
      // no exitAnimation the element holds at its entered frame (opacity 1) — it
      // does NOT snap to hidden, regardless of replayOnReenter.
      hostRect = createHostRect(-60, 340);
      renderAt(rerender, 1);
      await flushScroll(window);

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(readMotionOpacity()).toBe(1);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('gates visibility-driven content through idle -> enter -> hold -> exit -> re-enter (no scrub map)', async () => {
    // Gate model (vh=1000, default margins 50): enter when fully inside with a
    // 50px bottom gap (relTop>=0 && relBottom<=950); exit when the top reaches
    // within 50px of the top (relTop<=50). Enter/exit play as time tweens, so we
    // assert terminal frames + the no-flash invariant (exit never passes through
    // the initial frame), NOT a position->opacity scrub midpoint.
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(1000, 1400);
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    const renderAt = async (
      rerender: (ui: JSX.Element) => void,
      progress: number
    ): Promise<void> => {
      rerender(
        <SceneContext.Provider value={{ ...sceneContext, scrollProgress: progress }}>
          <Animate
            animateId="handoff-doc-content"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            timeline={{ sceneControlled: false }}
          >
            <article>Handoff content</article>
          </Animate>
        </SceneContext.Provider>
      );
      await flushScroll(window);
    };

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="handoff-doc-content"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            timeline={{ sceneControlled: false }}
          >
            <article>Handoff content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="handoff-doc-content"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="handoff-doc-content"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;

      // idle: below the viewport -> rests at the initial frame.
      await flushScroll(window);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(0);
      });

      // enter gate satisfied (fully inside, 50px bottom gap) -> tween to entered.
      hostRect = createHostRect(300, 700);
      await renderAt(rerender, 1);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // hold: still inside, top not yet at the exit margin -> stays entered.
      hostRect = createHostRect(100, 500);
      await renderAt(rerender, 2);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // exit gate satisfied (top within 50px of the top) -> tween to the exit
      // frame (fade-out -> 0). The exit must not flash the initial frame first.
      hostRect = createHostRect(-50, 350);
      await renderAt(rerender, 3);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(0);
      });

      // re-enter from below (replayOnReenter default true) -> tween back to 1.
      hostRect = createHostRect(1000, 1400);
      await renderAt(rerender, 4);
      hostRect = createHostRect(300, 700);
      await renderAt(rerender, 5);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('uses the exit variant while visibility-driven content leaves the top instead of resetting to initial', async () => {
    // Gate model: after the element enters (y → 0%, animate frame), crossing the
    // exit gate (top within exitMargin of the viewport top) plays the EXIT
    // variant (slide-up exits to y -100%). The motion must land on the exit
    // target (-100%), never snap back through the initial frame (100%).
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700); // fully inside → enter gate
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="visibility-exit-variant-probe"
            enterAnimation="slide-up"
            exitAnimation="slide-up"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="visibility-exit-variant-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="visibility-exit-variant-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;

      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 1,
          }}
        >
          <Animate
            animateId="visibility-exit-variant-probe"
            enterAnimation="slide-up"
            exitAnimation="slide-up"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      // Enter tween settles on the animate frame.
      await waitFor(() => {
        expect(readMotionY()).toBe('0%');
      });

      // Element scrolls up past the exit gate (top ≤ exitMargin).
      hostRect = createHostRect(-400, 0);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 2,
          }}
        >
          <Animate
            animateId="visibility-exit-variant-probe"
            enterAnimation="slide-up"
            exitAnimation="slide-up"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      // Exit tween lands on the exit variant target, never the initial frame.
      await waitFor(() => {
        expect(readMotionY()).toBe('-100%');
      });
      expect(readMotionY()).not.toBe('100%');
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('plays the exit when an entered element leaves via the BOTTOM on reverse scroll', async () => {
    // Symmetric exit: after entering, scrolling back UP pushes the element down
    // until its bottom edge re-approaches the viewport bottom (relBottom >= vh -
    // exitMargin). That must fire the exit, mirroring the top-edge exit on
    // forward scroll. The pre-fix top-only gate (relTop <= exitMargin) never
    // fired here, so the element held its entered frame (opacity 1) forever.
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700); // fully inside → enter gate
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    const renderAt = (rerender: (ui: JSX.Element) => void, progress: number): void => {
      rerender(
        <SceneContext.Provider value={{ ...sceneContext, scrollProgress: progress }}>
          <Animate
            animateId="reverse-bottom-exit-probe"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Reverse bottom exit content</article>
          </Animate>
        </SceneContext.Provider>
      );
    };

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="reverse-bottom-exit-probe"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Reverse bottom exit content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="reverse-bottom-exit-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="reverse-bottom-exit-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;

      // Enter: fully inside with the 50px bottom gap.
      await flushScroll(window);
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      // Reverse scroll pushes the element down: bottom edge within exitMargin of
      // the viewport bottom (relBottom 960 >= 1000 - 50). The bottom exit gate
      // fires and the element fades out.
      hostRect = createHostRect(560, 960);
      renderAt(rerender, 1);
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(0);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('keeps visibility-driven infinite motion running after enter until exit begins', async () => {
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700);
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="visibility-infinite-exit"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            timeline={{ sceneControlled: false }}
          >
            <article>Visibility infinite content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="visibility-infinite-exit"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="visibility-infinite-exit"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      await waitFor(() => {
        expect(
          animationControlsRegistry.some((controls) =>
            controls.start.mock.calls.some(([payload]) =>
              expect
                .objectContaining({
                  opacity: expect.anything(),
                  transition: expect.objectContaining({ repeat: Infinity }),
                })
                .asymmetricMatch(payload)
            )
          )
        ).toBe(true);
      });

      hostRect = createHostRect(-50, 350);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 1,
          }}
        >
          <Animate
            animateId="visibility-infinite-exit"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            infiniteAnimation="pulse"
            timeline={{ sceneControlled: false }}
          >
            <article>Visibility infinite content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(readMotionOpacity()).toBeGreaterThan(0);
        expect(readMotionOpacity()).toBeLessThan(1);
        expect(
          animationControlsRegistry.some((controls) => controls.stop.mock.calls.length > 0)
        ).toBe(true);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('holds a visibility waitFor follower at its initial frame until the leader actually enters', async () => {
    // New waitFor model (visibility): the follower's gate can be satisfied, but
    // it must NOT play until its leader publishes 'entered' on the per-scene bus.
    // Here the leader never enters, so the follower stays at its initial frame
    // (opacity 0) even though its own gate is satisfied and its own delay is tiny.
    const originalInnerHeight = window.innerHeight;
    const hostRect = createHostRect(300, 700); // fully inside, enter gate satisfied
    const bus = createPhaseBus();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...bus };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="waitfor-visibility-probe"
            enterAnimation="fade-in"
            delay={40}
            waitFor="leader"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false }}
          >
            <article>WaitFor visibility content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="waitfor-visibility-probe"]')
        ).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="waitfor-visibility-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;

      rerender(
        <SceneContext.Provider
          value={{ ...sceneContext, scrollDirection: 'forward', scrollProgress: 1 }}
        >
          <Animate
            animateId="waitfor-visibility-probe"
            enterAnimation="fade-in"
            delay={40}
            waitFor="leader"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false }}
          >
            <article>WaitFor visibility content</article>
          </Animate>
        </SceneContext.Provider>
      );

      // Gate satisfied but the leader has never entered → the follower is pinned
      // at its initial frame across the polling window.
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(readMotionOpacity()).toBe(0);
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('lets a visibility waitFor follower play after only its own delay when the leader already entered (no chain double-count)', async () => {
    // The bug: calculatedDelay is the shared-clock chain offset
    // (leader.delay + leader.duration + own.delay). On the visibility gate each
    // element runs its own clock, so re-using calculatedDelay after the
    // follower's gate fires re-waits the whole leader chain a second time. The
    // fix: once the leader is entered, the follower waits only its OWN delay.
    // Here the leader entered long ago; a follower with a huge nominal chain but
    // tiny own delay must enter promptly (well under any chain-length timeout).
    const originalInnerHeight = window.innerHeight;
    const hostRect = createHostRect(300, 700);
    const bus = createPhaseBus();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...bus };
    // Leader already completed its enter before the follower ever scrolls in.
    bus.markAnimateEntered('leader', true);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="late-follower"
            enterAnimation="fade-in"
            delay={20}
            waitFor="leader"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Late follower content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('[data-cineview-animate-id="late-follower"]')).not.toBeNull();
      });

      const host = document.querySelector(
        '[data-cineview-animate-host="late-follower"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);

      // Leader already entered → only the 20ms own-delay + 60ms tween, not any
      // re-waited chain. Enters well within this window.
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('keeps same-screen visibility waitFor order: the follower plays only after the leader completes', async () => {
    // Cold-start cascade (all gates fire together): the follower subscribes to
    // the leader on the bus and must not enter until the leader publishes
    // 'entered'. Order is preserved without re-deriving calculatedDelay.
    const originalInnerHeight = window.innerHeight;
    const leaderRect = createHostRect(200, 400);
    const followerRect = createHostRect(420, 620);
    const bus = createPhaseBus();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...bus };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="cascade-leader"
            enterAnimation="fade-in"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Cascade leader</article>
          </Animate>
          <Animate
            animateId="cascade-follower"
            enterAnimation="fade-in"
            waitFor="cascade-leader"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Cascade follower</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="cascade-follower"]')
        ).not.toBeNull();
      });

      const leaderHost = document.querySelector(
        '[data-cineview-animate-host="cascade-leader"]'
      ) as HTMLElement;
      const followerHost = document.querySelector(
        '[data-cineview-animate-host="cascade-follower"]'
      ) as HTMLElement;
      leaderHost.getBoundingClientRect = () => leaderRect;
      followerHost.getBoundingClientRect = () => followerRect;

      const readOpacityFor = (id: string): number => {
        const node = screen
          .getAllByTestId('motion-div')
          .find((n) => n.getAttribute('data-cineview-animate-id') === id);
        return Number(node?.getAttribute('data-opacity') ?? '0');
      };

      await flushScroll(window);

      // Both gates fire together, but the follower is still subscribed to the
      // leader: it stays at 0 until the leader finishes, then plays.
      await waitFor(() => {
        expect(readOpacityFor('cascade-leader')).toBe(1);
      });
      await waitFor(() => {
        expect(readOpacityFor('cascade-follower')).toBe(1);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('resolves phase boundaries from the shared takeover budget', async () => {
    const sceneContext = createScrollSceneContext();
    const initialRuntime = createZoneRuntime(300, 1);

    const { rerender } = render(
      <SceneContext.Provider value={sceneContext}>
        <ScrollZoneProviders runtime={initialRuntime}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="phased-probe"
              enterAnimation="fade-in"
              timeline={{
                phase: {
                  start: 0.5,
                  end: 1,
                },
              }}
            >
              <div>Phased probe</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0.5');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 1 }}>
        <ScrollZoneProviders runtime={createZoneRuntime(200, 2)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="phased-probe"
              enterAnimation="fade-in"
              timeline={{
                phase: {
                  start: 0.5,
                  end: 1,
                },
              }}
            >
              <div>Phased probe</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 2 }}>
        <ScrollZoneProviders runtime={createZoneRuntime(400, 3)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="phased-probe"
              enterAnimation="fade-in"
              timeline={{
                phase: {
                  start: 0.5,
                  end: 1,
                },
              }}
            >
              <div>Phased probe</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '1');
    });
  });

  it('drives phased scroll opacity back down when progress reverses after completing enter', async () => {
    const { rerenderAt } = renderReplayPhaseProbe(150, {
      scrollDirection: 'forward',
      scrollProgress: 1,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBe(1);
    });

    rerenderAt(100, 2, {
      scrollDirection: 'backward',
      scrollProgress: 2,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBeCloseTo(0.5, 5);
    });
  });

  it('permits phased scroll exit content to re-enter after leaving and returning', async () => {
    const { rerenderAt } = renderReplayPhaseProbe(175, {
      scrollDirection: 'forward',
      scrollProgress: 1,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBeCloseTo(0.5, 5);
    });

    rerenderAt(200, 2, {
      scrollDirection: 'forward',
      scrollProgress: 2,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBe(0);
    });

    rerenderAt(100, 3, {
      scrollDirection: 'backward',
      scrollProgress: 3,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBeCloseTo(0.5, 5);
    });
  });

  it('re-triggers phased scroll enter on a second pass instead of sticking at completed opacity', async () => {
    const { rerenderAt } = renderReplayPhaseProbe(150, {
      scrollDirection: 'forward',
      scrollProgress: 1,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBe(1);
    });

    rerenderAt(0, 2, {
      scrollDirection: 'backward',
      scrollProgress: 2,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBe(0);
    });

    rerenderAt(100, 3, {
      scrollDirection: 'forward',
      scrollProgress: 3,
    });

    await waitFor(() => {
      expect(readMotionOpacity()).toBeCloseTo(0.5, 5);
    });
  });

  it('lets later phased siblings advance when the shared scroll budget has already crossed their phase window', async () => {
    const sceneContext = createScrollSceneContext();

    render(
      <SceneContext.Provider value={sceneContext}>
        <ScrollZoneProviders runtime={createSharedPhaseRuntime(900, 1)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="scenarios-left"
              enterAnimation="slide-right"
              timeline={{ phase: { start: 0.18, end: 0.64 } }}
            >
              <div>Left</div>
            </Animate>
            <Animate
              animateId="scenarios-center"
              enterAnimation="focus-in"
              timeline={{ phase: { start: 0.28, end: 0.82 } }}
            >
              <div>Center</div>
            </Animate>
            <Animate
              animateId="scenarios-right"
              enterAnimation="slide-left"
              timeline={{ phase: { start: 0.44, end: 1 } }}
            >
              <div>Right</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      const opacityById = Array.from(
        document.querySelectorAll('[data-cineview-animate-id]')
      ).reduce<Record<string, string>>((accumulator, node) => {
        const id = node.getAttribute('data-cineview-animate-id');
        const opacity = node.getAttribute('data-opacity');
        if (id && opacity) {
          accumulator[id] = opacity;
        }
        return accumulator;
      }, {});

      expect(Number(opacityById['scenarios-left'])).toBe(1);
      expect(Number(opacityById['scenarios-center'])).toBeCloseTo(
        (900 - 1400 * 0.28) / (1400 * (0.82 - 0.28)),
        5
      );
      expect(Number(opacityById['scenarios-right'])).toBeCloseTo(
        (900 - 1400 * 0.44) / (1400 * (1 - 0.44)),
        5
      );
    });
  });
});
