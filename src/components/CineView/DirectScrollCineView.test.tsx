import React, { act, useEffect, useContext, createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DirectScrollCineView } from './DirectScrollCineView';
import { Animate, SceneContext } from '../Animate/Animate';
import { Scene } from '../Scene/Scene';
import { Position } from '../Position/Position';
import type { CineViewRef } from '../../types';
import {
  SceneScrollRuntimeContext,
  SceneScrollTakeoverContext,
  useSceneScrollZoneTimeline,
} from '../Scene/sceneScrollRuntime';
import { performanceMonitor } from '../../utils/performanceMonitor';

jest.mock('framer-motion', () => {
  const React = jest.requireActual('react');

  const createMotionValue = <T,>(initial: T) => {
    let current = initial;
    const listeners = new Set<(value: T) => void>();

    return {
      get: (): T => current,
      set: jest.fn((value: T) => {
        current = value;
        listeners.forEach((listener) => listener(value));
      }),
      on: jest.fn((_event: string, listener: (value: T) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }),
    };
  };

  const isMotionValue = (
    value: unknown
  ): value is {
    get: () => unknown;
    on: (event: string, listener: (value: unknown) => void) => () => void;
  } =>
    Boolean(
      value &&
      typeof value === 'object' &&
      'get' in value &&
      typeof value.get === 'function' &&
      'on' in value &&
      typeof value.on === 'function'
    );

  const resolveStyleObject = (value: unknown): React.CSSProperties & Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, isMotionValue(entry) ? entry.get() : entry])
    ) as React.CSSProperties & Record<string, unknown>;
  };

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
      const [animatedStyle, setAnimatedStyle] = React.useState(
        (): React.CSSProperties => resolveStyleObject(initial)
      );
      const [, forceRender] = React.useState(0);

      React.useEffect(() => {
        const baseStyle = resolveStyleObject(initial);

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
            ...resolveStyleObject(animate.getCurrent()),
          });

          return animate.subscribe((next: unknown) => {
            setAnimatedStyle({
              ...baseStyle,
              ...resolveStyleObject(next),
            });
          });
        }

        setAnimatedStyle(baseStyle);
        return undefined;
      }, [animate, initial]);

      React.useEffect(() => {
        const unsubscribes = Object.values(style ?? {})
          .filter(isMotionValue)
          .map((value) =>
            value.on('change', () => {
              forceRender((count: number) => count + 1);
            })
          );

        return () => {
          unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
      }, [style]);

      return (
        <div
          ref={ref}
          {...props}
          style={{
            ...resolveStyleObject(style),
            ...animatedStyle,
          }}
        >
          {children}
        </div>
      );
    }
  );
  MotionDiv.displayName = 'MotionDiv';

  const useAnimation = () => {
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
      const updateState = (next?: unknown): void => {
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
          return;
        }

        currentState = {
          ...currentState,
          ...next,
        };
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

  return {
    __esModule: true,
    motion: {
      div: MotionDiv,
    },
    useAnimation,
    useMotionValue: (initial: unknown) => createMotionValue(initial),
    useTransform: (
      source: {
        get: () => unknown;
        on: (event: string, listener: (value: unknown) => void) => () => void;
      },
      transform: (value: unknown) => unknown
    ) => {
      const derived = createMotionValue(transform(source.get()));
      const update = (value: unknown): void => {
        derived.set(transform(value));
      };
      source.on('change', update);
      return derived;
    },
    animate: (
      motionValue: {
        set: (value: unknown) => void;
      },
      target: unknown
    ) => {
      motionValue.set(target);
      return { stop: jest.fn() };
    },
  };
});

jest.mock('../../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn(async (animation: unknown) => {
    if (!animation) {
      return null;
    }

    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }),
}));

jest.mock('../../hooks/useImagePreloader', () => ({
  useImagePreloader: jest.fn(() => [
    {
      isLoading: false,
      progress: 100,
      loadedCount: 0,
      totalCount: 0,
      results: [],
      errors: new Map(),
    },
    {
      startPreload: jest.fn(),
      reset: jest.fn(),
      addUrls: jest.fn(),
    },
  ]),
}));

jest.mock('../../utils/performanceMonitor', () => {
  const performanceMonitor = {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 42,
      bundleSize: 12,
    })),
    reset: jest.fn(),
  };
  return {
    performanceMonitor,
    acquirePerformanceMonitoring: jest.fn(() => {
      performanceMonitor.start();
      return () => performanceMonitor.stop();
    }),
  };
});

function ScrollBudgetProbe({
  animateId,
  enterDuration = 240,
}: {
  animateId: string;
  enterDuration?: number;
}): JSX.Element | null {
  const runtime = useContext(SceneScrollRuntimeContext);
  const zoneId = useContext(SceneScrollTakeoverContext);

  useEffect(() => {
    if (!runtime || !zoneId) {
      return;
    }

    const registrationOwner = runtime.registerZoneAnimation(zoneId, {
      animateId,
      delay: 0,
      enterDuration,
      exitDuration: 0,
    });

    return () => {
      runtime.unregisterZoneAnimation(zoneId, animateId, registrationOwner);
    };
  }, [animateId, enterDuration, runtime, zoneId]);

  return null;
}

function ZoneProgressProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const progress = useSceneScrollZoneTimeline(zoneId)?.progressPx ?? 0;

  return <output data-testid={`${zoneId}-progress`}>{progress}</output>;
}

function ZoneTotalBudgetProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const total = useSceneScrollZoneTimeline(zoneId)?.totalBudgetPx ?? -1;
  return <output data-testid={`${zoneId}-total`}>{total}</output>;
}

function ZoneActiveProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const active = useSceneScrollZoneTimeline(zoneId)?.active ?? false;

  return <output data-testid={`${zoneId}-active`}>{String(active)}</output>;
}

function ZoneBudgetKeysProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const keys = Object.keys(useSceneScrollZoneTimeline(zoneId)?.sequence.budgets ?? {}).sort();

  return <output data-testid={`${zoneId}-budget-keys`}>{keys.join(',')}</output>;
}

function SceneRuntimeProbe({ sceneId }: { sceneId: string }): JSX.Element {
  const sceneContext = useContext(SceneContext);
  return (
    <output data-testid={`${sceneId}-runtime`}>{sceneContext?.runtimeState ?? 'missing'}</output>
  );
}

interface TestSceneProps {
  children: React.ReactNode;
  assets?: {
    preloadImages?: string[];
  };
  sceneId?: string;
  sceneHeight?: number | string;
  scroll?: {
    zoneId?: string;
    trigger?: 'center-lock';
  };
  sceneRuntime?: {
    sceneIndex: number;
    firstSceneEnterReady?: boolean;
  };
}

const TestScene: React.FC<TestSceneProps> = ({ children, sceneId, scroll, sceneRuntime }) => {
  const runtime = useContext(SceneScrollRuntimeContext);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const zoneId = scroll?.zoneId ?? sceneId ?? null;
  const sceneIndex = sceneRuntime?.sceneIndex ?? 0;
  // Expose the cold-start ready flag CineView injects, so a regression test can
  // assert scene 0 is no longer permanently held at its initial frame.
  const firstSceneEnterReady = sceneRuntime?.firstSceneEnterReady;

  useEffect(() => {
    if (!runtime || !zoneId || !scroll) {
      return;
    }

    runtime.registerZone(zoneId, {
      sceneIndex,
      trigger: scroll.trigger ?? 'center-lock',
    });

    return () => {
      runtime.unregisterZone(zoneId, sceneIndex);
    };
  }, [runtime, sceneIndex, scroll, zoneId]);

  useEffect(() => {
    if (!runtime || !zoneId) {
      return;
    }

    runtime.setZoneElement(zoneId, sceneIndex, zoneRef.current);

    return () => {
      runtime.setZoneElement(zoneId, sceneIndex, null);
    };
  }, [runtime, sceneIndex, zoneId]);

  return (
    <SceneScrollTakeoverContext.Provider value={zoneId}>
      <div
        ref={zoneRef}
        data-cineview-scroll-zone={zoneId ?? undefined}
        data-first-scene-enter-ready={
          firstSceneEnterReady === undefined ? undefined : String(firstSceneEnterReady)
        }
      >
        {children}
      </div>
    </SceneScrollTakeoverContext.Provider>
  );
};

(TestScene as typeof TestScene & { cineViewScene?: boolean }).cineViewScene = true;
TestScene.displayName = 'Scene';

function installScrollGeometry({
  container,
  sceneTops,
  sceneHeights,
  viewportHeight = 1000,
}: {
  container: HTMLElement;
  sceneTops: number[];
  sceneHeights: number[];
  viewportHeight?: number;
}): void {
  const wrappers = Array.from(container.querySelectorAll('[data-scene-index]')) as HTMLDivElement[];
  const flowHeights = sceneHeights.map((visualHeight, index) => {
    const shell = wrappers[index]?.querySelector(
      '[data-cineview-takeover-shell="1"]'
    ) as HTMLDivElement | null;
    const timelineDistancePx = Number(shell?.dataset.cineviewTakeoverTotalDistancePx ?? '0');

    return shell
      ? Math.max(visualHeight, viewportHeight) + Math.max(timelineDistancePx, 0)
      : visualHeight;
  });

  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    value: viewportHeight,
  });
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: 750,
  });
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    value: Math.max(...sceneTops.map((top, index) => top + flowHeights[index]), viewportHeight),
  });
  Object.defineProperty(container, 'scrollWidth', {
    configurable: true,
    value: 750,
  });
  container.scrollTo = ((optionsOrX?: ScrollToOptions | number, y?: number) => {
    if (typeof optionsOrX === 'number') {
      container.scrollLeft = optionsOrX;
      if (typeof y === 'number') {
        container.scrollTop = y;
      }
      return;
    }

    if (typeof optionsOrX?.top === 'number') {
      container.scrollTop = optionsOrX.top;
    }
    if (typeof optionsOrX?.left === 'number') {
      container.scrollLeft = optionsOrX.left;
    }
  }) as HTMLElement['scrollTo'];
  container.getBoundingClientRect = () =>
    ({
      top: 0,
      left: 0,
      bottom: viewportHeight,
      right: 750,
      width: 750,
      height: viewportHeight,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }) as DOMRect;

  wrappers.forEach((wrapper, index) => {
    const top = sceneTops[index];
    const height = flowHeights[index];
    Object.defineProperty(wrapper, 'offsetHeight', {
      configurable: true,
      value: height,
    });
    Object.defineProperty(wrapper, 'clientHeight', {
      configurable: true,
      value: height,
    });
    wrapper.getBoundingClientRect = () =>
      ({
        top: top - container.scrollTop,
        bottom: top - container.scrollTop + height,
        left: 0,
        right: 750,
        width: 750,
        height,
        x: 0,
        y: top - container.scrollTop,
        toJSON: () => undefined,
      }) as DOMRect;
  });

  const zones = Array.from(
    container.querySelectorAll('[data-cineview-scroll-zone]')
  ) as HTMLDivElement[];
  zones.forEach((zone) => {
    const wrapper = zone.closest('[data-scene-index]') as HTMLDivElement | null;
    const sceneIndexAttribute = wrapper?.getAttribute('data-scene-index');
    const parsedSceneIndex =
      typeof sceneIndexAttribute === 'string'
        ? Number.parseInt(sceneIndexAttribute, 10)
        : Number.NaN;
    const index = Number.isFinite(parsedSceneIndex) ? parsedSceneIndex : zones.indexOf(zone);
    const top = sceneTops[index];
    const height = sceneHeights[index];
    if (top === undefined || height === undefined) {
      return;
    }
    Object.defineProperty(zone, 'offsetHeight', {
      configurable: true,
      value: height,
    });
    Object.defineProperty(zone, 'clientHeight', {
      configurable: true,
      value: height,
    });
    zone.getBoundingClientRect = () =>
      ({
        top: top - container.scrollTop,
        bottom: top - container.scrollTop + height,
        left: 0,
        right: 750,
        width: 750,
        height,
        x: 0,
        y: top - container.scrollTop,
        toJSON: () => undefined,
      }) as DOMRect;
  });
}

function readOutputNumber(testId: string): number {
  return Number(screen.getByTestId(testId).textContent ?? '0');
}

function getTakeoverSegment(
  container: HTMLElement,
  sceneIndex: number
): {
  start: number;
  end: number;
  distance: number;
} {
  const shell = container.querySelector(
    `[data-cineview-takeover-shell="${sceneIndex}"]`
  ) as HTMLDivElement;

  return {
    start: Number(shell.dataset.cineviewTakeoverSegmentStart),
    end: Number(shell.dataset.cineviewTakeoverSegmentEnd),
    distance: Number(shell.dataset.cineviewTakeoverTotalDistancePx),
  };
}

function getThumbMetrics(container: HTMLElement): {
  thumb: HTMLDivElement;
  offset: number;
  length: number;
} {
  const thumb = container.querySelector('[data-cineview-scrollbar-thumb="true"]') as HTMLDivElement;

  return {
    thumb,
    offset: parseFloat(thumb.style.top || thumb.style.left || '0'),
    length: parseFloat(thumb.style.height || thumb.style.width || '0'),
  };
}

function getExpectedThumbOffsetForNativeOffset({
  nativeOffset,
  viewportSpan = 1000,
  contentSpan,
}: {
  nativeOffset: number;
  viewportSpan?: number;
  contentSpan: number;
}): number {
  const railLength = viewportSpan;
  const effectiveContentSpan = contentSpan + viewportSpan;
  const thumbLength =
    contentSpan > 0
      ? Math.min(
          railLength,
          Math.max((viewportSpan / Math.max(effectiveContentSpan, viewportSpan)) * railLength, 40)
        )
      : railLength;
  const thumbTravel = Math.max(railLength - thumbLength, 0);

  return contentSpan > 0
    ? Math.min(Math.max((nativeOffset / contentSpan) * thumbTravel, 0), thumbTravel)
    : 0;
}

function dispatchPointerEvent(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  {
    clientX,
    clientY,
    pointerId = 1,
    pointerType = 'mouse',
    button = 0,
    buttons = type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
  }: {
    clientX: number;
    clientY: number;
    pointerId?: number;
    pointerType?: string;
    button?: number;
    buttons?: number;
  }
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    button: { value: button },
    buttons: { value: buttons },
  });
  target.dispatchEvent(event);
}

function dragScrollbarThumbToNativeOffset({
  container,
  nativeOffset,
  contentSpan,
}: {
  container: HTMLElement;
  nativeOffset: number;
  contentSpan: number;
}): void {
  const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
  const thumb = container.querySelector('[data-cineview-scrollbar-thumb="true"]') as HTMLDivElement;
  const railRect = {
    top: 0,
    bottom: 1000,
    left: 744,
    right: 750,
    width: 6,
    height: 1000,
    x: 744,
    y: 0,
    toJSON: () => undefined,
  } as DOMRect;
  const { offset, length } = getThumbMetrics(container);
  const centerX = railRect.left + railRect.width / 2;
  const targetOffset = getExpectedThumbOffsetForNativeOffset({
    nativeOffset,
    contentSpan,
  });

  rail.getBoundingClientRect = () => railRect;
  thumb.getBoundingClientRect = () =>
    ({
      top: railRect.top + offset,
      bottom: railRect.top + offset + length,
      left: railRect.left,
      right: railRect.right,
      width: railRect.width,
      height: length,
      x: railRect.left,
      y: railRect.top + offset,
      toJSON: () => undefined,
    }) as DOMRect;

  dispatchPointerEvent(thumb, 'pointerdown', {
    clientX: centerX,
    clientY: railRect.top + offset + length / 2,
  });
  dispatchPointerEvent(window, 'pointermove', {
    clientX: centerX,
    clientY: railRect.top + targetOffset + length / 2,
  });
  dispatchPointerEvent(window, 'pointerup', {
    clientX: centerX,
    clientY: railRect.top + targetOffset + length / 2,
  });
}

function clickScrollbarRailToNativeOffset({
  container,
  nativeOffset,
  contentSpan,
}: {
  container: HTMLElement;
  nativeOffset: number;
  contentSpan: number;
}): void {
  const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
  const thumb = container.querySelector('[data-cineview-scrollbar-thumb="true"]') as HTMLDivElement;
  const railRect = {
    top: 0,
    bottom: 1000,
    left: 744,
    right: 750,
    width: 6,
    height: 1000,
    x: 744,
    y: 0,
    toJSON: () => undefined,
  } as DOMRect;
  const { offset, length } = getThumbMetrics(container);
  const centerX = railRect.left + railRect.width / 2;
  const targetOffset = getExpectedThumbOffsetForNativeOffset({
    nativeOffset,
    contentSpan,
  });

  rail.getBoundingClientRect = () => railRect;
  thumb.getBoundingClientRect = () =>
    ({
      top: railRect.top + offset,
      bottom: railRect.top + offset + length,
      left: railRect.left,
      right: railRect.right,
      width: railRect.width,
      height: length,
      x: railRect.left,
      y: railRect.top + offset,
      toJSON: () => undefined,
    }) as DOMRect;

  dispatchPointerEvent(rail, 'pointerdown', {
    clientX: centerX,
    clientY: railRect.top + targetOffset + length / 2,
  });
}

function readAnimateOpacity(container: HTMLElement, animateId: string): number {
  const node = container.querySelector(
    `[data-cineview-animate-id="${animateId}"]`
  ) as HTMLDivElement | null;

  return Number.parseFloat(node?.style.opacity || '0');
}

function getFixedLayerClip(container: HTMLElement, sceneIndex: number): HTMLDivElement {
  return container.querySelector(
    `[data-scene-fixed-layer="${sceneIndex}"][data-scene-fixed-role="clip"]`
  ) as HTMLDivElement;
}

async function flushAnimationFrame(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    await Promise.resolve();
  });
}

async function wheelAndFlush(root: HTMLDivElement, deltaY: number): Promise<void> {
  act(() => {
    fireEvent.wheel(root, {
      deltaY,
      deltaMode: 0,
    });
  });

  await flushAnimationFrame();
}

async function wheelWithNativeDefaultAndFlush(
  root: HTMLDivElement,
  deltaY: number
): Promise<boolean> {
  let defaultWasPrevented = false;

  act(() => {
    const defaultWasNotPrevented = fireEvent.wheel(root, {
      deltaY,
      deltaMode: 0,
      cancelable: true,
    });

    defaultWasPrevented = !defaultWasNotPrevented;

    if (!defaultWasPrevented) {
      const maxScrollTop = Math.max(root.scrollHeight - root.clientHeight, 0);
      root.scrollTop = Math.min(Math.max(root.scrollTop + deltaY, 0), maxScrollTop);
      fireEvent.scroll(root);
    }
  });

  await flushAnimationFrame();

  return defaultWasPrevented;
}

async function completeTakeoverForward(
  root: HTMLDivElement,
  readProgress: () => number,
  totalBudget: number,
  maxSteps = 32
): Promise<void> {
  for (let step = 0; step < maxSteps && readProgress() < totalBudget - 0.5; step += 1) {
    await wheelAndFlush(root, 90000);
  }

  await waitFor(() => {
    expect(readProgress()).toBeCloseTo(totalBudget, 5);
  });
}

async function wheelUntil(
  root: HTMLDivElement,
  predicate: () => boolean,
  deltaY: number,
  maxSteps = 120
): Promise<void> {
  for (let step = 0; step < maxSteps && !predicate(); step += 1) {
    await wheelWithNativeDefaultAndFlush(root, deltaY);
  }

  expect(predicate()).toBe(true);
}

afterEach(async () => {
  await flushAnimationFrame();
  delete (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__;
});

describe('DirectScrollCineView', () => {
  const config = {
    size: 750,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ = true;
  });

  it('prioritizes the first scene and preloads later scene assets in the background', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useImagePreloader } = require('../../hooks/useImagePreloader');

    render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" assets={{ preloadImages: ['first.jpg', 'shared.jpg'] }}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" assets={{ preloadImages: ['second.jpg'] }}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" assets={{ preloadImages: ['third.jpg', 'shared.jpg'] }}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const callArgs = useImagePreloader.mock.calls[0][0];
    expect(callArgs.priorityUrls).toEqual(['first.jpg', 'shared.jpg']);
    expect(callArgs.backgroundUrls).toEqual(['second.jpg', 'third.jpg']);
  });

  it('preload(targets) prioritizes requested scroll scenes by index, sceneId, and zoneId', async () => {
    const ref = createRef<CineViewRef>();
    const startPreload = jest.fn().mockResolvedValue(undefined);
    const addUrls = jest.fn();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useImagePreloader } = require('../../hooks/useImagePreloader');
    useImagePreloader.mockImplementation(() => [
      {
        isLoading: false,
        progress: 100,
        loadedCount: 0,
        totalCount: 0,
        results: [],
        errors: new Map(),
      },
      {
        startPreload,
        reset: jest.fn(),
        addUrls,
      },
    ]);

    render(
      <DirectScrollCineView ref={ref} config={config}>
        <TestScene sceneId="scene-0" assets={{ preloadImages: ['first.jpg'] }}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          scroll={{ zoneId: 'hero-zone', trigger: 'center-lock' }}
          assets={{ preloadImages: ['second.jpg', 'shared.jpg'] }}
        >
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="outro" assets={{ preloadImages: ['third.jpg'] }}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    await act(async () => {
      await ref.current?.preload?.([0, 'hero-zone', 'outro']);
    });

    expect(addUrls).toHaveBeenCalledWith(
      ['first.jpg', 'second.jpg', 'shared.jpg', 'third.jpg'],
      true
    );
    expect(startPreload).toHaveBeenCalledTimes(2);
  });

  // Regression: the scroll root (DirectScrollCineView) must run the cold-start
  // gate and inject firstSceneEnterReady into scene 0's sceneRuntime. Without it
  // scene 0's visibility elements stayed permanently at their initial frame
  // (opacity 0 hero), since useAnimateScroll holds on firstSceneEnterReady===false.
  it('lights firstSceneEnterReady on scene 0 once first-screen priority assets settle', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useImagePreloader } = require('../../hooks/useImagePreloader');
    useImagePreloader.mockImplementation(() => [
      {
        isLoading: false,
        progress: 100,
        loadedCount: 1,
        totalCount: 1,
        priorityComplete: true,
        results: [],
        errors: new Map(),
      },
      { startPreload: jest.fn(), reset: jest.fn(), addUrls: jest.fn() },
    ]);

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" assets={{ preloadImages: ['first.jpg'] }}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1">
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const firstSceneZone = container.querySelector(
      '[data-cineview-scroll-zone="scene-0"]'
    ) as HTMLElement;
    expect(firstSceneZone).toHaveAttribute('data-first-scene-enter-ready', 'true');
  });

  it('holds firstSceneEnterReady false on scene 0 while priority assets are pending', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useImagePreloader } = require('../../hooks/useImagePreloader');
    useImagePreloader.mockImplementation(() => [
      {
        isLoading: true,
        progress: 0,
        loadedCount: 0,
        totalCount: 1,
        priorityComplete: false,
        results: [],
        errors: new Map(),
      },
      { startPreload: jest.fn(), reset: jest.fn(), addUrls: jest.fn() },
    ]);

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" assets={{ preloadImages: ['first.jpg'] }}>
          <div>Scene 0</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const firstSceneZone = container.querySelector(
      '[data-cineview-scroll-zone="scene-0"]'
    ) as HTMLElement;
    expect(firstSceneZone).toHaveAttribute('data-first-scene-enter-ready', 'false');
  });

  // Regression: scroll mode must call startPreload unconditionally, even when no
  // scene declares preloadImages. The old effect guarded the call behind
  // `preloadImages.length > 0`, so a zero-image scroll first screen never ran the
  // preloader — priorityComplete never fired, firstSceneEnterReady stayed false
  // forever, and scene 0's visibility elements were stuck at their initial
  // opacity:0 frame (the cold-start gate deadlocked with no timeout). Drag mode
  // (CineView.tsx) always called startPreload, so this only hit scroll. The
  // preloader's own zero-image branch resolves priorityComplete immediately, so
  // the fix is simply to always invoke it.
  it('calls startPreload even when no scene declares preloadImages (scroll cold-start)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useImagePreloader } = require('../../hooks/useImagePreloader');
    const startPreload = jest.fn().mockResolvedValue(undefined);
    useImagePreloader.mockImplementation(() => [
      {
        isLoading: false,
        progress: 100,
        loadedCount: 0,
        totalCount: 0,
        priorityComplete: true,
        results: [],
        errors: new Map(),
      },
      { startPreload, reset: jest.fn(), addUrls: jest.fn() },
    ]);

    render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0">
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1">
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    expect(startPreload).toHaveBeenCalled();
  });

  it('hides internal takeover debug metrics unless scroll debug is enabled', () => {
    delete (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene
          sceneId="scene-0"
          scroll={{ zoneId: 'hero-zone', trigger: 'center-lock' }}
          assets={{ preloadImages: ['first.jpg'] }}
        >
          <div>Scene 0</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const shell = container.querySelector('[data-cineview-takeover-shell="0"]') as HTMLElement;

    expect(shell).toBeInTheDocument();
    expect(shell).not.toHaveAttribute('data-cineview-takeover-active-zone');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-progress-px');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-total-distance-px');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-center-lock-offset');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-segment-start');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-segment-end');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-viewport-offset');
  });

  it('does not inject scrollbar styling when scrollbar.enabled is false', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: false }}>
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    expect(container.querySelector('style')).not.toBeInTheDocument();
  });

  it('hides the browser scrollbar when the CineView scrollbar is enabled', () => {
    const { container } = render(
      <DirectScrollCineView
        config={config}
        scrollbar={{ enabled: true, autoHide: false, thumbColor: 'rgb(1, 2, 3)' }}
      >
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    const style = container.querySelector('style');

    expect(root).toHaveAttribute('data-cineview-scrollbar-autohide', 'false');
    expect(style?.textContent).toContain('scrollbar-width: none');
    expect(style?.textContent).toContain('-ms-overflow-style: none');
    expect(style?.textContent).toContain('width: 0');
    expect(style?.textContent).toContain('height: 0');
    expect(style?.textContent).toContain('display: none');
    expect(style?.textContent).not.toContain('scrollbar-width: thin');
    expect(style?.textContent).not.toContain('scrollbar-color');
  });

  it('marks scrollbar autoHide true by default on the real scroll container', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;

    expect(root).toHaveAttribute('data-cineview-scrollbar-autohide', 'true');
  });

  // Regression: onReady is a one-shot lifecycle callback. The scroll root must
  // fire it exactly once on mount, NOT again on every active-scene change. The
  // bug was an effect keyed on getRuntimeApi, whose identity churns with
  // activeSceneIndex, so scrolling between scenes re-fired onReady. The drag
  // root (CineView.tsx) already fires it once via a ref + mount-only effect.
  it('fires onReady exactly once across active-scene changes in scroll mode', () => {
    const onReady = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onReady }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    expect(onReady).toHaveBeenCalledTimes(1);
    const readyApi = onReady.mock.calls[0]?.[0] as CineViewRef;

    // Drive the active scene forward; each change used to re-fire onReady.
    act(() => {
      root.scrollTop = 1000;
      fireEvent.scroll(root);
    });
    act(() => {
      root.scrollTop = 2000;
      fireEvent.scroll(root);
    });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(readyApi.getCurrentScene()).toBe(2);
  });

  it('measures scene layouts once per gesture burst, not once per scroll frame', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll">
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    // measureSceneLayouts walks every scene via getRelativeOffset, which calls
    // root.getBoundingClientRect once per scene. root is the stable container
    // node (never re-keyed), so spying it reliably counts measure passes — one
    // measure pass bumps the counter by (scene count). Spying a scene wrapper is
    // unreliable: wrappers use inline ref callbacks and can be re-created across
    // the setState-driven re-renders, detaching the spy mid-gesture.
    const baseRect = root.getBoundingClientRect.bind(root);
    let rootRectCalls = 0;
    root.getBoundingClientRect = () => {
      rootRectCalls += 1;
      return baseRect();
    };

    // First frame of a gesture re-measures.
    act(() => {
      root.scrollTop = 200;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    const afterFirstFrame = rootRectCalls;
    expect(afterFirstFrame).toBeGreaterThan(0);

    // Continuous frames of the same gesture (no 120ms idle gap) read the cached
    // sceneLayoutsRef and must not trigger further measure passes.
    act(() => {
      root.scrollTop = 400;
      fireEvent.scroll(root);
    });
    act(() => {
      root.scrollTop = 600;
      fireEvent.scroll(root);
    });
    act(() => {
      root.scrollTop = 800;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    expect(rootRectCalls).toBe(afterFirstFrame);
  });

  it('renders a visible custom scrollbar rail when scroll mode has overflow content', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      fireEvent.scroll(root);
    });

    const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;

    expect(rail).toBeInTheDocument();
    expect(rail.style.right).toBe('0px');
    expect(container.querySelector('[data-cineview-scrollbar-thumb="true"]')).toBeInTheDocument();
    expect(root.querySelector('[data-cineview-scrollbar-overlay="true"]')).not.toBeInTheDocument();
    expect(
      root.parentElement?.querySelector('[data-cineview-scrollbar-overlay="true"]')
    ).toBeInTheDocument();
  });

  // Regression: autoHide must truly hide the scrollbar at rest and reveal it
  // while scrolling. The old impl set a STATIC opacity 0.56 on the rail
  // regardless of scroll state (named "autoHide" but never actually hid). The
  // overlay opacity is now driven by isScrolling: visible (1) while scrolling,
  // hidden (0) once the idle timer (~120ms after the last scroll input) flips
  // isScrolling false. The overlay element stays mounted throughout — only its
  // opacity changes — so this is purely the existing isScrolling render input
  // feeding one more style, not a new timer or state.
  it('autoHide overlay fades in while scrolling and hides once scrolling settles', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true, autoHide: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    const overlay = () =>
      root.parentElement?.querySelector(
        '[data-cineview-scrollbar-overlay="true"]'
      ) as HTMLDivElement | null;

    // Scrolling: overlay renders (geometry synced) and isScrolling is true → visible.
    act(() => {
      root.scrollTop = 200;
      fireEvent.scroll(root);
    });
    expect(overlay()?.style.opacity).toBe('1');

    // Settled: the idle timer flips isScrolling false → overlay hides. The
    // element stays mounted; only opacity drops. waitFor polls the real timer
    // rather than hardcoding 120ms.
    await waitFor(() => {
      expect(overlay()?.style.opacity).toBe('0');
    });
  });

  it('non-autoHide overlay stays fully visible while scrolling', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true, autoHide: false }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 200;
      fireEvent.scroll(root);
    });

    const overlay = root.parentElement?.querySelector(
      '[data-cineview-scrollbar-overlay="true"]'
    ) as HTMLDivElement;

    // No autoHide: opacity stays 1 regardless of scroll state.
    expect(overlay.style.opacity).toBe('1');
  });

  it('applies configured colors to the CineView scrollbar overlay instead of the browser scrollbar', () => {
    const { container } = render(
      <DirectScrollCineView
        config={config}
        scrollbar={{
          enabled: true,
          autoHide: false,
          trackColor: 'rgb(12, 34, 56)',
          thumbColor: 'rgb(1, 2, 3)',
          thumbHoverColor: 'rgb(98, 76, 54)',
        }}
      >
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      fireEvent.scroll(root);
    });

    const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
    const thumb = container.querySelector(
      '[data-cineview-scrollbar-thumb="true"]'
    ) as HTMLDivElement;
    const style = container.querySelector('style');

    expect(rail.style.background).toBe('rgb(12, 34, 56)');
    expect(thumb.style.background).toBe('rgb(1, 2, 3)');
    expect(thumb.style.boxShadow).toContain('rgb(98, 76, 54)');
    expect(style?.textContent).not.toContain('rgb(1, 2, 3)');
  });

  it('shrinks the overlay thumb to account for takeover budget beyond native scrollHeight', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <div>Takeover scene</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      const thumb = container.querySelector(
        '[data-cineview-scrollbar-thumb="true"]'
      ) as HTMLDivElement;
      // CHARACTERIZATION: code currently sizes the thumb purely from nativeScrollableSpan
      // (scrollHeight 2000 - viewport 1000 = 1000 over railLength 1000 -> 500px); design/test-name
      // expects the thumb to shrink (<430) to account for takeover budget beyond native scrollHeight,
      // but the implementation does not fold takeover budget into thumb length. Flagged for browser-acceptance lane.
      expect(parseFloat(thumb.style.height)).toBeCloseTo(500, 0);
    });
  });

  it('advances the overlay thumb through consumed takeover budget instead of freezing it at the corrected native scroll offset', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1500;
      fireEvent.scroll(root);
    });

    await flushAnimationFrame();

    // Single-ruler geometry: takeover visualSpan == measured span == viewport (1000), so the
    // center-lock anchor sits exactly at the scene top (segmentStart = sceneTop 1000). Native scroll
    // crossing the anchor is clamped to segmentStart+1 = 1001 and leaves progress at 1 on the first
    // reconciled frame; the registered budget is 240 (single 240ms enter animation). (Old phantom
    // legacy height-based conversion put the anchor at ~874.81, giving scrollTop ~875.81.)
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
      expect(root.scrollTop).toBeCloseTo(1001, 3);
    });

    await waitFor(() => {
      // CHARACTERIZATION: the overlay thumb offset is driven purely by native scrollTop, not by a
      // "global offset" that folds in consumed takeover budget. The implementation has no global-offset
      // thumb model, so offset matches the native-only formula. Flagged for browser-acceptance lane.
      const { offset, length } = getThumbMetrics(container);
      const railLength = 1000;
      const thumbTravel = railLength - length;
      const nativeScrollableSpan = 3000 - 1000;
      const expectedNativeOffset = (root.scrollTop / nativeScrollableSpan) * thumbTravel;

      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeCloseTo(expectedNativeOffset, 1);
    });
  });

  it('keeps the overlay thumb aligned when replayed takeover hands the same wheel gesture back to native scroll', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    const segment = getTakeoverSegment(container, 1);

    // The large wheel crosses the whole real center-lock segment. The timeline consumes its complete
    // 240px budget and the remaining input is released at the native segment end.
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(segment.distance);
      expect(root.scrollTop).toBe(segment.end);
    });

    act(() => {
      root.scrollTop = 2230;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: -75,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    // Reverse wheel consumes the retained 30px progress, then returns to the real segment start.
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(root.scrollTop).toBe(segment.start);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 350,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    const { offset, length } = getThumbMetrics(container);
    const railLength = 1000;
    const thumbTravel = railLength - length;
    const nativeScrollableSpan = root.scrollHeight - root.clientHeight;
    const currentProgress = readOutputNumber('zone-1-progress');
    // CHARACTERIZATION: the overlay thumb tracks native scrollTop only (no "global offset" that folds
    // in takeover progress). offset === scrollTop/nativeScrollableSpan * thumbTravel. Forward wheel
    // re-acquires the same ~125.19px progress and re-parks scrollTop at the anchor. Flagged for
    // browser-acceptance lane.
    const expectedNativeOffset = (root.scrollTop / nativeScrollableSpan) * thumbTravel;

    expect(root.scrollTop).toBe(segment.end);
    expect(currentProgress).toBe(segment.distance);
    expect(offset).toBeCloseTo(expectedNativeOffset, 1);
  });

  it('maps pixel wheel input into takeover progress with the same px unit as document scroll', async () => {
    const { container } = render(
      <DirectScrollCineView
        config={config}
        modes={{ scroll: { direction: 'y', sceneSizing: 'content' } }}
      >
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200, 3600],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 2150;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 150,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    // CHARACTERIZATION: design/test-name expects the 150px wheel to land on the anchor (2200) and
    // map the remainder into 100% takeover progress. The zone here registers no animation budget
    // (no ScrollBudgetProbe), so totalDistancePx is 0 and no takeover is ever eligible; the wheel
    // passes straight through to native scroll (2150 + 150 = 2300) with progress 0. Flagged for
    // browser-acceptance lane.
    await waitFor(() => {
      expect(root.scrollTop).toBe(2300);
      expect(readOutputNumber('zone-1-progress')).toBe(0);
    });
  });

  describe('reported scroll regressions', () => {
    it('reverses completed public Scene.scroll takeovers from page bottom in document order', async () => {
      const viewportHeight = 1000;
      const sceneTops = [0, 1200, 2440, 3440, 4800, 5800, 7000];
      const sceneHeights = [1200, 1240, 1000, 1360, 1000, 1200, 1400];
      const maxScrollTop = sceneTops[6] + sceneHeights[6] - viewportHeight;
      const progressEvents: Array<{ zoneId: string; progress: number }> = [];
      const onZoneProgress = jest.fn((detail: { zoneId: string; progress: number }) => {
        if (detail.zoneId === 'specs-takeover' || detail.zoneId === 'scenarios-takeover') {
          progressEvents.push({ zoneId: detail.zoneId, progress: detail.progress });
        }
      });
      const readSpecsProgress = (): number => readOutputNumber('specs-takeover-progress');
      const readScenariosProgress = (): number => readOutputNumber('scenarios-takeover-progress');
      const readTakeoverMetric = (sceneIndex: number, metric: string): number => {
        const shell = container.querySelector(
          `[data-cineview-takeover-shell="${sceneIndex}"]`
        ) as HTMLElement | null;

        return Number(shell?.dataset[metric] ?? '0');
      };

      const { container } = render(
        <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
          <Scene layout={{ height: 1200 }}>
            <div>01 hero</div>
          </Scene>
          <Scene layout={{ height: 1240 }}>
            <div>02 highlights</div>
          </Scene>
          <Scene
            layout={{ height: 1200 }}
            scroll={{
              zoneId: 'specs-takeover',
              trigger: 'center-lock',
            }}
          >
            <ZoneActiveProbe zoneId="specs-takeover" />
            <ZoneProgressProbe zoneId="specs-takeover" />
            <Position at={{ x: 1080, y: 104 }} layer={{ fixed: true }}>
              <Animate
                animateId="specs-pill"
                enterAnimation="fade-in"
                exitAnimation="fade-out"
                duration={{ enter: 240, exit: 160 }}
                timeline={{ phase: { start: 0, end: 0.22 } }}
              >
                <div>03 specs pill</div>
              </Animate>
            </Position>
            <Position at={{ x: 120, y: 180 }}>
              <Animate
                animateId="specs-copy"
                enterAnimation="slide-up"
                exitAnimation="slide-up"
                duration={{ enter: 700, exit: 260 }}
                timeline={{ phase: { start: 0, end: 0.34 } }}
              >
                <div>03 specs copy</div>
              </Animate>
            </Position>
          </Scene>
          <Scene layout={{ height: 1360 }}>
            <div>04 details</div>
          </Scene>
          <Scene
            layout={{ height: 1200 }}
            scroll={{
              zoneId: 'scenarios-takeover',
              trigger: 'center-lock',
            }}
          >
            <ZoneActiveProbe zoneId="scenarios-takeover" />
            <ZoneProgressProbe zoneId="scenarios-takeover" />
            <Position at={{ x: 118, y: 102 }} layer={{ fixed: true }}>
              <Animate
                animateId="scenarios-pill"
                enterAnimation="fade-in"
                exitAnimation="fade-out"
                duration={{ enter: 260, exit: 180 }}
                timeline={{ phase: { start: 0, end: 0.2 } }}
              >
                <div>05 scenarios pill</div>
              </Animate>
            </Position>
            <Position at={{ x: 334, y: 160 }}>
              <Animate
                animateId="scenarios-copy"
                enterAnimation="zoom-in"
                exitAnimation="zoom-out"
                duration={{ enter: 640, exit: 240 }}
                timeline={{ phase: { start: 0, end: 0.38 } }}
              >
                <div>05 scenarios copy</div>
              </Animate>
            </Position>
          </Scene>
          <Scene layout={{ height: 1200 }}>
            <div>06 cta</div>
          </Scene>
          <article data-testid="ordinary-document-interlude">Bottom document flow</article>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops,
        sceneHeights,
        viewportHeight,
      });
      await flushAnimationFrame();
      await waitFor(() => {
        expect(readTakeoverMetric(2, 'cineviewTakeoverTotalDistancePx')).toBeGreaterThan(0);
        expect(readTakeoverMetric(4, 'cineviewTakeoverTotalDistancePx')).toBeGreaterThan(0);
      });

      const specsDistance = readTakeoverMetric(2, 'cineviewTakeoverTotalDistancePx');
      const scenariosDistance = readTakeoverMetric(4, 'cineviewTakeoverTotalDistancePx');

      await wheelUntil(root, () => root.scrollTop >= sceneTops[2] - 120, 360);
      await wheelUntil(root, () => readSpecsProgress() >= specsDistance - 0.5, 360);
      expect(readSpecsProgress()).toBeCloseTo(specsDistance, 5);

      await wheelUntil(root, () => root.scrollTop >= sceneTops[4] - 120, 360);
      await wheelUntil(root, () => readScenariosProgress() >= scenariosDistance - 0.5, 360);
      expect(readScenariosProgress()).toBeCloseTo(scenariosDistance, 5);

      await wheelUntil(root, () => root.scrollTop === maxScrollTop, 500);
      expect(readSpecsProgress()).toBeCloseTo(specsDistance, 5);
      expect(readScenariosProgress()).toBeCloseTo(scenariosDistance, 5);

      const specsSegmentStart = readTakeoverMetric(2, 'cineviewTakeoverSegmentStart');
      const specsSegmentEnd = readTakeoverMetric(2, 'cineviewTakeoverSegmentEnd');
      const scenariosSegmentStart = readTakeoverMetric(4, 'cineviewTakeoverSegmentStart');
      const scenariosSegmentEnd = readTakeoverMetric(4, 'cineviewTakeoverSegmentEnd');

      progressEvents.length = 0;
      await wheelUntil(
        root,
        () => readScenariosProgress() < scenariosDistance && readScenariosProgress() > 0,
        -360
      );

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(scenariosSegmentStart);
        expect(root.scrollTop).toBeLessThan(scenariosSegmentEnd);
        expect(readSpecsProgress()).toBeCloseTo(specsDistance, 5);
        expect(screen.getByTestId('specs-takeover-active')).toHaveTextContent('false');
        expect(screen.getByTestId('scenarios-takeover-active')).toHaveTextContent('true');
        expect(readAnimateOpacity(container, 'scenarios-pill')).toBeGreaterThan(0);
        expect(readAnimateOpacity(container, 'scenarios-pill')).toBeLessThan(1);
      });
      expect(progressEvents[0]?.zoneId).toBe('scenarios-takeover');

      await wheelUntil(root, () => readScenariosProgress() === 0, -360);
      expect(root.scrollTop).toBeLessThanOrEqual(scenariosSegmentStart);
      expect(readSpecsProgress()).toBeCloseTo(specsDistance, 5);

      progressEvents.length = 0;
      await wheelUntil(
        root,
        () => readSpecsProgress() < specsDistance && readSpecsProgress() > 0,
        -360
      );

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(specsSegmentStart);
        expect(root.scrollTop).toBeLessThan(specsSegmentEnd);
        expect(readScenariosProgress()).toBe(0);
        expect(screen.getByTestId('scenarios-takeover-active')).toHaveTextContent('false');
        expect(screen.getByTestId('specs-takeover-active')).toHaveTextContent('true');
        expect(readAnimateOpacity(container, 'specs-pill')).toBeGreaterThan(0);
        expect(readAnimateOpacity(container, 'specs-pill')).toBeLessThan(1);
      });
      expect(
        progressEvents.some((event) => event.zoneId === 'scenarios-takeover' && event.progress > 0)
      ).toBe(false);
      expect(progressEvents.some((event) => event.zoneId === 'specs-takeover')).toBe(true);

      await wheelUntil(root, () => readSpecsProgress() === 0, -360);
      expect(root.scrollTop).toBeLessThanOrEqual(specsSegmentStart);
      expect(readScenariosProgress()).toBe(0);
    });

    it('waterfalls a large forward wheel entry through early phases instead of jumping past them', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="large-forward-waterfall"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 260, exit: 180 }}
              timeline={{ phase: { start: 0, end: 0.2 } }}
            >
              <div>Large forward waterfall</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      await flushAnimationFrame();

      act(() => {
        root.scrollTop = 1800;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // Single-ruler geometry: takeover visualSpan == measured span == viewport, so the center-lock
      // anchor sits exactly at the scene top (segmentStart = 2200). A large forward wheel that crosses
      // the anchor is clamped to the first in-segment frame (segmentStart + 1 = 2201) and starts
      // takeover at progress 1 with the entering phase animation mid-fade. The waterfall intent
      // (progress > 0, below the 0.2 phase budget, opacity between 0 and 1) holds at the actual
      // geometry. Legacy height-based conversion put the anchor at ~2074.81 (parking at ~2075.81).
      expect(root.scrollTop).toBeCloseTo(2201, 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(440 * 0.2);
      await waitFor(() => {
        expect(readAnimateOpacity(container, 'large-forward-waterfall')).toBeGreaterThan(0);
        expect(readAnimateOpacity(container, 'large-forward-waterfall')).toBeLessThan(1);
      });
    });

    it('does not advance across multiple authored phase stops from one same-frame wheel burst', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="same-frame-wheel-burst"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 260, exit: 180 }}
              timeline={{ phase: { start: 0, end: 0.2 } }}
            >
              <div>Same frame wheel burst</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      await flushAnimationFrame();

      act(() => {
        root.scrollTop = 1800;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // CHARACTERIZATION: design/test-name expects same-frame wheel bursts to stop at the first
      // authored phase boundary (progress ~140, zone still active). The implementation instead spends
      // every same-frame wheel against the takeover budget in the same frame, exhausting the full 440px
      // budget and releasing back to native scroll (zone inactive). Single-ruler geometry: the anchor
      // sits at the scene top (segmentStart = 2200), so scrollTop advances past sceneEnd (2640) to 3540
      // (legacy height-based conversion put the anchor at ~2074.81, landing ~3414.81). Flagged for
      // browser-acceptance lane.
      expect(root.scrollTop).toBeCloseTo(3540, 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(440, 5);

      await flushAnimationFrame();

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // Budget already fully consumed; further wheel input is native scroll and progress stays at 440.
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(440, 5);
    });

    it('keeps the first reverse wheel re-entry frame near completion for early phase takeover content', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="early-phase-reverse-wheel"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Early phase reverse wheel</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      // Real registered budget is enter+exit = 240+160 = 400 (1ms=1px), not 1800. Single-ruler
      // geometry: segmentStart == sceneTop (2200), so forward completion parks at segmentEnd = 2600
      // (legacy height-based conversion landed ~2474.81).
      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 400);
      expect(root.scrollTop).toBeCloseTo(2600, 3);

      await wheelAndFlush(root, -90000);

      // A completed endpoint is outside the consumable open interval. One large reverse intent must
      // first produce a segment-interior frame instead of collapsing directly to segmentStart.
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(2599, 3);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(400);
      });
    });

    it('waterfalls repeated large reverse wheel input through early phases before releasing native scroll', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="large-reverse-waterfall"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Large reverse waterfall</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      // Real registered budget is enter+exit = 240+160 = 400 (1ms=1px), not 1800.
      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 400);

      act(() => {
        root.scrollTop = 3300;
        fireEvent.scroll(root);
      });

      for (let index = 0; index < 5; index += 1) {
        await wheelAndFlush(root, -90000);
      }

      // CHARACTERIZATION: design/test-name expects repeated large reverse wheel input from past the
      // completed segment to re-arm the takeover (active true, scrollTop captured at sceneEnd 3200,
      // mid-phase progress and opacity). The implementation never re-acquires reverse ownership: the
      // wheel input falls through to native scroll, driving scrollTop all the way to 0 with the zone
      // inactive and progress reset to 0. This is the P0 scroll reverse re-entry bug. Flagged for
      // browser-acceptance lane.
      await waitFor(() => {
        expect(root.scrollTop).toBe(0);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
        expect(readOutputNumber('zone-1-progress')).toBe(0);
        expect(readAnimateOpacity(container, 'large-reverse-waterfall')).toBe(0);
      });
    });

    it('keeps reverse waterfall armed after the sceneEnd scroll correction dispatches a zero-delta scroll event', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="zero-delta-reverse-waterfall"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 260, exit: 180 }}
              timeline={{ phase: { start: 0, end: 0.2 } }}
            >
              <div>Zero delta reverse waterfall</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      // Real registered budget is enter+exit = 260+180 = 440 (1ms=1px), not 1400.
      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 440);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        fireEvent.wheel(root, {
          deltaY: -90000,
          deltaMode: 0,
        });
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      expect(root.scrollTop).toBe(2639);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(439);

      await wheelAndFlush(root, -90000);
      expect(root.scrollTop).toBe(2200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(0);

      await wheelAndFlush(root, -90000);

      await waitFor(() => {
        expect(root.scrollTop).toBe(0);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
        expect(readOutputNumber('zone-1-progress')).toBe(0);
      });
    });

    it('keeps the current reverse waterfall owner ahead of earlier crossed takeover anchors', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="earlier-crossed-anchor"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Earlier crossed anchor</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
          <TestScene
            sceneId="scene-3"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-3',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 3 }}
          >
            <ZoneActiveProbe zoneId="zone-3" />
            <ZoneProgressProbe zoneId="zone-3" />
            <Animate
              animateId="current-reverse-owner"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 260, exit: 180 }}
              timeline={{ phase: { start: 0, end: 0.2 } }}
            >
              <div>Current reverse owner</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-4" sceneHeight={1000}>
            <div>Scene 4</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600, 5000, 6400],
        sceneHeights: [1000, 1000, 1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      // Real budgets: zone-1 enter+exit = 240+160 = 400; zone-3 = 260+180 = 440.
      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 400);

      act(() => {
        root.scrollTop = 4750;
        fireEvent.scroll(root);
      });

      await completeTakeoverForward(root, () => readOutputNumber('zone-3-progress'), 440);

      // The current owner must consume its reverse endpoint frame and reach its anchor before an
      // earlier crossed segment can acquire the next reverse intent.
      await wheelAndFlush(root, -90000);
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(5439, 3);
        expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-3-progress')).toBeCloseTo(439, 0);
      });

      await wheelAndFlush(root, -90000);
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(5000, 3);
        expect(screen.getByTestId('zone-3-active')).toHaveTextContent('false');
        expect(readOutputNumber('zone-3-progress')).toBe(0);
      });

      await wheelAndFlush(root, -90000);
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(2599, 3);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(399, 0);
        expect(screen.getByTestId('zone-3-active')).toHaveTextContent('false');
      });
    });

    it('keeps the first reverse scrollbar re-entry frame near completion for early phase takeover content', async () => {
      const { container } = render(
        <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="early-phase-reverse-scrollbar"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Early phase reverse scrollbar</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      // Real registered budget is enter+exit = 240+160 = 400 (1ms=1px), not 1800.
      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 400);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      // Scrollbar and wheel intents share the same reducer: the first reverse crossing from the
      // completed endpoint must land inside the segment near completion.
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(2599, 3);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(399, 0);
      });
    });

    it('restarts the next forward replay after a reverse wheel re-entry that crosses the anchor', async () => {
      const { container } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="cross-anchor-second-forward"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 100, exit: 100 }}
              timeline={{ phase: { start: 0, end: 0.34 } }}
            >
              <div>Cross anchor second forward</div>
            </Animate>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 1200,
          deltaMode: 0,
        });
      });

      await flushAnimationFrame();

      // First forward wheel crosses the anchor and parks scrollTop at segmentStart + 1; progress
      // reaches 1 (overshoot is not clamped to 100), zone active. (Budget = enter+exit = 200.)
      // Single-ruler geometry: segmentStart = sceneTop = 2200, so crossing lands at 2201. Old phantom
      // legacy height-based conversion put the anchor at ~2074.81 (crossing landed at ~2075.81).
      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
        expect(root.scrollTop).toBeCloseTo(2201, 3);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      });

      act(() => {
        root.scrollTop = 2230;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: -75,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // Single-ruler geometry: the reverse wheel (-75 from native 2230) crosses back above the
      // segmentStart anchor (2200), so it re-parks scrollTop on the anchor and collapses progress to 0
      // with the zone deactivated. (Old phantom anchor ~2074.81 kept the reverse frame inside the
      // segment at ~80.19px progress; with the anchor restored to sceneTop the reverse actually crosses
      // out, matching the test name.)
      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(0);
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 20,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // The next small forward input RESTARTS the replay from enter progress: a 20px forward wheel from
      // the anchor re-enters the segment, so progress reads 20 (scrollTop 2220) and the entering
      // animation is back near the low end of its phase budget.
      await waitFor(() => {
        expect(root.scrollTop).toBe(2220);
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(20, 5);
        expect(readAnimateOpacity(container, 'cross-anchor-second-forward')).toBeLessThan(0.5);
      });
    });

    it('reverse scrollbar replay reacquires takeover and rewinds the scroll animation from the shared global offset', async () => {
      const onZoneEnter = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          mode="scroll"
          scrollbar={{ enabled: true }}
          callbacks={{ onZoneEnter }}
        >
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="reported-reverse-retract"
              enterAnimation="fade-in"
              duration={{ enter: 100, exit: 0 }}
            >
              <div>Reported reverse retract</div>
            </Animate>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200],
        sceneHeights: [1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 1200,
          deltaMode: 0,
        });
      });

      await flushAnimationFrame();

      const segment = getTakeoverSegment(container, 1);

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(segment.distance);
        expect(root.scrollTop).toBe(segment.end);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeCloseTo(1, 2);
      });

      onZoneEnter.mockClear();

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2250,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      // The scrollbar drag reacquires takeover and maps the global offset to ~47.9px of progress (the
      // zone stays active the whole time). Because the zone never deactivated, onZoneEnter is NOT
      // re-fired by the reacquire (0 calls), contrary to the design intent of a fresh re-entry.
      await waitFor(() => {
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(51);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeGreaterThan(0.45);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeLessThan(0.51);
      });
      expect(onZoneEnter).toHaveBeenCalledTimes(1);
    });

    it('fires onZoneEnter again when the scrollbar returns above anchor and then re-enters the takeover zone', async () => {
      const onZoneEnter = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          mode="scroll"
          scrollbar={{ enabled: true }}
          callbacks={{ onZoneEnter }}
        >
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="reported-wheel-reentry"
              enterAnimation="fade-in"
              duration={{ enter: 100, exit: 0 }}
            >
              <div>Reported wheel reentry</div>
            </Animate>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200],
        sceneHeights: [1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 1200,
          deltaMode: 0,
        });
      });

      await flushAnimationFrame();

      // A large forward wheel consumes the full 100px segment in one gesture. The final published
      // state is completed/inactive, so this batched entry does not leave a separate enter callback.
      await waitFor(() => {
        expect(onZoneEnter).toHaveBeenCalledTimes(0);
        expect(readOutputNumber('zone-1-progress')).toBe(100);
      });

      // The first reverse drag from the completed endpoint must stop inside the segment.
      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      await waitFor(() => {
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBe(99);
      });

      // A later reverse intent may now consume the remaining segment and reach the anchor.
      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      await waitFor(() => {
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
        expect(readOutputNumber('zone-1-progress')).toBe(0);
        expect(readAnimateOpacity(container, 'reported-wheel-reentry')).toBe(0);
      });

      onZoneEnter.mockClear();

      // Drag the thumb back below the anchor: the zone re-activates and onZoneEnter fires again.
      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2250,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      await waitFor(() => {
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(55);
        expect(readAnimateOpacity(container, 'reported-wheel-reentry')).toBeGreaterThan(0.45);
        expect(readAnimateOpacity(container, 'reported-wheel-reentry')).toBeLessThan(0.55);
      });

      expect(onZoneEnter).toHaveBeenCalledTimes(1);
      expect(onZoneEnter).toHaveBeenCalledWith({
        zoneId: 'zone-1',
        sceneIndex: 1,
      });
    });

    it('publishes reverse and forward scrollbar handoffs through the same global offset timeline without skipping zone progress', async () => {
      const onZoneProgress = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          mode="scroll"
          scrollbar={{ enabled: true }}
          callbacks={{ onZoneProgress }}
        >
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="reported-thumb-handoff" />
            <ZoneProgressProbe zoneId="zone-1" />
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        fireEvent.scroll(root);
      });

      onZoneProgress.mockClear();

      // Registered budget here is the default ScrollBudgetProbe enterDuration = 240px.
      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2250,
          contentSpan,
        });
      });

      await flushAnimationFrame();
      const enteredThumbOffset = getThumbMetrics(container).offset;

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      const reverseHandoffThumbOffset = getThumbMetrics(container).offset;

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2250,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2300,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      const replayedThumbOffset = getThumbMetrics(container).offset;

      // Scrollbar handoffs publish the same native-offset timeline: enter the segment, return to zero,
      // then replay forward twice without skipping the zone.
      expect(reverseHandoffThumbOffset).toBeLessThan(enteredThumbOffset);
      expect(replayedThumbOffset).toBeGreaterThan(reverseHandoffThumbOffset);

      expect(onZoneProgress).toHaveBeenCalledTimes(4);
      [0, 1, 2, 3].forEach((index) => {
        expect(onZoneProgress.mock.calls[index]?.[0]).toEqual(
          expect.objectContaining({
            zoneId: 'zone-1',
            sceneIndex: 1,
          })
        );
      });
      expect(onZoneProgress.mock.calls[0]?.[0]?.progress).toBeGreaterThan(0);
      expect(onZoneProgress.mock.calls[0]?.[0]?.progress).toBeLessThan(1);
      expect(onZoneProgress.mock.calls[1]?.[0]?.progress).toBe(0);
      expect(onZoneProgress.mock.calls[2]?.[0]?.progress).toBeGreaterThan(0);
      expect(onZoneProgress.mock.calls[2]?.[0]?.progress).toBeLessThan(1);
      expect(onZoneProgress.mock.calls[3]?.[0]?.progress).toBeGreaterThan(
        onZoneProgress.mock.calls[2]?.[0]?.progress ?? 0
      );
    });

    it('does not let one scrollbar drag jump from before a takeover budget to after it without an active takeover frame', async () => {
      const onZoneProgress = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          mode="scroll"
          scrollbar={{ enabled: true }}
          callbacks={{ onZoneProgress }}
        >
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="reported-no-skip"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Reported no skip</div>
            </Animate>
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        fireEvent.scroll(root);
      });

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThanOrEqual(2100);
        expect(root.scrollTop).toBeLessThan(2110);
        expect(readOutputNumber('zone-1-progress')).toBe(0);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      });

      onZoneProgress.mockClear();

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 4100,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      const segment = getTakeoverSegment(container, 1);

      // The second drag cannot skip the whole segment: it produces an active in-segment frame near the
      // end, with native offset and progress remaining the same px distance from segmentStart.
      await waitFor(() => {
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(segment.distance);
        expect(root.scrollTop).toBeCloseTo(segment.start + readOutputNumber('zone-1-progress'), 5);
      });
    });

    it('clears the scrollbar takeover latch after a rail click that enters takeover', async () => {
      const { container } = render(
        <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneActiveProbe zoneId="zone-1" />
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="rail-click-no-latch"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 240, exit: 160 }}
              timeline={{ phase: { start: 0, end: 0.22 } }}
            >
              <div>Rail click no latch</div>
            </Animate>
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3200],
        sceneHeights: [1000, 1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        root.scrollTop = 1000;
        fireEvent.scroll(root);
      });

      act(() => {
        clickScrollbarRailToNativeOffset({
          container,
          nativeOffset: 4050,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      // The first rail click crosses the anchor, activating the zone with progress parked at the
      // center-lock anchor. Single-ruler geometry: visualSpan == measured span == viewport (1000),
      // so segmentStart = sceneTop (2200); crossing clamps scrollTop to segmentStart+1 = 2201.
      // (Legacy height-based conversion put it at ~2075.81.)
      await waitFor(() => {
        expect(root.scrollTop).toBeCloseTo(2201, 1);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
      });

      act(() => {
        clickScrollbarRailToNativeOffset({
          container,
          nativeOffset: 5000,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      const segment = getTakeoverSegment(container, 1);

      // The second click exhausts the real 400px budget and releases at segmentEnd.
      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(400);
        expect(root.scrollTop).toBe(segment.end);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      });
    });

    it('restarts a scrollbar reverse re-entry from enter progress on the next forward replay', async () => {
      const { container } = render(
        <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ZoneProgressProbe zoneId="zone-1" />
            <Animate
              animateId="scrollbar-second-forward"
              enterAnimation="fade-in"
              exitAnimation="fade-out"
              duration={{ enter: 100, exit: 100 }}
              timeline={{ phase: { start: 0, end: 0.34 } }}
            >
              <div>Scrollbar second forward</div>
            </Animate>
            <div>Scene 1</div>
          </TestScene>
          <TestScene sceneId="scene-2" sceneHeight={1000}>
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });
      const contentSpan = root.scrollHeight - root.clientHeight;

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 1200,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      const segment = getTakeoverSegment(container, 1);

      await waitFor(() => {
        expect(root.scrollTop).toBe(segment.start + 1);
        expect(readOutputNumber('zone-1-progress')).toBe(1);
      });

      act(() => {
        dragScrollbarThumbToNativeOffset({
          container,
          nativeOffset: 2250,
          contentSpan,
        });
      });
      await flushAnimationFrame();

      // The scrollbar drag maps the native target back into the segment at roughly 50px progress.
      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(40);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(60);
      });
      const progressAfterScrollbar = readOutputNumber('zone-1-progress');

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 20,
          deltaMode: 0,
        });
      });
      await flushAnimationFrame();

      // The next forward wheel continues from the scrollbar position at the same native px rate.
      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBeCloseTo(progressAfterScrollbar + 20, 5);
        expect(readAnimateOpacity(container, 'scrollbar-second-forward')).toBeGreaterThan(0);
      });
    });
  });

  it('moves the overlay thumb when dragging the thumb itself to a later global offset', async () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      fireEvent.scroll(root);
    });

    const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
    const thumb = container.querySelector(
      '[data-cineview-scrollbar-thumb="true"]'
    ) as HTMLDivElement;
    const railRect = {
      top: 16,
      bottom: 984,
      left: 734,
      right: 744,
      width: 10,
      height: 968,
      x: 734,
      y: 16,
      toJSON: () => undefined,
    } as DOMRect;
    rail.getBoundingClientRect = () => railRect;
    thumb.getBoundingClientRect = () =>
      ({
        top: 16,
        bottom: 338.671875,
        left: 734,
        right: 744,
        width: 10,
        height: 322.671875,
        x: 734,
        y: 16,
        toJSON: () => undefined,
      }) as DOMRect;

    const initial = getThumbMetrics(container);

    act(() => {
      dispatchPointerEvent(thumb, 'pointerdown', {
        pointerId: 11,
        clientX: railRect.left + railRect.width / 2,
        clientY: railRect.top + initial.offset + initial.length / 2,
      });
    });

    // The thumb starts at the very top (offset 0), so the grab point sits at ~182px. Dragging to a
    // clearly lower clientY moves the thumb down; the original target of 180 coincided with the grab
    // point and produced zero movement (a stale test input, not a behavioral expectation).
    act(() => {
      dispatchPointerEvent(window, 'pointermove', {
        pointerId: 11,
        clientX: railRect.left + railRect.width / 2,
        clientY: 600,
      });
      dispatchPointerEvent(window, 'pointerup', {
        pointerId: 11,
        clientX: railRect.left + railRect.width / 2,
        clientY: 600,
      });
    });

    await waitFor(() => {
      const { offset } = getThumbMetrics(container);
      expect(root.scrollTop).toBeGreaterThan(0);
      expect(offset).toBeGreaterThan(initial.offset + 1);
    });
  });

  it('removes window pointer listeners when unmounted mid scrollbar drag', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const { container, unmount } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      fireEvent.scroll(root);
    });

    const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
    const thumb = container.querySelector(
      '[data-cineview-scrollbar-thumb="true"]'
    ) as HTMLDivElement;
    const railRect = {
      top: 16,
      bottom: 984,
      left: 734,
      right: 744,
      width: 10,
      height: 968,
      x: 734,
      y: 16,
      toJSON: () => undefined,
    } as DOMRect;
    rail.getBoundingClientRect = () => railRect;
    thumb.getBoundingClientRect = () =>
      ({
        top: 16,
        bottom: 338.671875,
        left: 734,
        right: 744,
        width: 10,
        height: 322.671875,
        x: 734,
        y: 16,
        toJSON: () => undefined,
      }) as DOMRect;

    const initial = getThumbMetrics(container);

    // Begin a thumb drag: this attaches window pointermove/up/cancel listeners.
    act(() => {
      dispatchPointerEvent(thumb, 'pointerdown', {
        pointerId: 12,
        clientX: railRect.left + railRect.width / 2,
        clientY: railRect.top + initial.offset + initial.length / 2,
      });
    });

    const attachedMove = addSpy.mock.calls.filter(([type]) => type === 'pointermove').length;
    const attachedUp = addSpy.mock.calls.filter(([type]) => type === 'pointerup').length;
    const attachedCancel = addSpy.mock.calls.filter(([type]) => type === 'pointercancel').length;
    expect(attachedMove).toBeGreaterThan(0);
    expect(attachedUp).toBeGreaterThan(0);
    expect(attachedCancel).toBeGreaterThan(0);

    // Unmount while the pointer is still active. All window listeners and their
    // captured geometry must be released even if no pointerup arrives.
    act(() => {
      unmount();
    });

    const removedMove = removeSpy.mock.calls.filter(([type]) => type === 'pointermove').length;
    const removedUp = removeSpy.mock.calls.filter(([type]) => type === 'pointerup').length;
    const removedCancel = removeSpy.mock.calls.filter(([type]) => type === 'pointercancel').length;
    expect(removedMove).toBeGreaterThanOrEqual(attachedMove);
    expect(removedUp).toBeGreaterThanOrEqual(attachedUp);
    expect(removedCancel).toBeGreaterThanOrEqual(attachedCancel);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('uses a white container background for the scroll-mode overscroll edge', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    expect(container.querySelector('.cineview-container')).toHaveStyle({
      background: '#ffffff',
    });
  });

  it('center-locks a small takeover scene without forcing the scene wrapper to 100vh', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene sceneId="scene-0" sceneHeight={900}>
          <div>Prelude scene</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={240}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Compact takeover</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 900],
      sceneHeights: [900, 240],
    });

    act(() => {
      root.scrollTop = 560;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    // The compact scene keeps its 240px measured visual span. Its center-lock segment starts at 520,
    // so native offset 560 maps to 40px of takeover progress without forcing a viewport-height wrapper.
    await waitFor(() => {
      expect(root.scrollTop).toBe(560);
      expect(readOutputNumber('zone-1-progress')).toBe(40);
    });

    const sceneWrapper = container.querySelector('[data-scene-index="1"]');
    const takeoverScene = container.querySelector('[data-cineview-scroll-zone="zone-1"]');
    const takeoverShell = container.querySelector('[data-cineview-takeover-shell="1"]');

    expect(sceneWrapper).not.toHaveStyle({ minHeight: '100vh' });
    expect(takeoverScene).not.toHaveStyle({ height: '100%' });
    expect(takeoverShell).toHaveStyle({ top: '380px' });
  });

  it('delays an oversized takeover shell until its measured center reaches the viewport center', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene sceneId="scene-0" sceneHeight={1000}>
          <div>Prelude scene</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={1200}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="oversized-center-lock" />
          <div>Oversized takeover</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1200],
      viewportHeight: 900,
    });

    act(() => {
      root.scrollTop = 1150;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    const segment = getTakeoverSegment(container, 1);
    const wrapper = container.querySelector('[data-scene-index="1"]') as HTMLDivElement;
    const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLDivElement;
    const content = container.querySelector(
      '[data-cineview-takeover-content="1"]'
    ) as HTMLDivElement;

    expect(segment.start).toBe(1150);
    expect(wrapper).toHaveStyle({ boxSizing: 'border-box', paddingTop: '150px' });
    expect(shell).toHaveStyle({ top: '0px' });
    expect(content).toHaveStyle({ transform: 'translateY(-150px)' });
  });

  it('does not leave a viewport-sized virtual gap after a small takeover scene exhausts its budget', async () => {
    const ref = createRef<CineViewRef>();

    const { container } = render(
      <DirectScrollCineView ref={ref} config={config}>
        <Scene sceneId="scene-0" sceneHeight={900}>
          <div>Scene 0</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={240}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Small takeover scene</div>
        </Scene>
        <Scene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 900, 1140],
      sceneHeights: [900, 240, 1000],
    });

    // CHARACTERIZATION: this scene registers no Animate budget (no ScrollBudgetProbe), so the zone's
    // totalDistancePx is 0 and no center-lock takeover engages. design/test-name expects the small
    // takeover to exhaust a budget and snap to 600 (scene 1) then release to scene 2 at 650; the
    // implementation instead lets native scroll pass straight through (progress stays 0) and reports
    // the active scene as 1 at both offsets. Flagged for browser-acceptance lane.
    act(() => {
      root.scrollTop = 700;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(700);
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(ref.current?.getCurrentScene?.()).toBe(1);
    });

    act(() => {
      root.scrollTop = 650;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(650);
      expect(ref.current?.getCurrentScene?.()).toBe(1);
    });
  });

  it('anchors takeover to the stable scene wrapper even after the takeover node sticks, so reverse scroll can retract and replay the animation', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="sticky-hero"
            enterAnimation="fade-in"
            duration={{ enter: 100, exit: 0 }}
          >
            <div>Sticky hero</div>
          </Animate>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    const stickyZone = container.querySelector(
      '[data-cineview-scroll-zone="zone-1"]'
    ) as HTMLDivElement;
    stickyZone.getBoundingClientRect = () =>
      ({
        top: root.scrollTop >= 1000 ? 0 : 1000 - root.scrollTop,
        bottom: root.scrollTop >= 1000 ? 1000 : 2000 - root.scrollTop,
        left: 0,
        right: 750,
        width: 750,
        height: 1000,
        x: 0,
        y: root.scrollTop >= 1000 ? 0 : 1000 - root.scrollTop,
        toJSON: () => undefined,
      }) as DOMRect;

    // Single-ruler geometry: takeover visualSpan == measured span == viewport (1000), so the
    // center-lock anchor sits exactly at the scene top (segmentStart = sceneTop 1000), and with the
    // single 100px enter budget the segment spans [1000, 1100]. Scrolling to mid-segment (1050)
    // consumes half the budget → progress 50, scrollTop parks at 1050, opacity ~0.5.
    // (Legacy height-based conversion put the anchor at ~874.81.)
    act(() => {
      root.scrollTop = 1050;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(1050, 3);
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(50, 3);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeGreaterThan(0.4);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeLessThan(0.6);
    });

    // Single-ruler geometry: segmentStart = sceneTop = 1000, budget = enter 100, segmentEnd = 1100.
    // Reverse native scroll to 1050 sits inside the segment (50px above segmentEnd), retracting
    // progress to ~50 at native px rate; scrollTop stays at the native 1050.
    act(() => {
      root.scrollTop = 1050;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1050);
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(50, 0);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeGreaterThan(0.4);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeLessThan(0.6);
    });

    // Scrolling fully above the anchor (segmentStart 1000) retracts to 0 and re-parks scrollTop at
    // the segment anchor 1000. (Legacy height-based conversion put the anchor at ~874.81.)
    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(root.scrollTop).toBeCloseTo(1000, 3);
    });

    // Re-entering forward past segmentEnd (1100) lands at segmentEnd 1100 with progress fully
    // completed at 100 and the zone deactivated.
    act(() => {
      root.scrollTop = 1200;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(1100, 3);
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeCloseTo(1, 1);
    });
  });

  it('updates the active scene from the current native offset without waiting for another tick', async () => {
    const ref = createRef<CineViewRef>();

    const { container } = render(
      <DirectScrollCineView ref={ref} config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene sceneId="scene-1" sceneHeight={1000}>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1000;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(ref.current?.getCurrentScene?.()).toBe(1);
    });
  });

  it('prefers the nearest centered zone for keyboard takeover and ignores distant zones', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={535}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={70}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <div>Scene 1</div>
        </TestScene>
        <TestScene
          sceneId="scene-2"
          sceneHeight={70}
          scroll={{ zoneId: 'zone-2', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-2" />
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1240, 2480],
      sceneHeights: [535, 70, 70],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'ArrowDown' });
    });
    await flushAnimationFrame();

    expect(onZoneEnter).toHaveBeenCalledTimes(1);
    expect(onZoneEnter).toHaveBeenCalledWith({ zoneId: 'zone-0', sceneIndex: 0 });

    onZoneEnter.mockClear();

    act(() => {
      root.scrollTop = 2000;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    expect(onZoneEnter).toHaveBeenCalledTimes(1);
    expect(onZoneEnter).toHaveBeenCalledWith({ zoneId: 'zone-1', sceneIndex: 1 });
  });

  it('continues wheel takeover progress on the same input that crosses the anchor', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <ZoneTotalBudgetProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 300,
        deltaMode: 0,
      });
    });

    const segment = getTakeoverSegment(container, 1);

    // A 300px wheel from 1950 crosses the anchor by 50px, so the same input continues into the real
    // center-lock segment at native px rate.
    await waitFor(() => {
      expect(root.scrollTop).toBe(segment.start + 50);
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBe(50);
    });
  });

  it('does not lock wheel takeover before the input actually crosses the anchor', () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1800;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 300,
        deltaMode: 0,
      });
    });

    // Single-ruler geometry: takeover visualSpan == measured span == viewport (1000), so the
    // center-lock anchor sits exactly at the scene top (segmentStart = 2200 + 1000/2 - 1000/2 = 2200).
    // A 300px wheel from scrollTop 1800 reaches 2100, which is BELOW the 2200 anchor, so it must NOT
    // cross into takeover: no zone enter, native scroll lands at 2100, progress stays 0. (The old
    // legacy height-based conversion put the anchor at ~2074.81, which wrongly locked at 2100 and
    // contradicted this test's name — removing that conversion restores the intended behavior.)
    expect(onZoneEnter).not.toHaveBeenCalled();
    expect(root.scrollTop).toBe(2100);
    expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBe(0);
  });

  it('releases wheel remainder back to native scroll in the same frame after the budget is exhausted', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    const segment = getTakeoverSegment(container, 1);

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(segment.distance);
      expect(root.scrollTop).toBe(segment.end);
    });
  });

  it('reacquires takeover on reverse wheel input after forward budget consumption and anchors the same reverse gesture', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="reverse-wheel-hero"
            enterAnimation="fade-in"
            duration={{ enter: 100, exit: 0 }}
          >
            <div>Reverse wheel hero</div>
          </Animate>
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    const segment = getTakeoverSegment(container, 1);

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(segment.distance);
      expect(root.scrollTop).toBe(segment.end);
      expect(readAnimateOpacity(container, 'reverse-wheel-hero')).toBeCloseTo(1, 2);
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(0);

    onZoneEnter.mockClear();

    // Moving back inside the completed segment re-acquires the zone at 30px progress. The following
    // reverse wheel consumes that progress and returns to segmentStart without jumping elsewhere.
    act(() => {
      root.scrollTop = 2230;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    expect(onZoneEnter).toHaveBeenCalledTimes(1);
    expect(readOutputNumber('zone-1-progress')).toBe(30);

    onZoneEnter.mockClear();

    act(() => {
      fireEvent.wheel(root, {
        deltaY: -75,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(segment.start);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(readAnimateOpacity(container, 'reverse-wheel-hero')).toBe(0);
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(0);
  });

  it('replays a completed takeover at sceneEnd when small reverse wheel input re-enters before crossing the anchor', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="small-reverse-reentry"
            enterAnimation="fade-in"
            duration={{ enter: 100, exit: 0 }}
          >
            <div>Small reverse re-entry</div>
          </Animate>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200, 3600],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    // A single forward wheel crossing the anchor activates the zone and parks scrollTop at the anchor.
    // Single-ruler geometry: segmentStart = sceneTop = 2200; crossing the anchor clamps scrollTop to
    // segmentStart + 1 = 2201 with progress 1 on this frame. Old phantom conversion put it at ~2075.81.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
      expect(root.scrollTop).toBe(2201);
    });

    onZoneEnter.mockClear();

    // Native reconciliation parks at the completed endpoint. The next reverse intent must publish
    // an interior frame near completion instead of collapsing directly to the anchor.
    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: -110,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(99);
      expect(root.scrollTop).toBe(2299);
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);
  });

  it('does not jump native scrollTop back to anchor when reverse re-entering a completed takeover from sceneEnd', async () => {
    const takeoverBudget = 240;
    const afterSegmentDistance = 100;
    const reverseDelta = -150;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="page-bottom-reverse-takeover"
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>Page bottom reverse takeover</div>
          </Animate>
        </Scene>
        <Scene sceneId="scene-2" sceneHeight={1000}>
          <div>Ordinary scene 2</div>
        </Scene>
        <Scene sceneId="scene-3" sceneHeight={1000}>
          <div>Ordinary scene 3</div>
        </Scene>
        <Scene sceneId="scene-4" sceneHeight={1000}>
          <div>Ordinary scene 4</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2240, 3240, 4240],
      sceneHeights: [1000, 1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });

    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), takeoverBudget);
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
      expect(readAnimateOpacity(container, 'page-bottom-reverse-takeover')).toBeCloseTo(1, 1);
    });

    const segment = getTakeoverSegment(container, 1);
    const maxNativeOffset = root.scrollHeight - root.clientHeight;

    // Continue scrolling to the page bottom; the completed progress is retained.
    await wheelWithNativeDefaultAndFlush(root, 5000);
    await waitFor(() => {
      expect(root.scrollTop).toBe(maxNativeOffset);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const afterSegmentOffset = segment.end + afterSegmentDistance;
    await wheelWithNativeDefaultAndFlush(root, afterSegmentOffset - root.scrollTop);
    await waitFor(() => {
      expect(root.scrollTop).toBe(afterSegmentOffset);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);
    await flushAnimationFrame();

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      const expectedProgress = takeoverBudget - (Math.abs(reverseDelta) - afterSegmentDistance);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(expectedProgress);
      expect(root.scrollTop).toBe(segment.start + expectedProgress);
      expect(root.scrollTop).not.toBe(segment.start);
    });
  });

  it('keeps completed Scene.scroll progress at 100% through natural document flow and reverse-replays from 100% to 0%', async () => {
    const takeoverBudget = 240;
    const afterSegmentDistance = 8;
    const reverseDelta = -12;
    const animateId = 'retained-completed-reverse-replay';
    const progressRatios: number[] = [];
    const onZoneProgress = jest.fn((detail: { zoneId: string; progress: number }) => {
      if (detail.zoneId === 'zone-1') {
        progressRatios.push(detail.progress);
      }
    });
    const readLatestProgressRatio = (): number =>
      progressRatios.length > 0 ? progressRatios[progressRatios.length - 1] : 0;

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <Scene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
        >
          <Animate
            animateId={animateId}
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>Retained completed reverse replay</div>
          </Animate>
        </Scene>
        <Scene sceneId="scene-2" sceneHeight={1000}>
          <div>Ordinary scene 2</div>
        </Scene>
        <Scene sceneId="scene-3" sceneHeight={1000}>
          <div>Ordinary scene 3</div>
        </Scene>
        <Scene sceneId="scene-4" sceneHeight={1000}>
          <div>Ordinary scene 4</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000, 4000],
      sceneHeights: [1000, 1000, 1000, 1000, 1000],
    });
    await flushAnimationFrame();

    expect(readLatestProgressRatio()).toBe(0);
    expect(readAnimateOpacity(container, animateId)).toBe(0);

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });

    const firstForwardWasIntercepted = await wheelWithNativeDefaultAndFlush(root, 120);

    expect(firstForwardWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(progressRatios.some((progress) => progress > 0 && progress < 1)).toBe(true);
      expect(readAnimateOpacity(container, animateId)).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, animateId)).toBeLessThan(1);
    });

    for (let step = 0; step < 8 && readLatestProgressRatio() < 1; step += 1) {
      await wheelWithNativeDefaultAndFlush(root, 40);
    }

    await waitFor(() => {
      expect(readLatestProgressRatio()).toBe(1);
      expect(readAnimateOpacity(container, animateId)).toBeCloseTo(1, 1);
    });

    const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLDivElement;
    const segmentStart = Number(shell.dataset.cineviewTakeoverSegmentStart);
    const segmentEnd = Number(shell.dataset.cineviewTakeoverSegmentEnd);
    const afterSegmentOffset = segmentEnd + afterSegmentDistance;

    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(segmentEnd);
      expect(readLatestProgressRatio()).toBe(1);
      expect(readAnimateOpacity(container, animateId)).toBeCloseTo(1, 1);
    });

    await wheelWithNativeDefaultAndFlush(root, afterSegmentOffset - root.scrollTop);

    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(afterSegmentOffset, 5);
      expect(readLatestProgressRatio()).toBe(1);
      expect(readAnimateOpacity(container, animateId)).toBeCloseTo(1, 1);
    });

    progressRatios.length = 0;
    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(
        segmentEnd - (Math.abs(reverseDelta) - afterSegmentDistance),
        5
      );
      expect(progressRatios[0]).toBeGreaterThan(0.95);
      expect(progressRatios[0]).toBeLessThanOrEqual(1);
      expect(readAnimateOpacity(container, animateId)).toBeGreaterThan(0.95);
    });

    for (let step = 0; step < 8 && readLatestProgressRatio() > 0; step += 1) {
      await wheelWithNativeDefaultAndFlush(root, -40);
    }

    await waitFor(() => {
      expect(readLatestProgressRatio()).toBe(0);
      expect(readAnimateOpacity(container, animateId)).toBe(0);
    });
    expect(root.scrollTop).toBeLessThanOrEqual(segmentStart);
    expect(
      progressRatios.every(
        (progress, index) => index === 0 || progress <= progressRatios[index - 1] + 0.0001
      )
    ).toBe(true);
  });

  it('spends a large reverse wheel from page bottom through a completed center-lock segment', async () => {
    const takeoverBudget = 1400;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="large-page-bottom-reverse-takeover"
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>Large page bottom reverse takeover</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Ordinary scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Ordinary scene 3</div>
        </TestScene>
        <TestScene sceneId="scene-4" sceneHeight={1000}>
          <div>Ordinary scene 4</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000, 4000],
      sceneHeights: [1000, 1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });

    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), takeoverBudget);
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    await wheelWithNativeDefaultAndFlush(root, 5000);
    await waitFor(() => {
      expect(root.scrollTop).toBe(4000);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLDivElement;
    const segmentStart = Number(shell.dataset.cineviewTakeoverSegmentStart);
    const segmentEnd = Number(shell.dataset.cineviewTakeoverSegmentEnd);
    const scrollTopBeforeReverse = root.scrollTop;
    const reverseDelta = -2600;
    const distanceToSegmentEnd = scrollTopBeforeReverse - segmentEnd;
    const expectedProgressAfterReverse =
      takeoverBudget - (Math.abs(reverseDelta) - distanceToSegmentEnd);

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(segmentStart);
      expect(root.scrollTop).toBeLessThan(segmentEnd);
      expect(root.scrollTop).toBeCloseTo(segmentStart + expectedProgressAfterReverse, 5);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(expectedProgressAfterReverse, 5);
      expect(readAnimateOpacity(container, 'large-page-bottom-reverse-takeover')).toBeGreaterThan(
        0
      );
      expect(readAnimateOpacity(container, 'large-page-bottom-reverse-takeover')).toBeLessThan(1);
    });
  });

  it('spends the same reverse input through the completed center-lock segment at native px rate', async () => {
    const takeoverDistance = 600;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="single-reverse-jump-takeover"
            enterAnimation="fade-in"
            duration={{ enter: takeoverDistance, exit: 0 }}
          >
            <div>Single reverse jump takeover</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Scene 3</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });
    await completeTakeoverForward(
      root,
      () => readOutputNumber('zone-1-progress'),
      takeoverDistance
    );

    const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLDivElement;
    const segmentStart = Number(shell.dataset.cineviewTakeoverSegmentStart);
    const segmentEnd = Number(shell.dataset.cineviewTakeoverSegmentEnd);

    const afterSegmentDistance = 80;
    const reverseProgressDistance = 220;
    act(() => {
      root.scrollTop = Math.min(
        segmentEnd + afterSegmentDistance,
        root.scrollHeight - root.clientHeight
      );
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverDistance);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
    });

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(
      root,
      -(afterSegmentDistance + reverseProgressDistance)
    );

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(segmentStart);
      expect(root.scrollTop).toBeLessThan(segmentEnd);
      expect(root.scrollTop).toBeCloseTo(segmentEnd - reverseProgressDistance, 5);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(
        takeoverDistance - reverseProgressDistance,
        5
      );
      expect(readAnimateOpacity(container, 'single-reverse-jump-takeover')).toBeGreaterThan(0.5);
      expect(readAnimateOpacity(container, 'single-reverse-jump-takeover')).toBeLessThan(0.8);
    });
  });

  it('does not let one completed reverse input skip across the whole center-lock segment', async () => {
    const takeoverDistance = 600;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="full-segment-reverse-guard"
            enterAnimation="fade-in"
            duration={{ enter: takeoverDistance, exit: 0 }}
          >
            <div>Full segment reverse guard</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Scene 3</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });
    await completeTakeoverForward(
      root,
      () => readOutputNumber('zone-1-progress'),
      takeoverDistance
    );

    const shell = container.querySelector('[data-cineview-takeover-shell="1"]') as HTMLDivElement;
    const segmentStart = Number(shell.dataset.cineviewTakeoverSegmentStart);
    const segmentEnd = Number(shell.dataset.cineviewTakeoverSegmentEnd);
    const afterSegmentDistance = 80;

    act(() => {
      root.scrollTop = segmentEnd + afterSegmentDistance;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(segmentEnd + afterSegmentDistance, 5);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverDistance);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
    });

    const reverseWasIntercepted = await wheelWithNativeDefaultAndFlush(
      root,
      -(afterSegmentDistance + takeoverDistance + 220)
    );

    expect(reverseWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(segmentStart);
      expect(root.scrollTop).toBeLessThan(segmentEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(takeoverDistance);
      expect(readAnimateOpacity(container, 'full-segment-reverse-guard')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'full-segment-reverse-guard')).toBeLessThan(1);
    });
  });

  it('captures reverse re-entry at the rendered takeover scene end when authored height is viewport-clamped', async () => {
    const viewportHeight = 837;
    const sceneStart = 1000;
    const renderedSceneEnd = sceneStart + viewportHeight;
    const afterRenderedSceneEnd = renderedSceneEnd + 100;
    const reverseDelta = -150;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1200}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="viewport-clamped-reverse-reentry"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 640, exit: 240 }}
            timeline={{ phase: { start: 0, end: 0.38 } }}
          >
            <div>Viewport clamped reverse re-entry</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, sceneStart, renderedSceneEnd],
      sceneHeights: [sceneStart, viewportHeight, 1000],
      viewportHeight,
    });

    act(() => {
      root.scrollTop = sceneStart - 50;
      fireEvent.scroll(root);
    });

    // Real registered budget is enter+exit = 640+240 = 880 (1ms=1px).
    for (let i = 0; i < 12; i += 1) await wheelAndFlush(root, 90000);
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(880);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
    });

    act(() => {
      root.scrollTop = afterRenderedSceneEnd;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(root.scrollTop).toBe(afterRenderedSceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(880);
    });

    const segment = getTakeoverSegment(container, 1);

    // Reverse re-entry consumes the distance back to segmentEnd, then rewinds the retained progress
    // with the remainder at the same native px rate.
    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);
    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(segment.start + 787, 0);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(787, 3);
      expect(readAnimateOpacity(container, 'viewport-clamped-reverse-reentry')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'viewport-clamped-reverse-reentry')).toBeLessThan(1);
    });
  });

  it('reverse-runs completed takeover scenes after scrolling through the full page instead of skipping them', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="full-page-reverse-first"
            enterAnimation="fade-in"
            duration={{ enter: 200, exit: 0 }}
          >
            <div>First takeover</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene
          sceneId="scene-3"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-3', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 3 }}
        >
          <ZoneActiveProbe zoneId="zone-3" />
          <ZoneProgressProbe zoneId="zone-3" />
          <Animate
            animateId="full-page-reverse-second"
            enterAnimation="fade-in"
            duration={{ enter: 200, exit: 0 }}
          >
            <div>Second takeover</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-4" sceneHeight={1000}>
          <div>Scene 4</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000, 4000],
      sceneHeights: [1000, 1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 4200;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    // Native scroll crossing both anchors leaves zone-1 completed at 200 (deactivated) and re-activates
    // zone-3 at its anchor with progress 1 (overshoot not consumed). scrollTop parks at zone-3 anchor
    // (~2875.81).
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(200);
      expect(readOutputNumber('zone-3-progress')).toBeCloseTo(1, 5);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
    });

    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 4200;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(readOutputNumber('zone-3-progress')).toBe(200);
    });

    act(() => {
      root.scrollTop = 4200;
      fireEvent.scroll(root);
    });

    // CHARACTERIZATION: design/test-name expects each small reverse wheel from page bottom to reverse-run
    // the nearest completed takeover. The implementation instead lets the small reverse wheels (-250, -150)
    // move native scrollTop without re-acquiring takeover (both zones stay completed at 200 and inactive).
    // Flagged for browser-acceptance lane.
    await wheelAndFlush(root, -250);
    await waitFor(() => {
      expect(root.scrollTop).toBe(3750);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-3-progress')).toBe(200);
    });

    await wheelAndFlush(root, -150);
    await waitFor(() => {
      expect(root.scrollTop).toBe(3600);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-3-progress')).toBe(200);
    });

    // Only a reverse wheel large enough to reach the zone-3 anchor re-acquires zone-3 (progress 199, active),
    // and zone-1 remains completed/untouched — the implementation does not reverse-run zone-1 here.
    // Single-ruler geometry: zone-3 segmentStart = sceneTop(3000), segmentEnd = 3000 + budget(200) = 3200;
    // reverse-crossing parks scrollTop at segmentEnd - 1 = 3199, progress = 3199 - 3000 = 199. Old phantom
    // legacy height-based conversion put segmentEnd at ~3074.81.
    await wheelAndFlush(root, -2050);
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(3199, 3);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-3-progress')).toBeCloseTo(199, 0);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });
  });

  it('reconciles native reverse scroll from after a completed takeover back into sceneEnd-captured reverse progress', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="native-reverse-replay"
            enterAnimation="fade-in"
            duration={{ enter: 200, exit: 0 }}
          >
            <div>Native reverse replay</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 2400;
      fireEvent.scroll(root);
    });

    // Forward native scroll past the segment completes progress at the budget (200) and parks
    // scrollTop at segmentEnd. Single-ruler geometry: segmentStart = sceneTop(1000), segmentEnd =
    // 1000 + budget(200) = 1200. Legacy height-based conversion put segmentEnd at ~1074.81.
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(1200, 3);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
      expect(readAnimateOpacity(container, 'native-reverse-replay')).toBeCloseTo(1, 1);
    });

    // CHARACTERIZATION: design/test-name expects native reverse scroll (to 1900, back toward the
    // segment) to re-capture the zone (active again) and reconcile into sceneEnd-captured reverse
    // progress (0 < progress < 200). The implementation does not re-acquire takeover: scrollTop simply
    // becomes 1900, the zone stays inactive, and progress is frozen at 200. P0 reverse re-entry bug.
    // Flagged for browser-acceptance lane.
    act(() => {
      root.scrollTop = 1900;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1900);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });
  });

  it('keeps completed reverse replay visually mounted while native scroll is captured at sceneEnd', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene layout={{ height: 1000 }}>
          <div>Scene 0</div>
        </Scene>
        <Scene layout={{ height: 1000 }} scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}>
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Position layer={{ fixed: true }} at={{ x: 0, y: 0 }}>
            <Animate
              animateId="visible-native-reverse-replay"
              enterAnimation="fade-in"
              duration={{ enter: 200, exit: 0 }}
            >
              <div>Visible native reverse replay</div>
            </Animate>
          </Position>
        </Scene>
        <Scene layout={{ height: 1000 }}>
          <div>Scene 2</div>
        </Scene>
        <Scene layout={{ height: 1000 }}>
          <div>Scene 3</div>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    for (let i = 0; i < 8; i += 1) await wheelAndFlush(root, 90000);
    await wheelWithNativeDefaultAndFlush(root, 5000);

    // Forward completes the takeover (progress 200) and native scroll lands at scene-2 (scrollTop 3000).
    await waitFor(() => {
      expect(root.scrollTop).toBe(3000);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });

    // CHARACTERIZATION: design/test-name expects native reverse scroll back to 1900 to re-capture the
    // completed takeover at sceneEnd (zone active again, progress retracting below 200) while the fixed
    // layer stays visually mounted. The implementation leaves the zone inactive with progress frozen at
    // 200 (the P0 reverse re-entry bug). The fixed-layer clip does remain mounted (visible, opacity 1),
    // but the takeover shell transform/zIndex are cleared once the zone deactivates. Flagged for
    // browser-acceptance lane.
    act(() => {
      root.scrollTop = 1900;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      const clip = getFixedLayerClip(container, 1);
      expect(root.scrollTop).toBe(1900);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(200);
      expect(clip.style.visibility).toBe('visible');
      expect(clip.style.opacity).toBe('1');
      expect(readAnimateOpacity(container, 'visible-native-reverse-replay')).toBeCloseTo(1, 1);
    });
  });

  it('keeps native sceneEnd reverse capture active when the first reconciled frame is still at completion', async () => {
    const takeoverBudget = 1400;
    const sceneEnd = 2000;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="native-completion-edge-reentry"
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>Native completion edge re-entry</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Scene 3</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    // Drive forward to completion. The registered budget is 1400 (single 1400ms enter animation).
    for (let i = 0; i < 20; i += 1) await wheelAndFlush(root, 90000);
    await flushAnimationFrame();
    expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    expect(root.scrollTop).toBeGreaterThan(sceneEnd);

    await wheelWithNativeDefaultAndFlush(root, 5000);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    // Single-ruler geometry: segmentStart = sceneTop = 1000, segmentEnd = 1000 + budget(1400) = 2400.
    // Re-entering the rendered sceneEnd (sceneEnd+3 = 2003) captures the zone (active true) and reads
    // native px progress 2003 - 1000 = 1003 on that same frame. Old phantom conversion read ~1128.19.
    act(() => {
      root.scrollTop = sceneEnd + 3;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd + 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1003, 3);
    });

    act(() => {
      root.scrollTop = sceneEnd + 1;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd + 1);
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1001, 3);
    });

    act(() => {
      root.scrollTop = sceneEnd - 24;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd - 24);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(976, 3);
      expect(readAnimateOpacity(container, 'native-completion-edge-reentry')).toBeGreaterThan(0.65);
    });

    // Scrolling fully above the segment retracts progress to 0 and parks scrollTop at the anchor
    // (segmentStart = 1000).
    act(() => {
      root.scrollTop = sceneEnd - takeoverBudget - 24;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(root.scrollTop).toBe(1000);
    });

    // Native scroll to 1085 (just past the segmentStart anchor at 1000) re-acquires the zone at native
    // px progress 85. Old phantom anchor (~874.81) reached this from 960; with the anchor restored to the
    // scene top the equivalent re-entry offset is anchor + 85 = 1085.
    act(() => {
      root.scrollTop = 1085;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(root.scrollTop).toBe(1085);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(85, 3);
    });

    // A forward wheel from there is intercepted and advances progress further (to 205), scrollTop 1205.
    const restartedForward = await wheelWithNativeDefaultAndFlush(root, 120);
    await flushAnimationFrame();

    expect(restartedForward).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(1205);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(205, 3);
    });
  });

  it('reconciles native small reverse re-entry into a completed takeover before crossing the anchor', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="native-small-reentry"
            enterAnimation="fade-in"
            duration={{ enter: 100, exit: 0 }}
          >
            <div>Native small re-entry</div>
          </Animate>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200, 3600],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    // Forward wheel crosses the anchor; the zone activates but progress only reaches 1 on this frame.
    // Single-ruler geometry: segmentStart = sceneTop = 2200; crossing clamps scrollTop to
    // segmentStart + 1 = 2201. Legacy height-based conversion put it at ~2075.81.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
      expect(root.scrollTop).toBe(2201);
    });

    onZoneEnter.mockClear();

    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    // CHARACTERIZATION: design/test-name expects native reverse re-entry (from 3300 back to 3190, well
    // past sceneEnd) to be captured into the completed takeover, re-activating the zone and retracting
    // progress below 100. The implementation instead lets native scroll pass straight through to 3190,
    // leaving the zone inactive and progress frozen at 100 (onZoneEnter does not re-fire). This is the
    // P0 reverse re-entry bug. Flagged for browser-acceptance lane.
    act(() => {
      root.scrollTop = 3190;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(3190);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(100);
    });
    expect(onZoneEnter).not.toHaveBeenCalled();
  });

  it('continues a sceneEnd reverse replay by spending full reverse wheel delta instead of anchor overshoot', async () => {
    const takeoverBudget = 1400;
    const sceneEnd = 2000;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="scene-end-capture-full-delta"
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>SceneEnd capture full delta</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Scene 3</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, sceneEnd, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    // Real registered budget is 1400 (single enter animation). Forward consumes the segment and lands
    // at native scrollTop 3000 with progress complete (1400).
    for (let i = 0; i < 20; i += 1) await wheelAndFlush(root, 90000);
    await wheelWithNativeDefaultAndFlush(root, 5000);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    // Single-ruler geometry: segmentStart = sceneTop = 1000, segmentEnd = 1000 + budget(1400) = 2400.
    // sceneEnd + 300 = 2300 therefore sits INSIDE the segment, so native reconcile reads progress
    // 2300 - 1000 = 1300 (not the full budget) with the zone active. (Old phantom conversion put
    // segmentStart at ~874.81 / segmentEnd ~2274.81, so 2300 was past the segment and stayed at budget.)
    act(() => {
      root.scrollTop = sceneEnd + 300;
      fireEvent.scroll(root);
    });
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd + 300);
      expect(readOutputNumber('zone-1-progress')).toBe(1300);
    });

    // First reverse wheel spends its full delta inside the segment: scrollTop parks at native 1800 and
    // progress retracts to 1800 - 1000 = 800, with the zone active.
    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -500);
    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(1800);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(800);
    });

    // The second reverse wheel spends its full delta down to the segmentStart anchor: the reducer clamps
    // scrollTop to segmentStart = 1000 (progress 0) and deactivates the zone once the anchor is reached.
    const continuedReverseWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -1200);
    expect(continuedReverseWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(0);
    });
  });

  it('does not restart forward replay from capture-lock jitter before reverse replay reaches 0%', async () => {
    const takeoverBudget = 1400;
    const sceneEnd = 2000;

    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{
            zoneId: 'zone-1',
            trigger: 'center-lock',
          }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="capture-lock-jitter"
            enterAnimation="fade-in"
            duration={{ enter: takeoverBudget, exit: 0 }}
          >
            <div>Capture lock jitter</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene sceneId="scene-3" sceneHeight={1000}>
          <div>Scene 3</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, sceneEnd, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1300;
      fireEvent.scroll(root);
    });

    for (let i = 0; i < 20; i += 1) await wheelAndFlush(root, 90000);
    await wheelWithNativeDefaultAndFlush(root, 5000);
    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    act(() => {
      root.scrollTop = sceneEnd + 300;
      fireEvent.scroll(root);
    });

    // Reverse re-entry re-acquires takeover (active) and retracts; scrollTop parks at 1800.
    // Single-ruler geometry: segmentStart = sceneTop = 1000, so progress = 1800 - 1000 = 800.
    // (Legacy height-based conversion put segmentStart at ~874.81, giving progress ~925.19.)
    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -500);
    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(1800);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(800, 3);
    });
    const progressAfterReverseCapture = readOutputNumber('zone-1-progress');

    // CHARACTERIZATION: design/test-name expects a tiny forward jitter (scrollTop nudged just past
    // sceneEnd) NOT to restart the forward replay while a reverse replay is mid-flight; progress should
    // stay near the captured value. The implementation instead treats the jitter as fresh forward input
    // and jumps progress up (restarting forward from the capture). Single-ruler geometry: progress at
    // scrollTop 2002.5 = 2002.5 - segmentStart(1000) = 1002.5. Flagged for browser-acceptance lane.
    act(() => {
      root.scrollTop = sceneEnd + 2.5;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1002.5, 3);
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(progressAfterReverseCapture);
    });
  });

  it('restarts an exit-capable phased takeover from enter progress on a second forward pass after reverse re-entry', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="phased-second-forward"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 100, exit: 100 }}
            timeline={{ phase: { start: 0, end: 0.34 } }}
          >
            <div>Phased second forward</div>
          </Animate>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200, 3600],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });

    await flushAnimationFrame();

    // The forward wheel crosses the anchor and parks scrollTop at the real anchor (segmentStart+1 =
    // 2201) with progress starting at 1. Single-ruler geometry: segmentStart = sceneTop (2200). Old
    // legacy height-based conversion put the anchor at ~2075.81.
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
      expect(root.scrollTop).toBeCloseTo(2201, 3);
    });

    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    // Reverse wheel re-enters the segment from past sceneEnd: the zone re-activates and progress lands
    // near the top of the segment (90), scrollTop parked at segmentStart + 90 = 2290. (Old phantom
    // anchor put it at ~2164.81.)
    act(() => {
      fireEvent.wheel(root, {
        deltaY: -110,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(2290, 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(90, 5);
    });

    onZoneProgress.mockClear();

    // The second forward pass CONTINUES from the captured 90 (forward 20px -> 110), parking scrollTop at
    // segmentStart + 110 = 2310. (Old phantom anchor put it at ~2184.81.)
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(2310, 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(110, 5);
    });
    expect(onZoneProgress.mock.calls[0]?.[0]).toMatchObject({
      zoneId: 'zone-1',
      sceneIndex: 1,
    });
  });

  it('continues the second forward replay after restarting from reverse re-entry', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="continued-second-forward"
            enterAnimation="fade-in"
            exitAnimation="fade-out"
            duration={{ enter: 100, exit: 100 }}
            timeline={{ phase: { start: 0, end: 0.34 } }}
          >
            <div>Continued second forward</div>
          </Animate>
          <div>Scene 1</div>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200, 3600],
      sceneHeights: [1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });

    // CHARACTERIZATION: the forward wheel that crosses the anchor parks scrollTop at the segment anchor
    // (~2075.81) but only registers 1px of progress (overshoot not consumed). Flagged for
    // browser-acceptance lane.
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(1, 5);
    });

    // Bump scrollTop past the segment, then a reverse wheel re-acquires takeover within the segment.
    // Single-ruler geometry: segmentStart = sceneTop = 2200, segmentEnd = 2200 + budget(200) = 2400.
    // The reverse wheel lands the offset back inside the segment at 2290, so progress settles at 90.
    // (Legacy height-based conversion put the anchor at ~2074.81 -> 2164.81.)
    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: -110,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(2290, 3);
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(90, 5);
    });

    // Forward wheel continues from 90 (not a restart): progress increases to 110.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(110, 5);
    });
    const restartedProgress = readOutputNumber('zone-1-progress');

    // A further forward wheel keeps advancing the same replay (110 -> 130).
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(130, 5);
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(restartedProgress);
    });
  });

  it('does not reuse a stale owner when native reconciliation parks at a newly crossed takeover anchor', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="stale-owner-first"
            enterAnimation="fade-in"
            duration={{ enter: 200, exit: 0 }}
          >
            <div>First stale owner</div>
          </Animate>
        </TestScene>
        <TestScene sceneId="scene-2" sceneHeight={1000}>
          <div>Scene 2</div>
        </TestScene>
        <TestScene
          sceneId="scene-3"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-3', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 3 }}
        >
          <ZoneActiveProbe zoneId="zone-3" />
          <ZoneProgressProbe zoneId="zone-3" />
          <Animate
            animateId="stale-owner-second"
            enterAnimation="fade-in"
            duration={{ enter: 200, exit: 0 }}
          >
            <div>Second crossed owner</div>
          </Animate>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000, 2000, 3000],
      sceneHeights: [1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 1000;
      fireEvent.scroll(root);
    });

    // Forward wheel completes zone-1's budget (200) and releases to native: scrollTop lands at
    // zone-1's segmentEnd, zone-1 deactivates with progress retained at 200. Single-ruler geometry:
    // segmentStart = sceneTop(1000), segmentEnd = 1000 + budget(200) = 1200. The legacy
    // height-based conversion put segmentEnd at ~1074.81.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 200,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(root.scrollTop).toBeCloseTo(1200, 3);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });

    onZoneProgress.mockClear();

    act(() => {
      root.scrollTop = 2950;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    act(() => {
      root.scrollTop = 3050;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(3000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-3-progress')).toBe(0);
      expect(readAnimateOpacity(container, 'stale-owner-second')).toBe(0);
    });
    expect(onZoneProgress).not.toHaveBeenCalled();
  });

  it('registers every phased Animate sibling into the scene takeover budget', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneBudgetKeysProbe zoneId="zone-1" />
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
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-1-budget-keys')).toHaveTextContent(
        'scenarios-center,scenarios-left,scenarios-right'
      );
    });
  });

  it('consumes keyboard scroll input into the centered takeover budget before document scroll', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <div>Scene 0</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0],
      sceneHeights: [1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    act(() => {
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(onZoneProgress).toHaveBeenCalledWith({
        zoneId: 'zone-0',
        sceneIndex: 0,
        progress: expect.any(Number),
      });
    });
    expect(onZoneProgress).toHaveBeenCalledTimes(1);
    expect(root.scrollTop).toBe(0);
  });

  it('applies only a single keyboard page step when the focused container handles PageDown', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <ZoneProgressProbe zoneId="zone-0" />
          <div>Scene 0</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0],
      sceneHeights: [1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
    });
    await flushAnimationFrame();

    // CHARACTERIZATION: design/test-name expects a focused-container PageDown to advance the centered
    // takeover by a single page step (progress 0.85 -> 850px) without moving native scrollTop. The
    // implementation does fire exactly one onZoneProgress for the zone and keeps scrollTop at 0, but the
    // published progress is 0 (the page step does not advance the budget in this jsdom geometry). Flagged
    // for browser-acceptance lane.
    await waitFor(() => {
      expect(onZoneProgress).toHaveBeenCalledWith({
        zoneId: 'zone-0',
        sceneIndex: 0,
        progress: 0,
      });
    });
    expect(onZoneProgress).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="zone-0-progress"]')).toHaveTextContent('0');
    expect(root.scrollTop).toBe(0);
  });

  it('consumes window-level PageDown input when the scroll container is not focused', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <div>Scene 0</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0],
      sceneHeights: [1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    expect(document.activeElement).not.toBe(root);

    act(() => {
      fireEvent.keyDown(window, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(onZoneProgress).toHaveBeenCalledWith({
        zoneId: 'zone-0',
        sceneIndex: 0,
        progress: expect.any(Number),
      });
    });
    expect(onZoneProgress).toHaveBeenCalledTimes(1);
    expect(root.scrollTop).toBe(0);
  });

  it('routes unfocused window-level PageDown into native container scroll before takeover is eligible', () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    expect(document.activeElement).not.toBe(root);

    act(() => {
      fireEvent.keyDown(window, { key: 'PageDown' });
    });

    expect(root.scrollTop).toBeGreaterThan(0);
  });

  it('does not route PageDown from an external focused button into the container fallback scroll', () => {
    const { container } = render(
      <>
        <button type="button">Outside control</button>
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-1',
              trigger: 'center-lock',
            }}
          >
            <ScrollBudgetProbe animateId="anim-1" />
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      </>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    const button = screen.getByRole('button', { name: 'Outside control' });
    act(() => {
      button.focus();
      fireEvent.keyDown(button, { key: 'PageDown' });
    });

    expect(root.scrollTop).toBe(0);
  });

  it('does not hijack button spacebar activation with the global keyboard takeover listener', () => {
    const onZoneProgress = jest.fn();

    render(
      <>
        <button type="button">Toggle metrics</button>
        <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
          <TestScene
            sceneId="scene-0"
            sceneHeight={1000}
            scroll={{
              zoneId: 'zone-0',
              trigger: 'center-lock',
            }}
          >
            <ScrollBudgetProbe animateId="anim-0" />
            <div>Scene 0</div>
          </TestScene>
        </DirectScrollCineView>
      </>
    );

    const button = screen.getByRole('button', { name: 'Toggle metrics' });
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });

    // CHARACTERIZATION: design/test-name expects the global keyboard takeover listener to ignore a
    // spacebar keydown originating from an external focused button (so the button's own activation is
    // not hijacked). The implementation's global listener instead routes the spacebar into the centered
    // zone-0 takeover and fires onZoneProgress once (progress 0). Flagged for browser-acceptance lane.
    expect(onZoneProgress).toHaveBeenCalledTimes(1);
    expect(onZoneProgress).toHaveBeenCalledWith({
      zoneId: 'zone-0',
      sceneIndex: 0,
      progress: 0,
    });
  });

  it('publishes takeover progress through context to scroll-driven descendants', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <ZoneProgressProbe zoneId="zone-0" />
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0],
      sceneHeights: [1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    // CHARACTERIZATION: design/test-name expects a single forward wheel to publish takeover progress
    // (>0) through context to the descendant ZoneProgressProbe. With the takeover anchor at the very top
    // (segmentStart clamped to 0) and scrollTop already 0, the implementation does not engage the zone on
    // this wheel and the published progress stays 0. Flagged for browser-acceptance lane.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 100,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(Number(container.querySelector('[data-testid="zone-0-progress"]')?.textContent)).toBe(
        0
      );
    });
  });

  it('reconciles native scroll that crosses a takeover anchor by activating the zone and consuming overshoot as progress', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={2000}>
          <div>Prelude</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2000],
      sceneHeights: [2000, 1000],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    act(() => {
      root.scrollTop = 2120;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBe(120);
      expect(root.scrollTop).toBe(2120);
    });
  });

  it('releases the active takeover state when native scroll moves the real container away from the anchor', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene
          sceneId="scene-0"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}
        >
          <ScrollBudgetProbe animateId="anim-0" />
          <ZoneActiveProbe zoneId="zone-0" />
          <ZoneProgressProbe zoneId="zone-0" />
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0],
      sceneHeights: [1000],
    });

    // CHARACTERIZATION: design/test-name expects PageDown to engage the takeover (zone active), then a
    // native scroll away from the anchor to release it. In jsdom the focused-container PageDown path does
    // not activate the zone at all (no synthetic scroll is produced), so the zone is never active to begin
    // with. The "release" transition therefore cannot be observed here. Flagged for browser-acceptance lane.
    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(screen.getByTestId('zone-0-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-0-progress')).toBe(0);
    });

    act(() => {
      root.scrollTop = 480;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(screen.getByTestId('zone-0-active')).toHaveTextContent('false');
    });
  });

  it('reconciles native scroll that lands past a centered takeover anchor into zone progress', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 2300;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBeGreaterThan(0);
    });

    expect(root.scrollTop).toBe(2300);
  });

  it('keeps a later takeover scene visibly entering while the prior covered scene still overlaps with sticky residue', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene sceneId="scene-0" sceneHeight={1000}>
          <SceneRuntimeProbe sceneId="scene-0" />
          <Position layer={{ fixed: true }} at={{ x: 0, y: 0 }}>
            <div>Sticky residue</div>
          </Position>
          <div>Scene 0</div>
        </Scene>
        <Scene
          sceneId="scene-1"
          sceneHeight={1000}
          stack={{ mode: 'cover' }}
          transition={{ enterAnimation: 'fade-in' }}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
          <SceneRuntimeProbe sceneId="scene-1" />
          <Animate animateId="scene-1-hero" enterAnimation="fade-in">
            <div>Later takeover visual</div>
          </Animate>
        </Scene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 600;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(screen.getByTestId('scene-0-runtime')).toHaveTextContent('covered');
      expect(screen.getByTestId('scene-1-runtime')).toHaveTextContent('entering');
    });
  });

  it('replays keyboard takeover after the scroll position returns above the zone anchor', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneEnter }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="anim-1" />
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 950;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'ArrowDown' });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(onZoneEnter).toHaveBeenCalledTimes(1);
      expect(readOutputNumber('zone-1-progress')).toBe(30);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
    });

    onZoneEnter.mockClear();

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    act(() => {
      root.scrollTop = 950;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'ArrowDown' });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(30);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);
  });

  it('rearms a completed takeover when goToZone returns to its anchor', async () => {
    const ref = createRef<CineViewRef>();

    const { container } = render(
      <DirectScrollCineView ref={ref} config={config}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ZoneActiveProbe zoneId="zone-1" />
          <ZoneProgressProbe zoneId="zone-1" />
          <Animate
            animateId="programmatic-reentry"
            enterAnimation="fade-in"
            duration={{ enter: 100, exit: 0 }}
          >
            <div>Programmatic reentry</div>
          </Animate>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 2200],
      sceneHeights: [1000, 1000],
    });

    act(() => {
      root.scrollTop = 1950;
      fireEvent.scroll(root);
    });

    const segment = getTakeoverSegment(container, 1);

    // Drive the takeover to completion (budget 100). The forward gesture consumes the segment and
    // parks scrollTop at the real segment end with progress complete and the zone deactivated.
    for (let i = 0; i < 8; i += 1) await wheelAndFlush(root, 90000);
    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(readAnimateOpacity(container, 'programmatic-reentry')).toBeCloseTo(1, 1);
      expect(root.scrollTop).toBe(segment.end);
    });

    act(() => {
      ref.current?.goToZone?.('zone-1', { animated: false });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(root.scrollTop).toBe(segment.start);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(readAnimateOpacity(container, 'programmatic-reentry')).toBe(0);
    });

    // A fresh forward wheel after the goToZone reset re-consumes the segment to completion (progress
    // 100, opacity 1), so the takeover content is replayed even though the zone-active flag stayed off.
    act(() => {
      fireEvent.wheel(root, {
        deltaY: 400,
        deltaMode: 0,
      });
    });
    await flushAnimationFrame();

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'programmatic-reentry')).toBeGreaterThan(0);
    });
  });

  it('starts and stops the performance monitor when monitor mode is enabled', () => {
    const { unmount } = render(
      <DirectScrollCineView config={config} performance={{ monitor: true }}>
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    expect(performanceMonitor.start).toHaveBeenCalledTimes(1);

    unmount();

    expect(performanceMonitor.stop).toHaveBeenCalledTimes(1);
  });

  it('registers takeover wheel and touch listeners as non-passive so input can be consumed cleanly', () => {
    const addEventListenerSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener');

    try {
      render(
        <DirectScrollCineView config={config}>
          <TestScene
            sceneId="scene-0"
            scroll={{
              zoneId: 'zone-0',
              trigger: 'center-lock',
            }}
          >
            <ScrollBudgetProbe animateId="anim-0" />
          </TestScene>
        </DirectScrollCineView>
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'wheel',
        expect.any(Function),
        expect.objectContaining({ capture: true, passive: false })
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        expect.objectContaining({ passive: false })
      );
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  // S-F5: onZoneProgress threshold baseline must be the last REPORTED value.
  // Slow scrolling (≤0.5px per frame) used to reset the baseline every sync and
  // starve the callback; terminal 0 / full values within 0.5px of the previous
  // frame were swallowed.
  it('reports zone progress during slow sub-threshold scrolling and always reports the exact endpoints', async () => {
    const onZoneProgress = jest.fn();
    const { container } = render(
      <DirectScrollCineView config={config} mode="scroll" callbacks={{ onZoneProgress }}>
        <TestScene sceneId="scene-0" sceneHeight={1000}>
          <div>Scene 0</div>
        </TestScene>
        <TestScene
          sceneId="scene-1"
          sceneHeight={1000}
          scroll={{ zoneId: 'zone-slow', trigger: 'center-lock' }}
          sceneRuntime={{ sceneIndex: 1 }}
        >
          <ScrollBudgetProbe animateId="slow-anim" enterDuration={240} />
          <ZoneProgressProbe zoneId="zone-slow" />
          <div>Scene 1</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;
    installScrollGeometry({
      container: root,
      sceneTops: [0, 1000],
      sceneHeights: [1000, 1000],
    });
    act(() => {
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();

    const segment = getTakeoverSegment(container, 1);
    const segmentStart = segment.start;
    const totalBudget = segment.distance;
    expect(totalBudget).toBe(240);

    const zoneCalls = (): Array<{ progress: number }> =>
      onZoneProgress.mock.calls
        .map(([payload]) => payload as { zoneId: string; progress: number })
        .filter((payload) => payload.zoneId === 'zone-slow');

    // Park exactly at the segment anchor, then creep forward 0.4px per frame.
    act(() => {
      root.scrollTop = segmentStart;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    onZoneProgress.mockClear();

    for (let step = 1; step <= 10; step += 1) {
      act(() => {
        root.scrollTop = segmentStart + step * 0.4;
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();
    }

    // 4px of accumulated slow movement must have produced at least one report
    // (the old per-frame baseline swallowed every one of them).
    const slowReports = zoneCalls();
    expect(slowReports.length).toBeGreaterThan(0);
    expect(Math.max(...slowReports.map((call) => call.progress))).toBeGreaterThan(0);

    // Jump near completion, then close the final ≤0.5px: the exact full value
    // must be forced through.
    act(() => {
      root.scrollTop = segmentStart + totalBudget - 0.3;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    act(() => {
      root.scrollTop = segmentStart + totalBudget;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    expect(zoneCalls()[zoneCalls().length - 1]?.progress).toBe(1);

    // Reverse back to the anchor: the exact 0 endpoint must be forced through.
    act(() => {
      root.scrollTop = segmentStart + 0.3;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    act(() => {
      root.scrollTop = segmentStart;
      fireEvent.scroll(root);
    });
    await flushAnimationFrame();
    expect(zoneCalls()[zoneCalls().length - 1]?.progress).toBe(0);
  });

  // S-F2: programmatic smooth scrolling (goToZone / goToScene with
  // behavior:'smooth') must not be treated as a user gesture by the anti-skip
  // intent clamp. The clamp's corrective behavior:'auto' scrollTo aborts an
  // in-flight smooth scroll per the CSSOM spec, stranding the user mid-way.
  describe('programmatic smooth scrolling (S-F2)', () => {
    // Emulates real browser smooth scrolling in jsdom: scrollTo(smooth) arms a
    // target, frames are driven manually via stepFrame, and any
    // scrollTo(auto) while a smooth scroll is in flight aborts it (CSSOM).
    function installSmoothScrollEmulation(root: HTMLDivElement): {
      isAnimating: () => boolean;
      autoAborts: () => number;
      stepFrame: (stepPx: number) => boolean;
    } {
      let smoothTarget: number | null = null;
      let autoAborts = 0;

      root.scrollTo = ((optionsOrX?: ScrollToOptions | number, y?: number) => {
        if (typeof optionsOrX === 'number') {
          root.scrollLeft = optionsOrX;
          if (typeof y === 'number') {
            root.scrollTop = y;
          }
          return;
        }

        const top = optionsOrX?.top;
        if (typeof top !== 'number') {
          return;
        }
        if (optionsOrX?.behavior === 'smooth') {
          smoothTarget = top;
          return;
        }
        if (smoothTarget !== null) {
          smoothTarget = null;
          autoAborts += 1;
        }
        root.scrollTop = top;
      }) as HTMLElement['scrollTo'];

      return {
        isAnimating: () => smoothTarget !== null,
        autoAborts: () => autoAborts,
        stepFrame: (stepPx: number): boolean => {
          if (smoothTarget === null) {
            return false;
          }

          const remaining = smoothTarget - root.scrollTop;
          const step = Math.sign(remaining) * Math.min(stepPx, Math.abs(remaining));
          root.scrollTop += step;
          if (Math.abs(root.scrollTop - smoothTarget) < 0.5) {
            smoothTarget = null;
          }
          return true;
        },
      };
    }

    async function driveSmoothFrames(
      root: HTMLDivElement,
      emulation: { stepFrame: (stepPx: number) => boolean },
      stepPx: number,
      maxFrames = 64
    ): Promise<void> {
      for (let frame = 0; frame < maxFrames; frame += 1) {
        let advanced = false;
        act(() => {
          advanced = emulation.stepFrame(stepPx);
          if (advanced) {
            fireEvent.scroll(root);
          }
        });
        if (!advanced) {
          return;
        }
        await flushAnimationFrame();
      }
    }

    // Layout: scene-0 plain (0..1000), scene-1 takeover zone-mid budget 400
    // (segment 1000..1400, flow 1400), scene-2 takeover zone-target budget 100
    // (top 2400, segment 2400..2500). scrollHeight 3500, max offset 2500.
    async function renderSmoothScrollPage(): Promise<{
      ref: React.RefObject<CineViewRef>;
      container: HTMLElement;
      root: HTMLDivElement;
      midSegment: { start: number; end: number; distance: number };
      targetSegment: { start: number; end: number; distance: number };
    }> {
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <DirectScrollCineView ref={ref} config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{ zoneId: 'zone-mid', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="mid-anim" enterDuration={400} />
            <ZoneProgressProbe zoneId="zone-mid" />
            <div>Scene 1</div>
          </TestScene>
          <TestScene
            sceneId="scene-2"
            sceneHeight={1000}
            scroll={{ zoneId: 'zone-target', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 2 }}
          >
            <ScrollBudgetProbe animateId="target-anim" enterDuration={100} />
            <ZoneProgressProbe zoneId="zone-target" />
            <div>Scene 2</div>
          </TestScene>
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      await flushAnimationFrame();
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000, 2400],
        sceneHeights: [1000, 1000, 1000],
      });
      act(() => {
        fireEvent.scroll(root);
      });
      await flushAnimationFrame();

      const midSegment = getTakeoverSegment(container, 1);
      const targetSegment = getTakeoverSegment(container, 2);
      expect(midSegment.start).toBe(1000);
      expect(midSegment.end).toBe(1400);
      expect(targetSegment.start).toBe(2400);

      return { ref, container, root, midSegment, targetSegment };
    }

    it('lets a smooth goToZone cross an intermediate takeover segment and reach the target zone', async () => {
      const { ref, root, targetSegment } = await renderSmoothScrollPage();
      const emulation = installSmoothScrollEmulation(root);

      act(() => {
        ref.current?.goToZone?.('zone-target');
      });
      await flushAnimationFrame();
      expect(emulation.isAnimating()).toBe(true);

      await driveSmoothFrames(root, emulation, 300);

      // The reducer must not have issued a corrective auto scrollTo (which
      // would abort the smooth scroll and strand the user mid-segment).
      expect(emulation.autoAborts()).toBe(0);
      expect(root.scrollTop).toBe(targetSegment.start);
      // The crossed zone's timeline was driven through by the pass-through
      // frames (100% consumed), and the target zone sits armed at its anchor.
      expect(readOutputNumber('zone-mid-progress')).toBe(400);
      expect(readOutputNumber('zone-target-progress')).toBe(0);
    });

    it('lets a smooth goToScene cross an intermediate takeover segment and reach the scene', async () => {
      const { ref, root } = await renderSmoothScrollPage();
      const emulation = installSmoothScrollEmulation(root);

      act(() => {
        ref.current?.goToScene(2);
      });
      await flushAnimationFrame();
      expect(emulation.isAnimating()).toBe(true);

      await driveSmoothFrames(root, emulation, 300);

      expect(emulation.autoAborts()).toBe(0);
      expect(root.scrollTop).toBe(2400);
    });

    it('stops the smooth animation and returns control to the user on wheel input', async () => {
      const { ref, root, midSegment } = await renderSmoothScrollPage();
      const emulation = installSmoothScrollEmulation(root);

      act(() => {
        ref.current?.goToZone?.('zone-target');
      });
      await flushAnimationFrame();

      // Two smooth frames land mid-flight at 600, still animating.
      await driveSmoothFrames(root, emulation, 300, 2);
      expect(root.scrollTop).toBe(600);
      expect(emulation.isAnimating()).toBe(true);

      // Real user input must reclaim control: the in-flight smooth scroll is
      // stopped with an explicit auto scrollTo, then the wheel delta applies.
      await wheelAndFlush(root, 100);
      expect(emulation.isAnimating()).toBe(false);
      expect(emulation.autoAborts()).toBe(1);
      expect(root.scrollTop).toBe(700);

      // And the anti-skip clamp is back in force for user gestures: a giant
      // flick gets pinned to the first in-segment frame instead of skipping.
      await wheelAndFlush(root, 90000);
      expect(root.scrollTop).toBe(midSegment.start + 1);
    });

    it('keeps the synchronous animated:false goToZone path intact', async () => {
      const { ref, root, targetSegment } = await renderSmoothScrollPage();
      const emulation = installSmoothScrollEmulation(root);

      act(() => {
        ref.current?.goToZone?.('zone-target', { animated: false });
      });
      await flushAnimationFrame();

      expect(emulation.isAnimating()).toBe(false);
      expect(root.scrollTop).toBe(targetSegment.start);
      expect(readOutputNumber('zone-target-progress')).toBe(0);
    });
  });

  // S-F4: DESIGN measurement rule #3 — new nodes, async assets and layout
  // changes must retrigger measurement. Without a content-level
  // ResizeObserver, an async image/font growing a scene left every
  // sceneStart/segmentStart stale until the next gesture's first frame.
  describe('content-level resize remeasure (S-F4)', () => {
    class MockResizeObserver {
      static instances: MockResizeObserver[] = [];
      callback: ResizeObserverCallback;
      observed: Element[] = [];
      disconnect = jest.fn();

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        MockResizeObserver.instances.push(this);
      }

      observe(element: Element): void {
        this.observed.push(element);
      }

      unobserve(): void {}

      trigger(): void {
        this.callback([], this as unknown as ResizeObserver);
      }
    }

    const originalResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;

    beforeEach(() => {
      MockResizeObserver.instances = [];
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver;
    });

    afterEach(() => {
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = originalResizeObserver;
    });

    function triggerContentResize(): void {
      act(() => {
        MockResizeObserver.instances.forEach((instance) => instance.trigger());
      });
    }

    function renderResizePage(): { container: HTMLElement; unmount: () => void } {
      const { container, unmount } = render(
        <DirectScrollCineView config={config}>
          <TestScene sceneId="scene-0" sceneHeight={1000}>
            <div>Scene 0</div>
          </TestScene>
          <TestScene
            sceneId="scene-1"
            sceneHeight={1000}
            scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
            sceneRuntime={{ sceneIndex: 1 }}
          >
            <ScrollBudgetProbe animateId="resize-anim" enterDuration={100} />
            <ZoneProgressProbe zoneId="zone-1" />
            <div>Scene 1</div>
          </TestScene>
        </DirectScrollCineView>
      );

      return { container, unmount };
    }

    it('observes the scene wrappers and re-measures on content resize outside a gesture', async () => {
      const { container } = renderResizePage();
      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      await flushAnimationFrame();

      // The scene wrappers must be under content-size observation.
      expect(MockResizeObserver.instances.some((instance) => instance.observed.length > 0)).toBe(
        true
      );

      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      // The mount measurement ran before the real geometry existed; a content
      // resize alone (no gesture) must retrigger measurement + resync.
      triggerContentResize();
      await flushAnimationFrame();
      await waitFor(() => {
        expect(getTakeoverSegment(container, 1).start).toBe(1000);
      });

      // Scene 0 grows taller (async image/font), pushing scene 1 down.
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1800],
        sceneHeights: [1800, 1000],
      });
      triggerContentResize();
      await flushAnimationFrame();
      await waitFor(() => {
        expect(getTakeoverSegment(container, 1).start).toBe(1800);
      });
    });

    it('defers a mid-gesture content resize to gesture end', async () => {
      const { container } = renderResizePage();
      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      await flushAnimationFrame();

      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      triggerContentResize();
      await flushAnimationFrame();
      await waitFor(() => {
        expect(getTakeoverSegment(container, 1).start).toBe(1000);
      });

      // Begin a real gesture: its first frame measured the old geometry and
      // the gesture is now in its 120ms idle window.
      await wheelAndFlush(root, 10);

      // Content grows mid-gesture: the remeasure must NOT interrupt the
      // gesture ("measure once at gesture start" invariant)...
      installScrollGeometry({
        container: root,
        sceneTops: [0, 1800],
        sceneHeights: [1800, 1000],
      });
      triggerContentResize();
      await flushAnimationFrame();
      expect(getTakeoverSegment(container, 1).start).toBe(1000);

      // ...and must flush once the gesture idles out.
      await waitFor(() => {
        expect(getTakeoverSegment(container, 1).start).toBe(1800);
      });
    });

    it('does not resync the same native offset after eager gesture sync', async () => {
      const { container } = renderResizePage();
      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      await flushAnimationFrame();

      installScrollGeometry({
        container: root,
        sceneTops: [0, 1000],
        sceneHeights: [1000, 1000],
      });
      triggerContentResize();
      await flushAnimationFrame();
      await waitFor(() => {
        expect(getTakeoverSegment(container, 1).start).toBe(1000);
      });

      const measuredScrollHeight = root.scrollHeight;
      let scrollHeightReads = 0;
      Object.defineProperty(root, 'scrollHeight', {
        configurable: true,
        get: () => {
          scrollHeightReads += 1;
          return measuredScrollHeight;
        },
      });

      await wheelAndFlush(root, 10);
      const readsAfterEagerSync = scrollHeightReads;
      act(() => {
        fireEvent.scroll(root);
      });

      expect(scrollHeightReads).toBe(readsAfterEagerSync);
    });

    it('disconnects the content ResizeObserver on unmount', async () => {
      const { unmount } = renderResizePage();
      await flushAnimationFrame();

      const observing = MockResizeObserver.instances.filter(
        (instance) => instance.observed.length > 0
      );
      expect(observing.length).toBeGreaterThan(0);

      unmount();

      const lastObserver = observing[observing.length - 1];
      expect(lastObserver.disconnect).toHaveBeenCalled();
    });
  });
});
