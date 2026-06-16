import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import { SceneScrollRuntimeContext, SceneScrollTakeoverContext } from '../Scene/sceneScrollRuntime';
import type { SceneScrollRuntimeContextValue, SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
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

function createZoneRuntime(progressPx: number, version: number): SceneScrollRuntimeContextValue {
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

function createReplayZoneRuntime(
  progressPx: number,
  version: number
): SceneScrollRuntimeContextValue {
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

function createSharedPhaseRuntime(progressPx: number, version: number): SceneScrollRuntimeContextValue {
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
  ): JSX.Element => (
    <SceneContext.Provider value={{ ...sceneContext, ...sceneOverrides }}>
      <SceneScrollRuntimeContext.Provider value={createReplayZoneRuntime(progressPx, version)}>
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
      </SceneScrollRuntimeContext.Provider>
    </SceneContext.Provider>
  );

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

    const host = document.querySelector('[data-cineview-animate-host="visibility-probe"]') as HTMLElement;
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
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '1');
    });
  });

  it('keeps ordinary scroll content visually present when it is only partially inside the viewport', async () => {
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
      host.getBoundingClientRect = () => createHostRect(820, 1220);
      fireEvent.scroll(container.querySelector('[data-cineview-container="true"]') as HTMLElement);

      await waitFor(() => {
        expect(screen.getByTestId('motion-div')).not.toHaveAttribute('data-opacity', '0');
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('maps visibility-driven document content through 0 -> 100 -> 200 and back again without snapping off the exit path', async () => {
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(1000, 1400);
    const sceneContext = createScrollSceneContext();

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

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
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(0);
      });

      hostRect = createHostRect(650, 1050);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 1,
          }}
        >
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
        expect(readMotionOpacity()).toBeGreaterThan(0.45);
        expect(readMotionOpacity()).toBeLessThan(0.55);
      });

      hostRect = createHostRect(300, 700);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 2,
          }}
        >
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
        expect(readMotionOpacity()).toBe(1);
      });

      hostRect = createHostRect(-50, 350);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 3,
          }}
        >
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
        expect(readMotionOpacity()).toBeGreaterThan(0.45);
        expect(readMotionOpacity()).toBeLessThan(0.55);
      });

      hostRect = createHostRect(-400, 0);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 4,
          }}
        >
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
        expect(readMotionOpacity()).toBe(0);
      });

      hostRect = createHostRect(-50, 350);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'backward',
            scrollProgress: 5,
          }}
        >
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
        expect(readMotionOpacity()).toBeGreaterThan(0.45);
        expect(readMotionOpacity()).toBeLessThan(0.55);
      });

      hostRect = createHostRect(300, 700);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'backward',
            scrollProgress: 6,
          }}
        >
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
        expect(readMotionOpacity()).toBe(1);
      });

      hostRect = createHostRect(650, 1050);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'backward',
            scrollProgress: 7,
          }}
        >
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
        expect(readMotionOpacity()).toBeGreaterThan(0.45);
        expect(readMotionOpacity()).toBeLessThan(0.55);
      });

      hostRect = createHostRect(1000, 1400);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'backward',
            scrollProgress: 8,
          }}
        >
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
        expect(readMotionOpacity()).toBe(0);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('uses the exit variant while visibility-driven content leaves the top instead of resetting to initial', async () => {
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
            animateId="visibility-exit-variant-probe"
            enterAnimation="slide-up"
            exitAnimation="slide-up"
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
            timeline={{ driver: 'visibility' }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(readMotionY()).toBe('0%');
      });

      hostRect = createHostRect(-50, 350);
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
            timeline={{ driver: 'visibility' }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(readMotionY()).toBe('-50%');
      });

      hostRect = createHostRect(-400, 0);
      rerender(
        <SceneContext.Provider
          value={{
            ...sceneContext,
            scrollDirection: 'forward',
            scrollProgress: 3,
          }}
        >
          <Animate
            animateId="visibility-exit-variant-probe"
            enterAnimation="slide-up"
            exitAnimation="slide-up"
            timeline={{ driver: 'visibility' }}
          >
            <article>Visibility exit variant content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(readMotionY()).toBe('-100%');
        expect(readMotionY()).not.toBe('100%');
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
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
      });

      await waitFor(() => {
        expect(
          animationControlsRegistry.some((controls) =>
            controls.start.mock.calls.some(([payload]) =>
              expect.objectContaining({
                opacity: expect.anything(),
                transition: expect.objectContaining({ repeat: Infinity }),
              }).asymmetricMatch(payload)
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
        expect(animationControlsRegistry.some((controls) => controls.stop.mock.calls.length > 0)).toBe(
          true
        );
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('lets waitFor-derived delay override the default center-complete visibility timing', async () => {
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700);
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
            timeline={{ driver: 'visibility' }}
          >
            <article>WaitFor visibility content</article>
          </Animate>
        </SceneContext.Provider>
      );

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

  it('resolves phase boundaries from the shared takeover budget', async () => {
    const sceneContext = createScrollSceneContext();
    const initialRuntime = createZoneRuntime(300, 1);

    const { rerender } = render(
      <SceneContext.Provider value={sceneContext}>
        <SceneScrollRuntimeContext.Provider value={initialRuntime}>
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
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0.5');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 1 }}>
        <SceneScrollRuntimeContext.Provider value={createZoneRuntime(200, 2)}>
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
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 2 }}>
        <SceneScrollRuntimeContext.Provider value={createZoneRuntime(400, 3)}>
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
        </SceneScrollRuntimeContext.Provider>
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
        <SceneScrollRuntimeContext.Provider value={createSharedPhaseRuntime(900, 1)}>
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
        </SceneScrollRuntimeContext.Provider>
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
