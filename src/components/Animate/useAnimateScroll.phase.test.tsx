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
                driver: 'scroll',
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
          timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
              timeline={{ driver: 'visibility' }}
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
              timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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
            timeline={{ driver: 'visibility' }}
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

  it('holds the enter tween at the initial frame while the waitFor-derived delay is pending', async () => {
    // Gate model: a satisfied enter gate launches the enter tween, but a
    // waitFor dependency defers the tween launch by the registry-calculated
    // delay (here 5000ms). Within that window the element stays at its initial
    // frame (opacity 0) even though its gate is already satisfied — proving the
    // delay gates the TIME-based tween, not a position scrub.
    const originalInnerHeight = window.innerHeight;
    const hostRect = createHostRect(300, 700); // fully inside, enter gate satisfied
    const sceneContext = createScrollSceneContext();
    sceneContext.getCalculatedDelay = jest.fn(() => 5000);

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="waitfor-visibility-probe"
            enterAnimation="fade-in"
            delay={120}
            waitFor="leader"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ driver: 'visibility' }}
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
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 1,
          }}
        >
          <Animate
            animateId="waitfor-visibility-probe"
            enterAnimation="fade-in"
            delay={120}
            waitFor="leader"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ driver: 'visibility' }}
          >
            <article>WaitFor visibility content</article>
          </Animate>
        </SceneContext.Provider>
      );

      // The enter tween is deferred 5000ms by the waitFor delay, so the element
      // stays at its initial frame across this polling window.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(readMotionOpacity()).toBe(0);
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
                driver: 'scroll',
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
                driver: 'scroll',
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
                driver: 'scroll',
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
