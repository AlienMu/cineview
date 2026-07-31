import React, { useContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Scene } from './Scene';
import { SceneContext, type SceneContextType } from '../Animate/Animate';
import { SceneScrollRuntimeContext } from '../Scene/sceneScrollRuntime';

jest.mock('framer-motion', () => ({
  __esModule: true,
  motion: {
    div: (() => {
      const React = require('react');
      const isStyleRecord = (
        value: unknown
      ): value is React.CSSProperties & Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);
      const MotionDiv = React.forwardRef(
        (
          {
            children,
            animate,
            initial,
            style,
            onPanStart: _onPanStart,
            onPan: _onPan,
            onPanEnd: _onPanEnd,
            ...props
          }: React.PropsWithChildren<Record<string, unknown>>,
          ref: React.Ref<HTMLDivElement>
        ) => {
          const resolveStyleState = (value: unknown): React.CSSProperties =>
            isStyleRecord(value) ? (value as React.CSSProperties) : {};
          const [animatedStyle, setAnimatedStyle] = React.useState(
            (): React.CSSProperties => resolveStyleState(initial)
          );

          React.useEffect(() => {
            const baseStyle = resolveStyleState(initial);

            if (
              animate &&
              typeof animate === 'object' &&
              'subscribe' in animate &&
              typeof animate.subscribe === 'function' &&
              'getCurrent' in animate &&
              typeof animate.getCurrent === 'function'
            ) {
              setAnimatedStyle({
                ...baseStyle,
                ...resolveStyleState(animate.getCurrent()),
              });

              return animate.subscribe((next: unknown) => {
                setAnimatedStyle({
                  ...baseStyle,
                  ...resolveStyleState(next),
                });
              });
            }

            setAnimatedStyle(baseStyle);
            return undefined;
          }, [animate, initial]);

          return (
            <div
              ref={ref}
              {...props}
              style={{
                ...(isStyleRecord(style) ? (style as React.CSSProperties) : {}),
                ...animatedStyle,
              }}
            >
              {children}
            </div>
          );
        }
      );
      MotionDiv.displayName = 'MotionDiv';
      return MotionDiv;
    })(),
  },
  useAnimation: (() => {
    const React = require('react');
    const isStyleRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);

    return () => {
      const controlsRef: React.MutableRefObject<{
        start: jest.Mock<Promise<void>, [unknown?]>;
        stop: jest.Mock<void, []>;
        set: jest.Mock<void, [unknown?]>;
        subscribe: (listener: (next: unknown) => void) => () => boolean;
        getCurrent: () => Record<string, unknown>;
      } | null> = React.useRef(null);

      if (!controlsRef.current) {
        let currentState: Record<string, unknown> = {};
        const listeners = new Set<(next: unknown) => void>();
        const updateState = (next: unknown): void => {
          if (!isStyleRecord(next)) return;
          currentState = { ...currentState, ...next };
          listeners.forEach((listener) => listener(currentState));
        };

        controlsRef.current = {
          start: jest.fn().mockImplementation(async (next?: unknown) => {
            updateState(next);
          }),
          stop: jest.fn(),
          set: jest.fn().mockImplementation((next?: unknown) => {
            updateState(next);
          }),
          subscribe: (listener: (next: unknown) => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
          getCurrent: () => currentState,
        };
      }

      return controlsRef.current;
    };
  })(),
  useMotionValue: (initial: number) => ({
    get: () => initial,
    set: jest.fn(),
    on: () => () => undefined,
  }),
  animate: () => ({ stop: jest.fn() }),
}));

function RuntimeProbe(): JSX.Element {
  const sceneContext = useContext(SceneContext) as SceneContextType;
  return <div data-testid="runtime-state">{sceneContext.runtimeState}</div>;
}

describe('Scene scroll runtime bridge', () => {
  it('keeps scroll pages valid when a scroll Scene omits takeover config', () => {
    const zoneRuntime = {
      version: 0,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
        <Scene
          sceneId="hero"
          mode="scroll"
          isActive={true}
          sceneIndex={0}
          totalScenes={2}
          currentSceneIndex={0}
        >
          <div>Hero</div>
        </Scene>
      </SceneScrollRuntimeContext.Provider>
    );

    expect(screen.getByText('Hero')).toBeInTheDocument();
    expect(zoneRuntime.registerZone).not.toHaveBeenCalled();
    expect(zoneRuntime.setZoneElement).not.toHaveBeenCalled();
  });

  it('registers a scene-owned scroll takeover zone when grouped scroll config is provided', () => {
    const zoneRuntime = {
      version: 0,
      zoneStates: {},
      registerZone: jest.fn(),
      unregisterZone: jest.fn(),
      setZoneElement: jest.fn(),
      registerZoneAnimation: jest.fn(),
      unregisterZoneAnimation: jest.fn(),
    };

    render(
      <SceneScrollRuntimeContext.Provider value={zoneRuntime}>
        <Scene
          sceneId="hero"
          mode="scroll"
          isActive={true}
          sceneIndex={0}
          totalScenes={2}
          currentSceneIndex={0}
          scroll={{
            zoneId: 'hero-sequence',
            trigger: 'center-lock',
          }}
        >
          <div>Hero</div>
        </Scene>
      </SceneScrollRuntimeContext.Provider>
    );

    expect(zoneRuntime.registerZone).toHaveBeenCalledWith('hero-sequence', {
      sceneIndex: 0,
      trigger: 'center-lock',
    });
    expect(zoneRuntime.setZoneElement).toHaveBeenCalledWith(
      'hero-sequence',
      0,
      expect.any(HTMLDivElement)
    );
  });

  it('marks an incoming scroll scene as entering from runtime direction and progress', () => {
    render(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={0}
        scrollRuntime={{
          progress: 0.4,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: {
            fromScene: 0,
            toScene: 1,
            direction: 'forward',
            progressRatio: 0.4,
            startedAt: 0,
            lastInputAt: 0,
            isSettling: false,
            settleDirection: null,
          },
          backdropActive: false,
        }}
      >
        <RuntimeProbe />
      </Scene>
    );

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('entering');
  });

  it('applies scene-level scroll enter and exit transitions across timeline phases', async () => {
    const timelineState = {
      phase: 'before' as const,
      enterProgress: 0,
      exitProgress: 0,
      sceneProgress: 0,
      rangeStart: 0,
      rangeEnd: 600,
      rangeLength: 600,
      enterLength: 120,
      exitLength: 120,
    };

    const { rerender } = render(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={0}
        transition={{
          enterAnimation: 'fade-in',
          exitAnimation: 'fade-out',
        }}
        scrollRuntime={{
          progress: 0,
          isScrolling: false,
          direction: 'forward',
          transitionSnapshot: null,
          backdropActive: false,
          timelineState,
        }}
      >
        <div>Hero</div>
      </Scene>
    );

    const sceneElement = screen.getByText('Hero').parentElement as HTMLElement;

    await waitFor(() => {
      expect(sceneElement).toHaveStyle({ opacity: '0' });
    });

    rerender(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={0}
        transition={{
          enterAnimation: 'fade-in',
          exitAnimation: 'fade-out',
        }}
        scrollRuntime={{
          progress: 0.4,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: null,
          backdropActive: false,
          timelineState: {
            ...timelineState,
            phase: 'enter',
            enterProgress: 0.4,
          },
        }}
      >
        <div>Hero</div>
      </Scene>
    );

    await waitFor(() => {
      expect(sceneElement).toHaveStyle({ opacity: '0.4' });
    });

    rerender(
      <Scene
        mode="scroll"
        isActive={true}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={1}
        transition={{
          enterAnimation: 'fade-in',
          exitAnimation: 'fade-out',
        }}
        scrollRuntime={{
          progress: 1,
          isScrolling: false,
          direction: 'forward',
          transitionSnapshot: null,
          backdropActive: false,
          timelineState: {
            ...timelineState,
            phase: 'hold',
            enterProgress: 1,
          },
        }}
      >
        <div>Hero</div>
      </Scene>
    );

    await waitFor(() => {
      expect(sceneElement).toHaveStyle({ opacity: '1' });
    });

    rerender(
      <Scene
        mode="scroll"
        isActive={true}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={1}
        transition={{
          enterAnimation: 'fade-in',
          exitAnimation: 'fade-out',
        }}
        scrollRuntime={{
          progress: 0.6,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: null,
          backdropActive: false,
          timelineState: {
            ...timelineState,
            phase: 'exit',
            enterProgress: 1,
            exitProgress: 0.6,
          },
        }}
      >
        <div>Hero</div>
      </Scene>
    );

    await waitFor(() => {
      expect(sceneElement).toHaveStyle({ opacity: '0.4' });
    });

    rerender(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={1}
        totalScenes={3}
        currentSceneIndex={2}
        transition={{
          enterAnimation: 'fade-in',
          exitAnimation: 'fade-out',
        }}
        scrollRuntime={{
          progress: 1,
          isScrolling: false,
          direction: 'forward',
          transitionSnapshot: null,
          backdropActive: false,
          timelineState: {
            ...timelineState,
            phase: 'after',
            enterProgress: 1,
            exitProgress: 1,
          },
        }}
      >
        <div>Hero</div>
      </Scene>
    );

    await waitFor(() => {
      expect(sceneElement).toHaveStyle({ opacity: '0' });
    });
  });

  it('keeps a covered scroll backdrop scene out of pointer interaction', () => {
    const { container } = render(
      <Scene
        mode="scroll"
        isActive={false}
        sceneIndex={0}
        totalScenes={3}
        currentSceneIndex={1}
        stack={{ mode: 'cover' }}
        scrollRuntime={{
          progress: 0.5,
          isScrolling: true,
          direction: 'forward',
          transitionSnapshot: {
            fromScene: 1,
            toScene: 2,
            direction: 'forward',
            progressRatio: 0.5,
            startedAt: 0,
            lastInputAt: 0,
            isSettling: false,
            settleDirection: null,
          },
          backdropActive: true,
        }}
      >
        <RuntimeProbe />
      </Scene>
    );

    expect(screen.getByTestId('runtime-state')).toHaveTextContent('covered');
    expect(container.firstElementChild).toHaveStyle({ pointerEvents: 'none' });
  });
});
