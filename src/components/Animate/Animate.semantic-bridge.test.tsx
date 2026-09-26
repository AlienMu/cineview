import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import { SceneScrollRuntimeContext, SceneScrollTakeoverContext } from '../Scene/sceneScrollRuntime';

jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  return {
    ...actualMotion,
    motion: {
      div: ({
        children,
        style,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        style?: React.CSSProperties;
      }): React.JSX.Element => (
        <div data-testid="motion-div" {...props} style={style}>
          {children}
        </div>
      ),
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

function createSceneContext(overrides?: Partial<SceneContextType>): SceneContextType {
  const createMotionValueStub = (initialValue = 0) =>
    ({
      get: () => initialValue,
      set: jest.fn(),
      on: jest.fn(() => jest.fn()),
    }) as never;

  return {
    mode: 'drag',
    isActive: true,
    isDragging: false,
    dragProgressMotion: createMotionValueStub(),
    sharedElapsedMotion: createMotionValueStub(),
    sceneState: 'active',
    sceneOffset: 0,
    sceneTransitionDuration: 800,
    registerAnimate: jest.fn(),
    unregisterAnimate: jest.fn(),
    getCalculatedDelay: jest.fn(() => 0),
    getTimelineDuration: jest.fn(() => 800),
    enterDuration: 600,
    ...overrides,
  };
}

describe('Animate grouped semantics', () => {
  it('registers and cleans up in its owning Scene even if JavaScript supplies a stale zone override', async () => {
    const sceneContext = createSceneContext({ mode: 'scroll' });
    const runtime = {
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn((_zone, registration) => registration),
      unregisterZoneAnimation: jest.fn(),
    };
    const staleTimeline = { delay: 10, zoneId: 'foreign-zone' };
    const { unmount } = render(
      <SceneContext.Provider value={sceneContext}>
        <SceneScrollRuntimeContext.Provider value={runtime}>
          <SceneScrollTakeoverContext.Provider value="owning-zone">
            <Animate animateId="owned" enterAnimation="fade-in" timeline={staleTimeline}>
              <div>Owned animation</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );
    await waitFor(() =>
      expect(runtime.registerZoneAnimation).toHaveBeenCalledWith(
        'owning-zone',
        expect.objectContaining({ animateId: 'owned', delay: 10 })
      )
    );
    expect(runtime.registerZoneAnimation.mock.calls.every(([zone]) => zone === 'owning-zone')).toBe(
      true
    );
    const results = runtime.registerZoneAnimation.mock.results;
    const registration = results[results.length - 1]?.value;
    unmount();
    expect(runtime.unregisterZoneAnimation).toHaveBeenCalledWith(
      'owning-zone',
      'owned',
      registration
    );
  });

  it('registers grouped duration and timeline props in drag mode', async () => {
    const sceneContext = createSceneContext({ mode: 'drag' });

    render(
      <SceneContext.Provider value={sceneContext}>
        <Animate
          animateId="grouped-priority"
          enterAnimation="fade-in"
          duration={{ enter: 420 }}
          timeline={{ delay: 110, after: 'grouped-anchor' }}
        >
          <div>Grouped priority</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(sceneContext.registerAnimate).toHaveBeenCalledWith('grouped-priority', {
        delay: 110,
        duration: 420,
        after: 'grouped-anchor',
        lane: 'drag',
      });
    });
  });

  it('keeps grouped orchestration stable with an explicit drag timeline', async () => {
    const sceneContext = createSceneContext({
      mode: 'drag',
      dragTimelineProgress: 0,
      renderProgress: 0,
      sharedTimelineDurationMs: 800,
    });

    render(
      <SceneContext.Provider value={sceneContext}>
        <Animate
          animateId="grouped-drag-priority"
          enterAnimation="fade-in"
          duration={{ enter: 360 }}
          timeline={{ delay: 95, after: 'drag-grouped-anchor' }}
        >
          <div>Grouped drag priority</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(sceneContext.registerAnimate).toHaveBeenCalledWith('grouped-drag-priority', {
        delay: 95,
        duration: 360,
        after: 'drag-grouped-anchor',
        lane: 'drag',
      });
    });
  });
});
