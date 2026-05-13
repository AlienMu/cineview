import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import { ScrollZoneRuntimeContext, ScrollZoneContext } from '../ScrollZone';
import type { ScrollZoneRuntimeContextValue } from '../ScrollZone';

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
      }): JSX.Element => (
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

describe('useAnimateScroll orphan warning', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  function createScrollSceneContext(): SceneContextType {
    return {
      mode: 'scroll',
      isActive: true,
      isVisible: true,
      visibilityProgress: 1,
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
    };
  }

  it('points orphan scroll-driven animations to ScrollZone as the primary API', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <Animate animateId="scroll-orphan" enterAnimation="fade-in" scrollDriven={true}>
          <div>Scroll orphan</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CineView Warning] scroll-driven Animate "scroll-orphan" must be wrapped by <ScrollZone>.'
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('treats timeline.driver="scroll" as the grouped replacement for scrollDriven', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <Animate
          animateId="timeline-scroll"
          enterAnimation="fade-in"
          timeline={{ driver: 'scroll' }}
        >
          <div>Timeline scroll orphan</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CineView Warning] scroll-driven Animate "timeline-scroll" must be wrapped by <ScrollZone>.'
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('registers grouped timeline and duration fields with the zone runtime', async () => {
    const zoneRuntime: ScrollZoneRuntimeContextValue = {
      version: 1,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ScrollZoneRuntimeContext.Provider value={zoneRuntime}>
          <ScrollZoneContext.Provider value="zone-1">
            <Animate
              animateId="timeline-registration"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 320, exit: 180 }}
              timeline={{
                driver: 'scroll',
                delay: 90,
                waitFor: 'intro',
              }}
              enterDuration={999}
              exitDuration={888}
              delay={777}
              waitFor="legacy"
            >
              <div>Timeline registration</div>
            </Animate>
          </ScrollZoneContext.Provider>
        </ScrollZoneRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(zoneRuntime.registerZoneAnimation).toHaveBeenCalledWith('zone-1', {
        animateId: 'timeline-registration',
        delay: 90,
        enterDuration: 320,
        exitDuration: 180,
        waitFor: 'intro',
      });
    });
  });

  it('keeps omitted timeline.driver out of the scroll budget by default', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const zoneRuntime: ScrollZoneRuntimeContextValue = {
      version: 1,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <ScrollZoneRuntimeContext.Provider value={zoneRuntime}>
          <ScrollZoneContext.Provider value="zone-1">
            <Animate animateId="default-auto" enterAnimation="fade-in">
              <div>Default auto</div>
            </Animate>
          </ScrollZoneContext.Provider>
        </ScrollZoneRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(zoneRuntime.registerZoneAnimation).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    consoleWarnSpy.mockRestore();
  });

  it('prefers grouped timeline.driver="visibility" over legacy scrollDriven={true}', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <Animate
          animateId="visibility-driver"
          enterAnimation="fade-in"
          timeline={{ driver: 'visibility' }}
          visibility={{ replayOnReenter: false }}
          scrollDriven={true}
        >
          <div>Visibility driver</div>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    consoleWarnSpy.mockRestore();
  });
});
