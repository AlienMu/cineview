import { fireEvent, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import { SceneScrollRuntimeContext, SceneScrollTakeoverContext } from '../Scene/sceneScrollRuntime';
import type { SceneScrollRuntimeContextValue } from '../Scene/sceneScrollRuntime';
import { CineViewRuntimeContext } from '../CineView/runtimeContext';

jest.mock('framer-motion', () => {
  const actualMotion = jest.requireActual('framer-motion');
  const React = jest.requireActual('react');

  const isMotionValue = (
    value: unknown
  ): value is {
    get: () => unknown;
    on: (event: string, listener: () => void) => () => void;
  } =>
    Boolean(
      value &&
      typeof value === 'object' &&
      'get' in value &&
      typeof value.get === 'function' &&
      'on' in value &&
      typeof value.on === 'function'
    );

  return {
    ...actualMotion,
    motion: {
      div: ({
        children,
        style,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        style?: React.CSSProperties;
      }): JSX.Element => {
        const [, forceRender] = React.useState(0);

        React.useEffect(() => {
          const unsubscribes = Object.values(style ?? {})
            .filter(isMotionValue)
            .map((value) =>
              value.on('change', () => {
                queueMicrotask(() => {
                  forceRender((count: number) => count + 1);
                });
              })
            );

          return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
          };
        }, [style]);

        const resolvedStyle = Object.fromEntries(
          Object.entries(style ?? {}).map(([key, value]) => [
            key,
            isMotionValue(value) ? value.get() : value,
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
      },
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
    // Gate-model test double: immediately settle the MotionValue to its target
    // and fire onComplete, so the enter/exit gate transition is observable
    // without driving a real frameloop.
    animate: jest.fn(
      (
        value: { set: (v: number) => void },
        target: number,
        options?: { onComplete?: () => void }
      ) => {
        value.set(target);
        queueMicrotask(() => options?.onComplete?.());
        return { stop: jest.fn() };
      }
    ),
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

  function screenOpacity(animateId: string): string {
    return (
      document
        .querySelector(`[data-cineview-animate-id="${animateId}"]`)
        ?.getAttribute('data-opacity') ?? ''
    );
  }

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

  it('runs ordinary document Animate as visibility-driven in scroll mode without a Scene', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const originalInnerHeight = window.innerHeight;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    try {
      render(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <article>
            <Animate animateId="doc-animate" enterAnimation="fade-in">
              <div>Document animate</div>
            </Animate>
          </article>
        </CineViewRuntimeContext.Provider>
      );

      const host = await waitFor(() => {
        const node = document.querySelector('[data-cineview-animate-host="doc-animate"]');
        expect(node).not.toBeNull();
        return node as HTMLElement;
      });
      host.getBoundingClientRect = () =>
        ({
          top: 200,
          bottom: 600,
          left: 0,
          right: 100,
          width: 100,
          height: 400,
          x: 0,
          y: 200,
          toJSON: () => undefined,
        }) as DOMRect;
      fireEvent.scroll(window);

      await waitFor(() => {
        expect(screenOpacity('doc-animate')).toBe('1');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
      consoleWarnSpy.mockRestore();
    }
  });

  it('starts ordinary document Animate after real scroll brings it into the viewport', async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const originalInnerHeight = window.innerHeight;
    let isInViewport = false;

    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 1000,
    });

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
      if (this.getAttribute('data-cineview-animate-host') === 'doc-scroll-animate') {
        return {
          top: isInViewport ? 200 : 1100,
          bottom: isInViewport ? 600 : 1500,
          left: 0,
          right: 100,
          width: 100,
          height: 400,
          x: 0,
          y: isInViewport ? 200 : 1100,
          toJSON: () => undefined,
        } as DOMRect;
      }

      if (this.getAttribute('data-cineview-animate-id') === 'doc-scroll-animate') {
        return {
          top: isInViewport ? 200 : 1100,
          bottom: isInViewport ? 200 : 1100,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: isInViewport ? 200 : 1100,
          toJSON: () => undefined,
        } as DOMRect;
      }

      return originalGetBoundingClientRect.call(this);
    };

    try {
      const { container } = render(
        <CineViewRuntimeContext.Provider value={{ mode: 'scroll' }}>
          <main data-cineview-container="true">
            <Animate animateId="doc-scroll-animate" enterAnimation="fade-in">
              <div>Document scroll animate</div>
            </Animate>
          </main>
        </CineViewRuntimeContext.Provider>
      );

      await waitFor(() => {
        expect(
          container.querySelector('[data-cineview-animate-id="doc-scroll-animate"]')
        ).not.toBeNull();
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screenOpacity('doc-scroll-animate')).toBe('0');

      isInViewport = true;
      container
        .querySelector('[data-cineview-container="true"]')
        ?.dispatchEvent(new Event('scroll'));

      await waitFor(() => {
        expect(screenOpacity('doc-scroll-animate')).toBe('1');
      });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('registers grouped timeline and duration fields with the zone runtime', async () => {
    const zoneRuntime: SceneScrollRuntimeContextValue = {
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="timeline-registration"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 320, exit: 180 }}
              timeline={{
                delay: 90,
                waitFor: 'intro',
              }}
            >
              <div>Timeline registration</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
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

  it('does not re-register scroll budgets when only runtime state/version changes', async () => {
    const registerZoneAnimation = jest.fn();
    const unregisterZoneAnimation = jest.fn();

    const { rerender } = render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <SceneScrollRuntimeContext.Provider
          value={{
            registerZone: jest.fn(),
            unregisterZone: jest.fn(),
            setZoneElement: jest.fn(),
            registerZoneAnimation,
            unregisterZoneAnimation,
          }}
        >
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="stable-registration"
              enterAnimation="fade-in"
              duration={{ enter: 320, exit: 180 }}
              timeline={{ delay: 90, waitFor: 'intro' }}
            >
              <div>Stable registration</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(registerZoneAnimation).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <SceneScrollRuntimeContext.Provider
          value={{
            registerZone: jest.fn(),
            unregisterZone: jest.fn(),
            setZoneElement: jest.fn(),
            registerZoneAnimation,
            unregisterZoneAnimation,
          }}
        >
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="stable-registration"
              enterAnimation="fade-in"
              duration={{ enter: 320, exit: 180 }}
              timeline={{ delay: 90, waitFor: 'intro' }}
            >
              <div>Stable registration</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    expect(registerZoneAnimation).toHaveBeenCalledTimes(1);
    expect(unregisterZoneAnimation).not.toHaveBeenCalled();
  });

  it('defaults omitted timeline.driver to the takeover scroll budget inside a scroll Scene', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const zoneRuntime: SceneScrollRuntimeContextValue = {
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate animateId="default-auto" enterAnimation="fade-in">
              <div>Default auto</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(zoneRuntime.registerZoneAnimation).toHaveBeenCalledWith('zone-1', {
        animateId: 'default-auto',
        delay: 0,
        enterDuration: 600,
        exitDuration: 0,
        waitFor: undefined,
      });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    consoleWarnSpy.mockRestore();
  });

  it('lets explicit visibility semantics opt out of takeover scroll registration', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const zoneRuntime: SceneScrollRuntimeContextValue = {
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneContext.Provider value={createScrollSceneContext()}>
        <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate
              animateId="visibility-driver"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false }}
              visibility={{ replayOnReenter: false }}
            >
              <div>Visibility driver</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </SceneScrollRuntimeContext.Provider>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(zoneRuntime.registerZoneAnimation).not.toHaveBeenCalled();
    });

    consoleWarnSpy.mockRestore();
  });
});
