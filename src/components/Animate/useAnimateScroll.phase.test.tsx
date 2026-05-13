import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import { ScrollZoneRuntimeContext, ScrollZoneContext } from '../ScrollZone';
import type { ScrollZoneRuntimeContextValue, ScrollZoneTimelineState } from '../ScrollZone';

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
    motion: {
      div: MotionDiv,
    },
    useAnimation: (): {
      start: jest.Mock;
      set: jest.Mock;
      stop: jest.Mock;
    } => ({
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

function createScrollSceneContext(): SceneContextType {
  return {
    mode: 'scroll',
    isActive: true,
    isVisible: false,
    visibilityProgress: 0,
    isDragging: false,
    dragProgressMotion: { get: () => 0, set: jest.fn() } as never,
    sharedElapsedMotion: { get: () => 0, set: jest.fn() } as never,
    sceneEnterCompleted: true,
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

function createZoneState(progressPx: number): ScrollZoneTimelineState {
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
          totalEndPx: 200,
          hasExit: false,
        },
      },
    },
  };
}

function createZoneRuntime(progressPx: number, version: number): ScrollZoneRuntimeContextValue {
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

describe('useAnimateScroll grouped timeline.phase', () => {
  it('resolves phase boundaries inside the animation local enter budget window', async () => {
    const sceneContext = createScrollSceneContext();
    const initialRuntime = createZoneRuntime(175, 1);

    const { rerender } = render(
      <SceneContext.Provider value={sceneContext}>
        <ScrollZoneRuntimeContext.Provider value={initialRuntime}>
          <ScrollZoneContext.Provider value="zone-1">
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
          </ScrollZoneContext.Provider>
        </ScrollZoneRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0.5');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 1 }}>
        <ScrollZoneRuntimeContext.Provider value={createZoneRuntime(150, 2)}>
          <ScrollZoneContext.Provider value="zone-1">
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
          </ScrollZoneContext.Provider>
        </ScrollZoneRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '0');
    });

    rerender(
      <SceneContext.Provider value={{ ...sceneContext, scrollProgress: 2 }}>
        <ScrollZoneRuntimeContext.Provider value={createZoneRuntime(200, 3)}>
          <ScrollZoneContext.Provider value="zone-1">
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
          </ScrollZoneContext.Provider>
        </ScrollZoneRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('motion-div')).toHaveAttribute('data-opacity', '1');
    });
  });
});
