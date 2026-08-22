import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useLayoutEffect, useRef, type ReactNode } from 'react';
import '@testing-library/jest-dom';
import { Animate, SceneContext, type SceneContextType } from './Animate';
import {
  SceneScrollRuntimeContext,
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
} from '../Scene/sceneScrollRuntime';
import type { SceneScrollZoneRuntime, SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import type { SceneScrollAnimationRegistration } from '../Scene/sceneScrollBudget';
import { CineViewRuntimeContext } from '../runtime/runtimeContext';
import { useScrollZoneRegistry } from '../CineView/useScrollZoneRegistry';
import {
  useSceneAnimationRegistry,
  type SceneAnimationRegistrationLease,
  type WaitForOutcome,
} from '../Scene/useSceneAnimationRegistry';

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

function ProductionRegistrySceneProvider({
  children,
  reportError,
}: {
  children: ReactNode;
  reportError?: jest.Mock;
}): JSX.Element {
  const registry = useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 800, reportError });
  return (
    <SceneContext.Provider value={{ ...createScrollSceneContext(), ...registry }}>
      {children}
    </SceneContext.Provider>
  );
}

// Lightweight lease registry for timing-focused tests. Production integration
// cases below use useSceneAnimationRegistry directly; this harness only supplies
// owner/generation leases and targeted completion notifications.
function createLeaseHarness(): {
  context: Pick<SceneContextType, 'registerAnimate'>;
  complete: (id: string) => void;
  publishSpy: jest.Mock;
  subscriberCount: () => number;
} {
  let generation = 0;
  const completed = new Set<string>();
  const generations = new Map<string, number>();
  const subscribers = new Map<string, Set<(outcome: WaitForOutcome) => void>>();
  const publishSpy = jest.fn();

  const complete = (id: string): void => {
    if (completed.has(id)) return;
    completed.add(id);
    const listeners = subscribers.get(id);
    if (!listeners) return;
    subscribers.delete(id);
    listeners.forEach((listener) =>
      listener({
        kind: 'satisfied',
        source: 'completed',
        leaderId: id,
        generation: generations.get(id),
      })
    );
  };

  const registerAnimate = jest.fn(
    (id: string, info: Parameters<SceneContextType['registerAnimate']>[1]) => {
      const leaseGeneration = ++generation;
      generations.set(id, leaseGeneration);
      let disposed = false;
      let published = false;

      const lease: SceneAnimationRegistrationLease = {
        animateId: id,
        generation: leaseGeneration,
        getCalculatedDelay: () => info.delay,
        observeWaitFor: (listener) => {
          if (!info.waitFor) {
            listener({ kind: 'satisfied', source: 'none' });
            return () => undefined;
          }
          if (completed.has(info.waitFor)) {
            listener({
              kind: 'satisfied',
              source: 'completed',
              leaderId: info.waitFor,
              generation: generations.get(info.waitFor),
            });
            return () => undefined;
          }
          listener({
            kind: 'pending',
            leaderId: info.waitFor,
            generation: generations.get(info.waitFor),
          });
          let listeners = subscribers.get(info.waitFor);
          if (!listeners) {
            listeners = new Set();
            subscribers.set(info.waitFor, listeners);
          }
          listeners.add(listener);
          return () => {
            listeners?.delete(listener);
            if (listeners?.size === 0) subscribers.delete(info.waitFor!);
          };
        },
        publishEnterCompleted: () => {
          if (disposed || published) return;
          published = true;
          publishSpy(id, leaseGeneration);
          complete(id);
        },
        dispose: () => {
          disposed = true;
        },
      };
      return lease;
    }
  );

  return {
    context: { registerAnimate },
    complete,
    publishSpy,
    subscriberCount: () =>
      [...subscribers.values()].reduce((total, listeners) => total + listeners.size, 0),
  };
}

interface ZoneOwnerLifecycleController {
  cleanupOwnerA: () => void;
  getBudgetDuration: () => number | undefined;
  hasBudget: () => boolean;
  setProgress: (progressPx: number) => void;
}

function ProductionZoneOwnerHarness({
  showLeader,
  onReady,
}: {
  showLeader: boolean;
  onReady: (controller: ZoneOwnerLifecycleController) => void;
}): JSX.Element {
  const scrollOffsetRef = useRef(0);
  const measureSceneLayoutsRef = useRef<(() => void) | null>(null);
  const updateSceneRenderSnapshotsRef = useRef<(nativeOffset: number) => void>(() => undefined);
  const zoneRegistry = useScrollZoneRegistry({
    scrollOffsetRef,
    measureSceneLayoutsRef,
    updateSceneRenderSnapshotsRef,
  });
  const animationRegistry = useSceneAnimationRegistry({ sceneIndex: 0, baseDuration: 800 });
  const ownerARef = useRef<SceneScrollAnimationRegistration | null>(null);
  const { syncZoneState, zoneAnimationsRef, zoneRuntimeValue, zoneTimelineValue } = zoneRegistry;

  useLayoutEffect(() => {
    const runtime = zoneRuntimeValue;
    runtime.registerZone('owner-zone', { sceneIndex: 0, trigger: 'center-lock' });
    ownerARef.current = runtime.registerZoneAnimation('owner-zone', {
      animateId: 'shared-zone-leader',
      delay: 0,
      enterDuration: 100,
      exitDuration: 0,
    });

    const cleanupOwnerA = (): void => {
      const owner = ownerARef.current;
      if (!owner) return;
      ownerARef.current = null;
      runtime.unregisterZoneAnimation('owner-zone', 'shared-zone-leader', owner);
    };

    onReady({
      cleanupOwnerA,
      getBudgetDuration: () =>
        zoneAnimationsRef.current.get('owner-zone')?.get('shared-zone-leader')?.enterDuration,
      hasBudget: () =>
        zoneAnimationsRef.current.get('owner-zone')?.has('shared-zone-leader') ?? false,
      setProgress: (progressPx) => {
        syncZoneState('owner-zone', (current) =>
          current
            ? {
                ...current,
                progressPx,
                active: true,
                direction: 'forward',
              }
            : null
        );
      },
    });

    return () => {
      cleanupOwnerA();
      runtime.unregisterZone('owner-zone', 0);
    };
  }, [onReady, syncZoneState, zoneAnimationsRef, zoneRuntimeValue]);

  return (
    <SceneContext.Provider value={{ ...createScrollSceneContext(), ...animationRegistry }}>
      <SceneScrollRuntimeContext.Provider value={zoneRuntimeValue}>
        <SceneScrollTimelineContext.Provider value={zoneTimelineValue}>
          {showLeader ? (
            <SceneScrollTakeoverContext.Provider value="owner-zone">
              <Animate
                animateId="shared-zone-leader"
                enterAnimation="fade-in"
                duration={{ enter: 200 }}
              >
                <div>Replacement zone leader</div>
              </Animate>
            </SceneScrollTakeoverContext.Provider>
          ) : null}
          <Animate
            animateId="owner-lifecycle-follower"
            enterAnimation="fade-in"
            duration={{ enter: 20 }}
            timeline={{ sceneControlled: false, waitFor: 'shared-zone-leader' }}
          >
            {({ phase }) => <output data-testid="owner-lifecycle-follower-phase">{phase}</output>}
          </Animate>
        </SceneScrollTimelineContext.Provider>
      </SceneScrollRuntimeContext.Provider>
    </SceneContext.Provider>
  );
}

function installAnimationFrameHarness(): {
  flush: () => void;
  pendingCount: () => number;
  cancelSpy: jest.SpyInstance;
  restore: () => void;
} {
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  const requestSpy = jest
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    });
  const cancelSpy = jest
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((handle: number) => {
      callbacks.delete(handle);
    });

  return {
    flush: () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(performance.now()));
    },
    pendingCount: () => callbacks.size,
    cancelSpy,
    restore: () => {
      requestSpy.mockRestore();
      cancelSpy.mockRestore();
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
    approach: 'near',
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
    approach: 'near',
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
        approach: 'near',
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

// The FOUC guard mounts an Animate BEFORE its preset variants finish parsing, so
// "the host element exists" is no longer a proxy for "the gate machine is live".
// Flush the parse microtasks so the host has actually been adopted before a test
// starts driving measurements against it.
async function waitForAnimateHost(animateId: string): Promise<HTMLElement> {
  await waitFor(() => {
    expect(document.querySelector(`[data-cineview-animate-host="${animateId}"]`)).not.toBeNull();
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return document.querySelector(`[data-cineview-animate-host="${animateId}"]`) as HTMLElement;
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
  // The FOUC guard mounts an Animate before its preset variants finish parsing, so
  // a test that ends without driving the element to completion can leave the parse
  // promise in flight; its setState would then land after the test body and warn
  // "not wrapped in act". Flush those microtasks inside act before RTL cleanup.
  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  beforeEach(() => {
    animationControlsRegistry.length = 0;
  });

  it('keeps visibility-driven scroll animations working outside a takeover owner', async () => {
    const sceneContext = createScrollSceneContext();

    render(
      <SceneContext.Provider value={sceneContext}>
        <Animate
          animateId="visibility-probe"
          enterAnimation="fade-in"
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

      const host = await waitForAnimateHost('above-top-probe');
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

  it('statically reveals first-screen visibility content after an unhandled preload timeout', async () => {
    const pendingContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterActive: true,
      firstSceneEnterReady: false,
    };
    const staticFallbackContext: SceneContextType = {
      ...pendingContext,
      firstSceneEnterActive: false,
    };

    const { rerender } = render(
      <SceneContext.Provider value={pendingContext}>
        <Animate
          animateId="first-screen-timeout-probe"
          enterAnimation="fade-in"
          duration={{ enter: 60 }}
          timeline={{ sceneControlled: false }}
        >
          <article>First screen timeout content</article>
        </Animate>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-cineview-animate-id="first-screen-timeout-probe"]')
      ).not.toBeNull();
      // Pending assets, including a consumer-handled timeout, stay at the
      // authored initial frame.
      expect(readMotionOpacity()).toBe(0);
    });

    rerender(
      <SceneContext.Provider value={staticFallbackContext}>
        <Animate
          animateId="first-screen-timeout-probe"
          enterAnimation="fade-in"
          duration={{ enter: 60 }}
          timeline={{ sceneControlled: false }}
        >
          <article>First screen timeout content</article>
        </Animate>
      </SceneContext.Provider>
    );

    // The default timeout fallback is deliberately static: no geometry gate,
    // delay or tween may leave the first screen blank.
    await waitFor(() => {
      expect(readMotionOpacity()).toBe(1);
    });
  });

  it('does not mistake an unpublished scroll snapshot for the static-timeout fallback', async () => {
    const unknownContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterGateKnown: false,
      firstSceneEnterActive: false,
      firstSceneEnterReady: false,
    };
    const staticFallbackContext: SceneContextType = {
      ...unknownContext,
      firstSceneEnterGateKnown: true,
    };

    const renderProbe = (context: SceneContextType): JSX.Element => (
      <SceneContext.Provider value={context}>
        <Animate
          animateId="unknown-first-screen-gate"
          enterAnimation="fade-in"
          duration={{ enter: 60 }}
          timeline={{ sceneControlled: false }}
        >
          <article>Unknown first-screen gate</article>
        </Animate>
      </SceneContext.Provider>
    );

    const { rerender } = render(renderProbe(unknownContext));
    await waitFor(() => {
      expect(
        document.querySelector('[data-cineview-animate-id="unknown-first-screen-gate"]')
      ).not.toBeNull();
    });
    const host = document.querySelector(
      '[data-cineview-animate-host="unknown-first-screen-gate"]'
    ) as HTMLElement;
    host.getBoundingClientRect = () => createHostRect(300, 700);

    // This measurement is essential: without a real box the hook bails after the
    // branch decision, so deleting the gateKnown guard can look green by accident.
    await flushScroll(window);
    expect(readMotionOpacity()).toBe(0);

    rerender(renderProbe(staticFallbackContext));
    await waitFor(() => {
      expect(readMotionOpacity()).toBe(1);
    });
  });

  it('re-arms the one-shot static fallback after returning to a pending gate', async () => {
    const originalInnerHeight = window.innerHeight;
    const pendingContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterGateKnown: true,
      firstSceneEnterActive: true,
      firstSceneEnterReady: false,
    };
    const staticContext: SceneContextType = {
      ...pendingContext,
      firstSceneEnterActive: false,
    };
    const renderProbe = (context: SceneContextType): JSX.Element => (
      <SceneContext.Provider value={context}>
        <Animate
          animateId="timeout-rearm-probe"
          enterAnimation="fade-in"
          timeline={{ sceneControlled: false }}
        >
          <article>Timeout re-arm content</article>
        </Animate>
      </SceneContext.Provider>
    );

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    try {
      const { rerender } = render(renderProbe(staticContext));
      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="timeout-rearm-probe"]')
        ).not.toBeNull();
      });
      const host = document.querySelector(
        '[data-cineview-animate-host="timeout-rearm-probe"]'
      ) as HTMLElement;
      // Outside the normal enter gate: only the explicit static fallback may reveal it.
      host.getBoundingClientRect = () => createHostRect(1200, 1300);
      await flushScroll(window);
      await waitFor(() => expect(readMotionOpacity()).toBe(1));

      rerender(renderProbe(pendingContext));
      await waitFor(() => expect(readMotionOpacity()).toBe(0));

      rerender(renderProbe(staticContext));
      await waitFor(() => expect(readMotionOpacity()).toBe(1));
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('owns the fallback measurement before an overlapping exit gate can run', async () => {
    const originalInnerHeight = window.innerHeight;
    const pendingContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterGateKnown: true,
      firstSceneEnterActive: true,
      firstSceneEnterReady: false,
    };
    const staticContext: SceneContextType = {
      ...pendingContext,
      firstSceneEnterActive: false,
    };
    const renderProbe = (context: SceneContextType): JSX.Element => (
      <SceneContext.Provider value={context}>
        <Animate
          animateId="timeout-fallback-frame-probe"
          enterAnimation="fade-in"
          exitAnimation="fade-out"
          duration={{ exit: 40 }}
          timeline={{ sceneControlled: false }}
        >
          {({ phase }) => <output data-testid="timeout-fallback-phase">{phase}</output>}
        </Animate>
      </SceneContext.Provider>
    );

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    try {
      const { rerender } = render(renderProbe(pendingContext));
      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="timeout-fallback-frame-probe"]')
        ).not.toBeNull();
      });
      const host = document.querySelector(
        '[data-cineview-animate-host="timeout-fallback-frame-probe"]'
      ) as HTMLElement;
      // Already beyond the top exit gate. The fallback's own measurement must still
      // render terminal and return; only a later measurement may author an exit.
      host.getBoundingClientRect = () => createHostRect(-500, -100);
      await flushScroll(window);
      rerender(renderProbe(staticContext));
      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
        expect(screen.getByTestId('timeout-fallback-phase')).toHaveTextContent('entered');
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('publishes static fallback completion so a normal waitFor follower can enter', async () => {
    const originalInnerHeight = window.innerHeight;
    const harness = createLeaseHarness();
    const leaderContext: SceneContextType = {
      ...createScrollSceneContext(),
      ...harness.context,
      firstSceneEnterGateKnown: true,
      firstSceneEnterActive: false,
      firstSceneEnterReady: false,
    };
    const followerContext: SceneContextType = {
      ...createScrollSceneContext(),
      ...harness.context,
    };
    const readOpacityFor = (id: string): number => {
      const node = screen
        .getAllByTestId('motion-div')
        .find((candidate) => candidate.getAttribute('data-cineview-animate-id') === id);
      return Number(node?.getAttribute('data-opacity') ?? '0');
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    try {
      render(
        <>
          <SceneContext.Provider value={leaderContext}>
            <Animate
              animateId="timeout-static-leader"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false }}
            >
              <article>Static leader</article>
            </Animate>
          </SceneContext.Provider>
          <SceneContext.Provider value={followerContext}>
            <Animate
              animateId="timeout-waitfor-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'timeout-static-leader' }}
            >
              <article>WaitFor follower</article>
            </Animate>
          </SceneContext.Provider>
        </>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="timeout-waitfor-follower"]')
        ).not.toBeNull();
      });
      const leaderHost = document.querySelector(
        '[data-cineview-animate-host="timeout-static-leader"]'
      ) as HTMLElement;
      const followerHost = document.querySelector(
        '[data-cineview-animate-host="timeout-waitfor-follower"]'
      ) as HTMLElement;
      leaderHost.getBoundingClientRect = () => createHostRect(200, 400);
      followerHost.getBoundingClientRect = () => createHostRect(420, 620);
      await flushScroll(window);

      await waitFor(() => expect(readOpacityFor('timeout-static-leader')).toBe(1));
      await waitFor(() => expect(readOpacityFor('timeout-waitfor-follower')).toBe(1));
      expect(harness.publishSpy.mock.calls.some(([id]) => id === 'timeout-static-leader')).toBe(
        true
      );
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('keeps authored exit behavior after the timeout static reveal', async () => {
    const originalInnerHeight = window.innerHeight;
    let hostRect = createHostRect(300, 700);
    const staticFallbackContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterGateKnown: true,
      firstSceneEnterActive: false,
      firstSceneEnterReady: false,
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={staticFallbackContext}>
          <Animate
            animateId="timeout-exit-probe"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false }}
          >
            <article>Timeout exit content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="timeout-exit-probe"]')
        ).not.toBeNull();
      });
      const host = document.querySelector(
        '[data-cineview-animate-host="timeout-exit-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => hostRect;
      await flushScroll(window);
      await waitFor(() => expect(readMotionOpacity()).toBe(1));

      hostRect = createHostRect(-500, -100);
      await flushScroll(window);
      await waitFor(() => expect(readMotionOpacity()).toBe(0));
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('starts visibility infinite motion after the timeout static reveal', async () => {
    const originalInnerHeight = window.innerHeight;
    const staticFallbackContext: SceneContextType = {
      ...createScrollSceneContext(),
      firstSceneEnterGateKnown: true,
      firstSceneEnterActive: false,
      firstSceneEnterReady: false,
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={staticFallbackContext}>
          <Animate
            animateId="timeout-infinite-probe"
            enterAnimation="fade-in"
            infiniteAnimation="pulse"
            timeline={{ sceneControlled: false }}
          >
            <article>Timeout infinite content</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-id="timeout-infinite-probe"]')
        ).not.toBeNull();
      });
      const host = document.querySelector(
        '[data-cineview-animate-host="timeout-infinite-probe"]'
      ) as HTMLElement;
      host.getBoundingClientRect = () => createHostRect(300, 700);
      await flushScroll(window);

      await waitFor(() => {
        expect(readMotionOpacity()).toBe(1);
        expect(
          animationControlsRegistry.some((controls) =>
            controls.start.mock.calls.some(([payload]) =>
              expect
                .objectContaining({ transition: expect.objectContaining({ repeat: Infinity }) })
                .asymmetricMatch(payload)
            )
          )
        ).toBe(true);
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

  it('preserves the first-screen margin bypass across waitFor and own delay rechecks', async () => {
    const originalInnerHeight = window.innerHeight;
    const harness = createLeaseHarness();
    harness.complete('cold-start-leader');
    const sceneContext: SceneContextType = {
      ...createScrollSceneContext(),
      ...harness.context,
      firstSceneEnterReady: true,
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="first-screen-delayed-follower"
            enterAnimation="fade-in"
            duration={{ enter: 60 }}
            timeline={{ sceneControlled: false, waitFor: 'cold-start-leader', delay: 40 }}
          >
            {({ phase }) => <output data-testid="first-screen-delayed-phase">{phase}</output>}
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-host="first-screen-delayed-follower"]')
        ).not.toBeNull();
      });
      const host = document.querySelector(
        '[data-cineview-animate-host="first-screen-delayed-follower"]'
      ) as HTMLElement;
      // Fully inside the first screen but deliberately outside the strict bottom
      // margin gate. Async dependency/delay wakeups must retain the cold-start
      // eligibility rather than cancelling this attempt back to idle.
      host.getBoundingClientRect = () => createHostRect(900, 990);
      await flushScroll(window);

      await waitFor(() => {
        expect(screen.getByTestId('first-screen-delayed-phase')).toHaveTextContent('entered');
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
    // it must NOT play until its leader lease publishes enter completion.
    // Here the leader never enters, so the follower stays at its initial frame
    // (opacity 0) even though its own gate is satisfied and its own delay is tiny.
    const originalInnerHeight = window.innerHeight;
    const hostRect = createHostRect(300, 700); // fully inside, enter gate satisfied
    const harness = createLeaseHarness();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      const { rerender } = render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="waitfor-visibility-probe"
            enterAnimation="fade-in"
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false, delay: 40, waitFor: 'leader' }}
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
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false, delay: 40, waitFor: 'leader' }}
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
    const harness = createLeaseHarness();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };
    // Leader already completed its enter before the follower ever scrolls in.
    harness.complete('leader');

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="late-follower"
            enterAnimation="fade-in"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false, delay: 20, waitFor: 'leader' }}
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
    const harness = createLeaseHarness();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };

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
            duration={{ enter: 80, exit: 80 }}
            timeline={{ sceneControlled: false, waitFor: 'cascade-leader' }}
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

describe('useAnimateScroll zone semantics (S-F6 infinite-only rest state / S-F8 cross-driver waitFor)', () => {
  // The FOUC guard mounts an Animate before its preset variants finish parsing, so
  // a test that ends without driving the element to completion can leave the parse
  // promise in flight; its setState would then land after the test body and warn
  // "not wrapped in act". Flush those microtasks inside act before RTL cleanup.
  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  beforeEach(() => {
    animationControlsRegistry.length = 0;
  });

  function readOpacityFor(id: string): number {
    const node = screen
      .getAllByTestId('motion-div')
      .find((n) => n.getAttribute('data-cineview-animate-id') === id);
    return Number(node?.getAttribute('data-opacity') ?? '0');
  }

  it('shows an infiniteAnimation-only element inside a takeover zone at its entered rest frame and runs its loop', async () => {
    // S-F6: no authored enter/exit -> no zone budget. The old code held such an
    // element at the initial frame (visualMotion 0 -> empty-variant default
    // opacity 0), so an infiniteAnimation-only element was permanently invisible
    // inside a takeover zone AND its infinite loop never started (budget lookup
    // pinned shouldRunInfinite to false). It must instead rest at its entered
    // frame with the loop gated by the scene runtime state.
    const sceneContext = createScrollSceneContext();

    const renderTree = (overrides: Partial<SceneContextType> = {}): JSX.Element => (
      <SceneContext.Provider value={{ ...sceneContext, ...overrides }}>
        <ScrollZoneProviders runtime={createZoneRuntime(0, 1)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate animateId="pulse-only" infiniteAnimation="pulse">
              <div>Persistent pulse</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    const { rerender } = render(renderTree());

    // Rest state: entered frame (empty-variant defaults -> opacity 1), even at
    // zone progress 0.
    await waitFor(() => {
      expect(readOpacityFor('pulse-only')).toBe(1);
    });

    // Infinite loop starts while the scene runtime allows it (runtimeState
    // undefined here = not gated).
    await waitFor(() => {
      expect(
        animationControlsRegistry.some((controls) => controls.start.mock.calls.length > 0)
      ).toBe(true);
    });

    // Scene leaves the stage -> the loop stops (phase/viewport gating intact).
    const startedControls = animationControlsRegistry.find(
      (controls) => controls.start.mock.calls.length > 0
    );
    const stopCallsBefore = startedControls?.stop.mock.calls.length ?? 0;
    rerender(renderTree({ runtimeState: 'covered' }));
    await waitFor(() => {
      expect(startedControls?.stop.mock.calls.length ?? 0).toBeGreaterThan(stopCallsBefore);
    });
  });

  it('still holds an explicitly-animated zone element at its initial frame before its enter segment', async () => {
    // S-F6 must not leak into elements WITH an authored enterAnimation: at zone
    // progress 0 they rest at the initial frame (opacity 0), not the entered one.
    const sceneContext = createScrollSceneContext();

    render(
      <SceneContext.Provider value={sceneContext}>
        <ScrollZoneProviders runtime={createZoneRuntime(0, 1)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate animateId="intro" enterAnimation="fade-in">
              <div>Zone intro</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
      </SceneContext.Provider>
    );

    await waitFor(() => {
      expect(document.querySelector('[data-cineview-animate-id="intro"]')).not.toBeNull();
    });
    // Bare macrotask waits let the (now earlier-mounted) variant parse settle
    // OUTSIDE act. Wrap it so the parse setState is attributed to this test.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    expect(readOpacityFor('intro')).toBe(0);
  });

  it('wakes a visibility waitFor follower when its zone-driven leader completes its enter segment', async () => {
    // S-F8 deadlock: completion used to be published only by the visibility
    // path. A zone-driven leader therefore never completed its registry lease,
    // so a visibility follower was pinned at opacity 0 forever. Crossing the
    // leader's enter end must publish completion and release the follower.
    const originalInnerHeight = window.innerHeight;
    const harness = createLeaseHarness();
    const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };
    const followerRect = createHostRect(300, 700);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      render(
        <SceneContext.Provider value={sceneContext}>
          <ScrollZoneProviders runtime={createZoneRuntime(300, 1)}>
            <SceneScrollTakeoverContext.Provider value="zone-1">
              <Animate animateId="intro" enterAnimation="fade-in">
                <div>Zone leader</div>
              </Animate>
            </SceneScrollTakeoverContext.Provider>
          </ScrollZoneProviders>
          <Animate
            animateId="zone-follower"
            enterAnimation="fade-in"
            duration={{ enter: 60, exit: 60 }}
            timeline={{ sceneControlled: false, waitFor: 'intro' }}
          >
            <article>Cross-driver follower</article>
          </Animate>
        </SceneContext.Provider>
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-cineview-animate-host="zone-follower"]')
        ).not.toBeNull();
      });

      // Leader already scrubbed past its enter end (progress 300 >= enter end
      // 100) -> entered frame.
      await waitFor(() => {
        expect(readOpacityFor('intro')).toBe(1);
      });

      const followerHost = document.querySelector(
        '[data-cineview-animate-host="zone-follower"]'
      ) as HTMLElement;
      followerHost.getBoundingClientRect = () => followerRect;
      await flushScroll(window);

      // The follower's gate fires, it subscribes to 'intro' on the bus, and the
      // zone leader's published completion releases it immediately.
      await waitFor(() => {
        expect(readOpacityFor('zone-follower')).toBe(1);
      });
      // Let the enter tween's onComplete (setPhase/setShouldRunInfiniteState)
      // land inside an act scope instead of leaking past the test.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('publishes zone enter-completion exactly once and never retracts it on reverse scrub', async () => {
    // Idempotence (hot-path red line): the zone effect re-runs on every scroll
    // frame, but the lease must publish only on the first crossing of the enter
    // end. Reverse-scrubbing back inside the enter segment must not retract the
    // generation-scoped "has entered at least once" completion fact.
    const originalInnerHeight = window.innerHeight;
    const harness = createLeaseHarness();
    const sceneContext: SceneContextType = {
      ...createScrollSceneContext(),
      ...harness.context,
    };
    const followerRect = createHostRect(300, 700);

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    const renderTree = (progressPx: number, version: number): JSX.Element => (
      <SceneContext.Provider value={sceneContext}>
        <ScrollZoneProviders runtime={createZoneRuntime(progressPx, version)}>
          <SceneScrollTakeoverContext.Provider value="zone-1">
            <Animate animateId="intro" enterAnimation="fade-in">
              <div>Zone leader</div>
            </Animate>
          </SceneScrollTakeoverContext.Provider>
        </ScrollZoneProviders>
        <Animate
          animateId="late-zone-follower"
          enterAnimation="fade-in"
          duration={{ enter: 60, exit: 60 }}
          timeline={{ sceneControlled: false, waitFor: 'intro' }}
        >
          <article>Late cross-driver follower</article>
        </Animate>
      </SceneContext.Provider>
    );

    try {
      const { rerender } = render(renderTree(300, 1));

      await waitFor(() => {
        expect(readOpacityFor('intro')).toBe(1);
      });
      const introPublishes = (): unknown[][] =>
        harness.publishSpy.mock.calls.filter(([id]) => id === 'intro');
      await waitFor(() => {
        expect(introPublishes()).toHaveLength(1);
      });

      // Reverse scrub back inside (50) and further within (40) the enter
      // segment: no re-publish, no retraction.
      rerender(renderTree(50, 2));
      rerender(renderTree(40, 3));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
      });
      expect(introPublishes()).toHaveLength(1);

      // A follower whose gate fires AFTER the reverse scrub still launches: the
      // completion fact persists on the registration generation.
      const followerHost = document.querySelector(
        '[data-cineview-animate-host="late-zone-follower"]'
      ) as HTMLElement;
      followerHost.getBoundingClientRect = () => followerRect;
      await flushScroll(window);

      await waitFor(() => {
        expect(readOpacityFor('late-zone-follower')).toBe(1);
      });
      // Settle the enter tween's onComplete inside act (see the deadlock test).
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it('keeps the replacement owner budget through stale cleanup, releases its follower, then removes it on owner cleanup', async () => {
    const originalInnerHeight = window.innerHeight;
    let controller!: ZoneOwnerLifecycleController;
    const onReady = (nextController: ZoneOwnerLifecycleController): void => {
      controller = nextController;
    };

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    try {
      const { rerender } = render(<ProductionZoneOwnerHarness showLeader onReady={onReady} />);

      await waitFor(() => {
        expect(controller.getBudgetDuration()).toBe(200);
        expect(
          document.querySelector('[data-cineview-animate-host="owner-lifecycle-follower"]')
        ).not.toBeNull();
      });

      const followerHost = document.querySelector(
        '[data-cineview-animate-host="owner-lifecycle-follower"]'
      ) as HTMLElement;
      followerHost.getBoundingClientRect = () => createHostRect(300, 700);
      await flushScroll(window);
      expect(screen.getByTestId('owner-lifecycle-follower-phase')).toHaveTextContent('waiting');

      act(() => controller.cleanupOwnerA());
      expect(controller.getBudgetDuration()).toBe(200);

      act(() => controller.setProgress(200));
      await waitFor(() => {
        expect(readOpacityFor('shared-zone-leader')).toBe(1);
        expect(screen.getByTestId('owner-lifecycle-follower-phase')).toHaveTextContent('entered');
        expect(readOpacityFor('owner-lifecycle-follower')).toBe(1);
      });

      rerender(<ProductionZoneOwnerHarness showLeader={false} onReady={onReady} />);
      await waitFor(() => {
        expect(controller.hasBudget()).toBe(false);
      });
    } finally {
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  describe('visibility waitFor liveness', () => {
    it('survives StrictMode setup-cleanup-setup without phantom dependency diagnostics', async () => {
      const originalInnerHeight = window.innerHeight;
      const reportError = jest.fn();

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <StrictMode>
            <ProductionRegistrySceneProvider reportError={reportError}>
              <Animate
                animateId="strict-leader"
                enterAnimation="fade-in"
                duration={{ enter: 20 }}
                timeline={{ sceneControlled: false }}
              >
                {({ phase }) => <output data-testid="strict-leader-phase">{phase}</output>}
              </Animate>
              <Animate
                animateId="strict-follower"
                enterAnimation="fade-in"
                duration={{ enter: 20 }}
                timeline={{ sceneControlled: false, waitFor: 'strict-leader' }}
              >
                {({ phase }) => <output data-testid="strict-follower-phase">{phase}</output>}
              </Animate>
            </ProductionRegistrySceneProvider>
          </StrictMode>
        );

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="strict-follower"]')
          ).not.toBeNull();
        });
        const leaderHost = document.querySelector(
          '[data-cineview-animate-host="strict-leader"]'
        ) as HTMLElement;
        const followerHost = document.querySelector(
          '[data-cineview-animate-host="strict-follower"]'
        ) as HTMLElement;
        leaderHost.getBoundingClientRect = () => createHostRect(200, 400);
        followerHost.getBoundingClientRect = () => createHostRect(500, 700);
        await flushScroll(window);

        await waitFor(() => {
          expect(screen.getByTestId('strict-leader-phase')).toHaveTextContent('entered');
          expect(screen.getByTestId('strict-follower-phase')).toHaveTextContent('entered');
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        });
        expect(reportError).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('clears dependency subscribers, delay timers, and targeted rechecks on waiting unmount', async () => {
      const originalInnerHeight = window.innerHeight;
      const animationFrames = installAnimationFrameHarness();
      const harness = createLeaseHarness();
      harness.complete('delay-ready-leader');
      const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };
      let unmount: (() => void) | undefined;

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        ({ unmount } = render(
          <SceneContext.Provider value={sceneContext}>
            <Animate
              animateId="subscriber-waiting-follower"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false, waitFor: 'never-ready-leader' }}
            >
              {({ phase }) => <output data-testid="subscriber-waiting-phase">{phase}</output>}
            </Animate>
            <Animate
              animateId="recheck-waiting-follower"
              enterAnimation="fade-in"
              timeline={{ sceneControlled: false, waitFor: 'recheck-ready-leader' }}
            >
              {({ phase }) => <output data-testid="recheck-waiting-phase">{phase}</output>}
            </Animate>
            <Animate
              animateId="timer-waiting-follower"
              enterAnimation="fade-in"
              timeline={{
                sceneControlled: false,
                waitFor: 'delay-ready-leader',
                delay: 1000,
              }}
            >
              {({ phase }) => <output data-testid="timer-waiting-phase">{phase}</output>}
            </Animate>
          </SceneContext.Provider>
        ));

        await waitForAnimateHost('timer-waiting-follower');
        [
          'subscriber-waiting-follower',
          'recheck-waiting-follower',
          'timer-waiting-follower',
        ].forEach((animateId, index) => {
          const host = document.querySelector(
            `[data-cineview-animate-host="${animateId}"]`
          ) as HTMLElement;
          host.getBoundingClientRect = () => createHostRect(200 + index * 180, 340 + index * 180);
        });

        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        try {
          act(() => animationFrames.flush());
          expect(screen.getByTestId('subscriber-waiting-phase')).toHaveTextContent('waiting');
          expect(screen.getByTestId('recheck-waiting-phase')).toHaveTextContent('waiting');
          expect(screen.getByTestId('timer-waiting-phase')).toHaveTextContent('waiting');
          expect(harness.subscriberCount()).toBe(2);

          act(() => animationFrames.flush());
          const delayCallIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 1000);
          expect(delayCallIndex).toBeGreaterThanOrEqual(0);
          const delayHandle = setTimeoutSpy.mock.results[delayCallIndex]?.value;

          act(() => harness.complete('recheck-ready-leader'));
          expect(harness.subscriberCount()).toBe(1);
          expect(animationFrames.pendingCount()).toBe(1);

          act(() => unmount?.());
          unmount = undefined;

          expect(harness.subscriberCount()).toBe(0);
          expect(animationFrames.pendingCount()).toBe(0);
          expect(animationFrames.cancelSpy).toHaveBeenCalled();
          expect(clearTimeoutSpy).toHaveBeenCalledWith(delayHandle);
        } finally {
          setTimeoutSpy.mockRestore();
          clearTimeoutSpy.mockRestore();
        }
      } finally {
        unmount?.();
        animationFrames.restore();
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('fails open through the production registry when a missing dependency is already stable', async () => {
      const originalInnerHeight = window.innerHeight;
      const reportError = jest.fn();

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <ProductionRegistrySceneProvider reportError={reportError}>
            <Animate
              animateId="production-missing-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'production-missing-leader' }}
            >
              {({ phase }) => <output data-testid="production-missing-phase">{phase}</output>}
            </Animate>
          </ProductionRegistrySceneProvider>
        );

        await waitFor(() => {
          expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'INVALID_ANIMATION' })
          );
        });

        const host = document.querySelector(
          '[data-cineview-animate-host="production-missing-follower"]'
        ) as HTMLElement;
        host.getBoundingClientRect = () => createHostRect(300, 700);
        await flushScroll(window);

        await waitFor(() => {
          expect(screen.getByTestId('production-missing-phase')).toHaveTextContent('entered');
          expect(readOpacityFor('production-missing-follower')).toBe(1);
        });
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('fails open through the production registry when a dependency cycle is already stable', async () => {
      const originalInnerHeight = window.innerHeight;
      const reportError = jest.fn();

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <ProductionRegistrySceneProvider reportError={reportError}>
            <Animate
              animateId="production-cycle-a"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'production-cycle-b' }}
            >
              {({ phase }) => <output data-testid="production-cycle-a-phase">{phase}</output>}
            </Animate>
            <Animate
              animateId="production-cycle-b"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'production-cycle-a' }}
            >
              {({ phase }) => <output data-testid="production-cycle-b-phase">{phase}</output>}
            </Animate>
          </ProductionRegistrySceneProvider>
        );

        await waitFor(() => {
          expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'CIRCULAR_DEPENDENCY' })
          );
        });

        const firstHost = document.querySelector(
          '[data-cineview-animate-host="production-cycle-a"]'
        ) as HTMLElement;
        const secondHost = document.querySelector(
          '[data-cineview-animate-host="production-cycle-b"]'
        ) as HTMLElement;
        firstHost.getBoundingClientRect = () => createHostRect(200, 400);
        secondHost.getBoundingClientRect = () => createHostRect(500, 700);
        await flushScroll(window);

        await waitFor(() => {
          expect(screen.getByTestId('production-cycle-a-phase')).toHaveTextContent('entered');
          expect(screen.getByTestId('production-cycle-b-phase')).toHaveTextContent('entered');
          expect(readOpacityFor('production-cycle-a')).toBe(1);
          expect(readOpacityFor('production-cycle-b')).toBe(1);
        });
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('does not carry entered completion into a rebuilt registration generation', async () => {
      const originalInnerHeight = window.innerHeight;

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      const renderTree = (leaderDelay: number, showFollower: boolean): JSX.Element => (
        <ProductionRegistrySceneProvider>
          <Animate
            animateId="reregistered-leader"
            enterAnimation="fade-in"
            duration={{ enter: 40 }}
            timeline={{ sceneControlled: false, delay: leaderDelay }}
          >
            {({ phase }) => <output data-testid="reregistered-leader-phase">{phase}</output>}
          </Animate>
          {showFollower ? (
            <Animate
              animateId="reregistered-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'reregistered-leader' }}
            >
              {({ phase }) => <output data-testid="reregistered-follower-phase">{phase}</output>}
            </Animate>
          ) : null}
        </ProductionRegistrySceneProvider>
      );

      try {
        const { rerender } = render(renderTree(0, false));
        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="reregistered-leader"]')
          ).not.toBeNull();
        });
        const leaderHost = document.querySelector(
          '[data-cineview-animate-host="reregistered-leader"]'
        ) as HTMLElement;
        leaderHost.getBoundingClientRect = () => createHostRect(200, 400);
        await flushScroll(window);
        await waitFor(() => {
          expect(screen.getByTestId('reregistered-leader-phase')).toHaveTextContent('entered');
        });

        // Changing timing rebuilds the owner's registration generation without
        // replaying its already-completed visual tween.
        rerender(renderTree(60, false));
        await act(async () => {
          await Promise.resolve();
        });
        rerender(renderTree(60, true));

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="reregistered-follower"]')
          ).not.toBeNull();
        });
        const followerHost = document.querySelector(
          '[data-cineview-animate-host="reregistered-follower"]'
        ) as HTMLElement;
        followerHost.getBoundingClientRect = () => createHostRect(500, 700);
        await flushScroll(window);

        expect(screen.getByTestId('reregistered-follower-phase')).toHaveTextContent('waiting');
        expect(readOpacityFor('reregistered-follower')).toBe(0);
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('does not carry exited leader history into a rebuilt registration generation', async () => {
      const originalInnerHeight = window.innerHeight;
      let leaderRect = createHostRect(200, 400);

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      const renderTree = (leaderDelay: number, showFollower: boolean): JSX.Element => (
        <ProductionRegistrySceneProvider>
          <Animate
            animateId="exited-reregistered-leader"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 40, exit: 40 }}
            timeline={{ sceneControlled: false, delay: leaderDelay }}
          >
            {({ phase }) => <output data-testid="exited-reregistered-leader-phase">{phase}</output>}
          </Animate>
          {showFollower ? (
            <Animate
              animateId="exited-reregistered-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'exited-reregistered-leader' }}
            >
              {({ phase }) => (
                <output data-testid="exited-reregistered-follower-phase">{phase}</output>
              )}
            </Animate>
          ) : null}
        </ProductionRegistrySceneProvider>
      );

      try {
        const { rerender } = render(renderTree(0, false));
        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="exited-reregistered-leader"]')
          ).not.toBeNull();
        });
        const leaderHost = document.querySelector(
          '[data-cineview-animate-host="exited-reregistered-leader"]'
        ) as HTMLElement;
        leaderHost.getBoundingClientRect = () => leaderRect;
        await flushScroll(window);
        await waitFor(() => {
          expect(screen.getByTestId('exited-reregistered-leader-phase')).toHaveTextContent(
            'entered'
          );
        });

        leaderRect = createHostRect(-400, -200);
        await flushScroll(window);
        await waitFor(() => {
          expect(screen.getByTestId('exited-reregistered-leader-phase')).toHaveTextContent(
            'exited'
          );
        });

        rerender(renderTree(60, false));
        await act(async () => {
          await Promise.resolve();
        });
        rerender(renderTree(60, true));

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="exited-reregistered-follower"]')
          ).not.toBeNull();
        });
        const followerHost = document.querySelector(
          '[data-cineview-animate-host="exited-reregistered-follower"]'
        ) as HTMLElement;
        followerHost.getBoundingClientRect = () => createHostRect(500, 700);
        await flushScroll(window);

        expect(screen.getByTestId('exited-reregistered-follower-phase')).toHaveTextContent(
          'waiting'
        );
        expect(readOpacityFor('exited-reregistered-follower')).toBe(0);
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('does not let an older enter tween complete a newer registration lease', async () => {
      const originalInnerHeight = window.innerHeight;
      const harness = createLeaseHarness();
      const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      const renderTree = (leaderDelay: number): JSX.Element => (
        <SceneContext.Provider value={sceneContext}>
          <Animate
            animateId="stale-tween-leader"
            enterAnimation="fade-in"
            duration={{ enter: 120 }}
            timeline={{ sceneControlled: false, delay: leaderDelay }}
          >
            {({ phase }) => <output data-testid="stale-tween-leader-phase">{phase}</output>}
          </Animate>
        </SceneContext.Provider>
      );

      try {
        const { rerender } = render(renderTree(0));
        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="stale-tween-leader"]')
          ).not.toBeNull();
        });
        const leaderHost = document.querySelector(
          '[data-cineview-animate-host="stale-tween-leader"]'
        ) as HTMLElement;
        leaderHost.getBoundingClientRect = () => createHostRect(200, 400);
        await flushScroll(window);
        await waitFor(() => {
          expect(screen.getByTestId('stale-tween-leader-phase')).toHaveTextContent('entering');
        });

        rerender(renderTree(20));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 160));
        });

        expect(harness.publishSpy).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('exposes waiting instead of entering before the leader completes', async () => {
      const originalInnerHeight = window.innerHeight;
      const harness = createLeaseHarness();
      const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <SceneContext.Provider value={sceneContext}>
            <Animate
              animateId="waiting-phase-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'waiting-phase-leader' }}
            >
              {({ phase }) => <output data-testid="waiting-phase">{phase}</output>}
            </Animate>
          </SceneContext.Provider>
        );

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="waiting-phase-follower"]')
          ).not.toBeNull();
        });
        const host = document.querySelector(
          '[data-cineview-animate-host="waiting-phase-follower"]'
        ) as HTMLElement;
        host.getBoundingClientRect = () => createHostRect(300, 700);
        await flushScroll(window);

        expect(screen.getByTestId('waiting-phase')).toHaveTextContent('waiting');
        expect(readMotionOpacity()).toBe(0);
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('cancels a pending dependency wait when the follower leaves its enter gate', async () => {
      const originalInnerHeight = window.innerHeight;
      const harness = createLeaseHarness();
      const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };
      let hostRect = createHostRect(300, 700);

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <SceneContext.Provider value={sceneContext}>
            <Animate
              animateId="dependency-cancel-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'dependency-cancel-leader' }}
            >
              {({ phase }) => <output data-testid="dependency-cancel-phase">{phase}</output>}
            </Animate>
          </SceneContext.Provider>
        );

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="dependency-cancel-follower"]')
          ).not.toBeNull();
        });
        const host = document.querySelector(
          '[data-cineview-animate-host="dependency-cancel-follower"]'
        ) as HTMLElement;
        host.getBoundingClientRect = () => hostRect;
        await flushScroll(window);
        expect(screen.getByTestId('dependency-cancel-phase')).toHaveTextContent('waiting');

        hostRect = createHostRect(1100, 1500);
        await flushScroll(window);
        act(() => harness.complete('dependency-cancel-leader'));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 80));
        });

        expect(screen.getByTestId('dependency-cancel-phase')).toHaveTextContent('idle');
        expect(readMotionOpacity()).toBe(0);
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });

    it('cancels its own pending delay when the follower leaves its enter gate', async () => {
      const originalInnerHeight = window.innerHeight;
      const harness = createLeaseHarness();
      harness.complete('delay-cancel-leader');
      const sceneContext: SceneContextType = { ...createScrollSceneContext(), ...harness.context };
      let hostRect = createHostRect(300, 700);

      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

      try {
        render(
          <SceneContext.Provider value={sceneContext}>
            <Animate
              animateId="delay-cancel-follower"
              enterAnimation="fade-in"
              duration={{ enter: 40 }}
              timeline={{ sceneControlled: false, waitFor: 'delay-cancel-leader', delay: 80 }}
            >
              {({ phase }) => <output data-testid="delay-cancel-phase">{phase}</output>}
            </Animate>
          </SceneContext.Provider>
        );

        await waitFor(() => {
          expect(
            document.querySelector('[data-cineview-animate-host="delay-cancel-follower"]')
          ).not.toBeNull();
        });
        const host = document.querySelector(
          '[data-cineview-animate-host="delay-cancel-follower"]'
        ) as HTMLElement;
        host.getBoundingClientRect = () => hostRect;
        await flushScroll(window);
        expect(screen.getByTestId('delay-cancel-phase')).toHaveTextContent('waiting');

        hostRect = createHostRect(1100, 1500);
        await flushScroll(window);
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 140));
        });

        expect(screen.getByTestId('delay-cancel-phase')).toHaveTextContent('idle');
        expect(readMotionOpacity()).toBe(0);
      } finally {
        Object.defineProperty(window, 'innerHeight', {
          configurable: true,
          value: originalInnerHeight,
        });
      }
    });
  });
});
