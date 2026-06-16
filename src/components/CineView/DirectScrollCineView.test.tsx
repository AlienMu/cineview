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
  SceneScrollTimelineContext,
  SceneScrollTakeoverContext,
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

jest.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 42,
      bundleSize: 12,
    })),
    reset: jest.fn(),
  },
}));

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

    runtime.registerZoneAnimation(zoneId, {
      animateId,
      delay: 0,
      enterDuration,
      exitDuration: 0,
    });

    return () => {
      runtime.unregisterZoneAnimation(zoneId, animateId);
    };
  }, [animateId, enterDuration, runtime, zoneId]);

  return null;
}

function ZoneProgressProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const timeline = useContext(SceneScrollTimelineContext);
  const progress = timeline?.zoneStates[zoneId]?.progressPx ?? 0;

  return <output data-testid={`${zoneId}-progress`}>{progress}</output>;
}

function ZoneActiveProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const timeline = useContext(SceneScrollTimelineContext);
  const active = timeline?.zoneStates[zoneId]?.active ?? false;

  return <output data-testid={`${zoneId}-active`}>{String(active)}</output>;
}

function ZoneBudgetKeysProbe({ zoneId }: { zoneId: string }): JSX.Element {
  const timeline = useContext(SceneScrollTimelineContext);
  const keys = Object.keys(timeline?.zoneStates[zoneId]?.sequence.budgets ?? {}).sort();

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
  };
}

const TestScene: React.FC<TestSceneProps> = ({ children, sceneId, scroll, sceneRuntime }) => {
  const runtime = useContext(SceneScrollRuntimeContext);
  const zoneRef = React.useRef<HTMLDivElement>(null);
  const zoneId = scroll?.zoneId ?? sceneId ?? null;
  const sceneIndex = sceneRuntime?.sceneIndex ?? 0;

  useEffect(() => {
    if (!runtime || !zoneId || !scroll) {
      return;
    }

    runtime.registerZone(zoneId, {
      sceneIndex,
      trigger: scroll.trigger ?? 'center-lock',
    });

    return () => {
      runtime.unregisterZone(zoneId);
    };
  }, [runtime, sceneIndex, scroll, zoneId]);

  useEffect(() => {
    if (!runtime || !zoneId) {
      return;
    }

    runtime.setZoneElement(zoneId, zoneRef.current);

    return () => {
      runtime.setZoneElement(zoneId, null);
    };
  }, [runtime, zoneId]);

  return (
    <SceneScrollTakeoverContext.Provider value={zoneId}>
      <div ref={zoneRef} data-cineview-scroll-zone={zoneId ?? undefined}>
        {children}
      </div>
    </SceneScrollTakeoverContext.Provider>
  );
};

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
    value: Math.max(...sceneTops.map((top, index) => top + sceneHeights[index]), viewportHeight),
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

  const wrappers = Array.from(container.querySelectorAll('[data-scene-index]')) as HTMLDivElement[];
  wrappers.forEach((wrapper, index) => {
    const top = sceneTops[index];
    const height = sceneHeights[index];
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

function getExpectedThumbOffsetForGlobalOffset({
  globalOffset,
  viewportSpan = 1000,
  contentSpan,
  budget = 0,
}: {
  globalOffset: number;
  viewportSpan?: number;
  contentSpan: number;
  budget?: number;
}): number {
  const railLength = viewportSpan - 16 * 2;
  const effectiveContentSpan = contentSpan + viewportSpan + budget;
  const thumbLength =
    contentSpan > 0
      ? Math.min(
          railLength,
          Math.max((viewportSpan / Math.max(effectiveContentSpan, viewportSpan)) * railLength, 40)
        )
      : railLength;
  const thumbTravel = Math.max(railLength - thumbLength, 0);
  const scrollableSpan = contentSpan + budget;

  return scrollableSpan > 0
    ? Math.min(Math.max((globalOffset / scrollableSpan) * thumbTravel, 0), thumbTravel)
    : 0;
}

function dragScrollbarThumbToGlobalOffset({
  container,
  globalOffset,
  contentSpan,
  budget = 0,
}: {
  container: HTMLElement;
  globalOffset: number;
  contentSpan: number;
  budget?: number;
}): void {
  const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
  const thumb = container.querySelector('[data-cineview-scrollbar-thumb="true"]') as HTMLDivElement;
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
  const { offset, length } = getThumbMetrics(container);
  const centerX = railRect.left + railRect.width / 2;
  const targetOffset = getExpectedThumbOffsetForGlobalOffset({
    globalOffset,
    contentSpan,
    budget,
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

  fireEvent.mouseDown(thumb, {
    button: 0,
    clientX: centerX,
    clientY: railRect.top + offset + length / 2,
  });

  fireEvent.mouseMove(window, {
    buttons: 1,
    clientX: centerX,
    clientY: railRect.top + targetOffset + length / 2,
  });

  fireEvent.mouseUp(window, {
    button: 0,
    clientX: centerX,
    clientY: railRect.top + targetOffset + length / 2,
  });
}

function clickScrollbarRailToGlobalOffset({
  container,
  globalOffset,
  contentSpan,
  budget = 0,
}: {
  container: HTMLElement;
  globalOffset: number;
  contentSpan: number;
  budget?: number;
}): void {
  const rail = container.querySelector('[data-cineview-scrollbar-rail="true"]') as HTMLDivElement;
  const thumb = container.querySelector('[data-cineview-scrollbar-thumb="true"]') as HTMLDivElement;
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
  const { offset, length } = getThumbMetrics(container);
  const centerX = railRect.left + railRect.width / 2;
  const targetOffset = getExpectedThumbOffsetForGlobalOffset({
    globalOffset,
    contentSpan,
    budget,
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

  fireEvent.mouseDown(rail, {
    button: 0,
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
    width: 750,
    height: 1334,
    unit: 'px' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__ = true;
  });

  it('preloads every declared scene asset globally in scroll mode', () => {
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
    expect(callArgs.priorityUrls).toEqual(['first.jpg', 'shared.jpg', 'second.jpg', 'third.jpg']);
    expect(callArgs.backgroundUrls).toEqual([]);
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

  it('marks scrollbar autoHide false by default on the real scroll container', () => {
    const { container } = render(
      <DirectScrollCineView config={config} scrollbar={{ enabled: true }}>
        <TestScene sceneId="scene-0">
          <div>Only scene</div>
        </TestScene>
      </DirectScrollCineView>
    );

    const root = container.querySelector('.cineview-container') as HTMLDivElement;

    expect(root).toHaveAttribute('data-cineview-scrollbar-autohide', 'false');
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
      expect(parseFloat(thumb.style.height)).toBeLessThan(430);
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(400);
      expect(root.scrollTop).toBe(1100);
    });

    await waitFor(() => {
      const { offset, length } = getThumbMetrics(container);
      const railLength = 1000 - 16 * 2;
      const thumbTravel = railLength - length;
      const maxVisualScroll = 3000 - 1000;
      const currentProgress = readOutputNumber('zone-1-progress');
      const expectedGlobalOffset =
        ((root.scrollTop + currentProgress) / (maxVisualScroll + 400)) * thumbTravel;
      const expectedNativeOffset = (root.scrollTop / maxVisualScroll) * thumbTravel;

      expect(offset).toBeGreaterThan(0);
      expect(offset).toBeCloseTo(expectedGlobalOffset, 1);
      expect(offset).not.toBeCloseTo(expectedNativeOffset, 1);
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(55, 5);
      expect(root.scrollTop).toBe(2200);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 350,
        deltaMode: 0,
      });
    });

    const { offset, length } = getThumbMetrics(container);
    const railLength = 1000 - 16 * 2;
    const thumbTravel = railLength - length;
    const maxVisualScroll = 3200 - 1000;
    const currentProgress = readOutputNumber('zone-1-progress');
    const scrollableSpan = maxVisualScroll + 100;
    const expectedGlobalOffset =
      (Math.min(root.scrollTop + currentProgress, scrollableSpan) / scrollableSpan) * thumbTravel;

    expect(root.scrollTop).toBeGreaterThan(2200);
    expect(currentProgress).toBe(100);
    expect(offset).toBeCloseTo(expectedGlobalOffset, 1);
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

    await waitFor(() => {
      expect(root.scrollTop).toBe(2200);
      expect(readOutputNumber('zone-1-progress')).toBe(100);
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
        <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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
        progressEvents.some(
          (event) => event.zoneId === 'scenarios-takeover' && event.progress > 0
        )
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

      expect(root.scrollTop).toBe(2200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(1400 * 0.2);
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

      expect(root.scrollTop).toBe(2200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(140, 5);

      await flushAnimationFrame();

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 900,
          deltaMode: 0,
        });
      });

      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(140);
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

      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 1800);
      expect(root.scrollTop).toBeGreaterThan(2200);

      await wheelAndFlush(root, -90000);

      await waitFor(() => {
        expect(root.scrollTop).toBe(3200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(1620);
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

      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 1800);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        root.scrollTop = 3300;
        fireEvent.scroll(root);
      });

      for (let index = 0; index < 5; index += 1) {
        await wheelAndFlush(root, -90000);
      }

      await waitFor(() => {
        expect(root.scrollTop).toBe(3200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(1800 * 0.22);
        expect(readAnimateOpacity(container, 'large-reverse-waterfall')).toBeGreaterThan(0);
        expect(readAnimateOpacity(container, 'large-reverse-waterfall')).toBeLessThan(1);
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

      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 1400);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        fireEvent.wheel(root, {
          deltaY: -90000,
          deltaMode: 0,
        });
        fireEvent.scroll(root);
        fireEvent.wheel(root, {
          deltaY: -90000,
          deltaMode: 0,
        });
      });

      expect(root.scrollTop).toBe(3200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(1320);

      await flushAnimationFrame();
      await wheelAndFlush(root, -90000);

      await waitFor(() => {
        expect(root.scrollTop).toBe(3200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(1100);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(1125);
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

      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 1800);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        root.scrollTop = 4750;
        fireEvent.scroll(root);
      });

      await completeTakeoverForward(root, () => readOutputNumber('zone-3-progress'), 1400);
      expect(root.scrollTop).toBeGreaterThan(5000);

      await wheelAndFlush(root, -90000);

      await waitFor(() => {
        expect(root.scrollTop).toBe(6000);
        expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-3-progress')).toBeGreaterThan(1320);
      });

      await wheelAndFlush(root, -90000);

      await waitFor(() => {
        expect(root.scrollTop).toBe(6000);
        expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-3-progress')).toBeGreaterThan(1100);
        expect(readOutputNumber('zone-3-progress')).toBeLessThan(1125);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
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
      const contentSpan = 4600 - 1000;
      const budget = 1800;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3600],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1950;
        fireEvent.scroll(root);
      });

      await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 1800);
      expect(root.scrollTop).toBeGreaterThan(2200);

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2100,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(1620);
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

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(100);
        expect(root.scrollTop).toBeGreaterThan(2200);
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

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(60);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 20,
          deltaMode: 0,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(30);
        expect(readAnimateOpacity(container, 'cross-anchor-second-forward')).toBeGreaterThan(0);
      });
    });

    it('reverse scrollbar replay reacquires takeover and rewinds the scroll animation from the shared global offset', async () => {
      const onZoneEnter = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          scrollbar={{ enabled: true }}
          callbacks={{ scroll: { onZoneEnter } }}
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
      const contentSpan = 3200 - 1000;
      const budget = 100;
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

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(100);
        expect(root.scrollTop).toBeGreaterThan(2200);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeCloseTo(1, 1);
      });

      onZoneEnter.mockClear();

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2250,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(55);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeGreaterThan(0.45);
        expect(readAnimateOpacity(container, 'reported-reverse-retract')).toBeLessThan(0.55);
      });
      expect(onZoneEnter).toHaveBeenCalledTimes(1);
      expect(onZoneEnter).toHaveBeenCalledWith({
        zoneId: 'zone-1',
        sceneIndex: 1,
      });
    });

    it('fires onZoneEnter again when the scrollbar returns above anchor and then re-enters the takeover zone', async () => {
      const onZoneEnter = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          scrollbar={{ enabled: true }}
          callbacks={{ scroll: { onZoneEnter } }}
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
      const contentSpan = 3200 - 1000;
      const budget = 100;
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

      await waitFor(() => {
        expect(onZoneEnter).toHaveBeenCalledTimes(1);
        expect(readOutputNumber('zone-1-progress')).toBe(100);
      });

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2100,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(2090);
        expect(root.scrollTop).toBeLessThan(2105);
        expect(readOutputNumber('zone-1-progress')).toBe(0);
        expect(readAnimateOpacity(container, 'reported-wheel-reentry')).toBe(0);
      });

      onZoneEnter.mockClear();

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2250,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
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
          scrollbar={{ enabled: true }}
          callbacks={{ scroll: { onZoneProgress } }}
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
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      const contentSpan = 3200 - 1000;
      const budget = 100;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200],
        sceneHeights: [1000, 1000],
      });

      act(() => {
        fireEvent.scroll(root);
      });

      onZoneProgress.mockClear();

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2250,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(55);
      });

      const enteredThumbOffset = getThumbMetrics(container).offset;

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2100,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(2090);
        expect(root.scrollTop).toBeLessThan(2105);
        expect(readOutputNumber('zone-1-progress')).toBe(0);
      });

      const reverseHandoffGlobalOffset = root.scrollTop + readOutputNumber('zone-1-progress');
      const reverseHandoffThumbOffset = getThumbMetrics(container).offset;

      expect(reverseHandoffThumbOffset).toBeCloseTo(
        getExpectedThumbOffsetForGlobalOffset({
          globalOffset: reverseHandoffGlobalOffset,
          contentSpan,
          budget,
        }),
        1
      );
      expect(reverseHandoffThumbOffset).toBeLessThan(enteredThumbOffset);

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2250,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(55);
        expect(root.scrollTop).toBe(2200);
      });

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2300,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(100);
        expect(root.scrollTop).toBe(2200);
      });

      const replayedGlobalOffset = root.scrollTop + readOutputNumber('zone-1-progress');
      const replayedThumbOffset = getThumbMetrics(container).offset;

      expect(replayedThumbOffset).toBeCloseTo(
        getExpectedThumbOffsetForGlobalOffset({
          globalOffset: replayedGlobalOffset,
          contentSpan,
          budget,
        }),
        1
      );
      expect(replayedThumbOffset).toBeGreaterThan(enteredThumbOffset);

      expect(onZoneProgress).toHaveBeenCalledTimes(4);
      expect(onZoneProgress.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          zoneId: 'zone-1',
          sceneIndex: 1,
        })
      );
      expect(onZoneProgress.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          zoneId: 'zone-1',
          sceneIndex: 1,
        })
      );
      expect(onZoneProgress.mock.calls[2]?.[0]).toEqual(
        expect.objectContaining({
          zoneId: 'zone-1',
          sceneIndex: 1,
        })
      );
      expect(onZoneProgress.mock.calls[0]?.[0]?.progress).toBeGreaterThan(0.45);
      expect(onZoneProgress.mock.calls[0]?.[0]?.progress).toBeLessThan(0.55);
      expect(onZoneProgress.mock.calls[1]?.[0]?.progress).toBe(0);
      expect(onZoneProgress.mock.calls[2]?.[0]?.progress).toBeGreaterThan(0.45);
      expect(onZoneProgress.mock.calls[2]?.[0]?.progress).toBeLessThan(0.55);
      expect(onZoneProgress.mock.calls[3]?.[0]?.progress).toBe(1);
    });

    it('does not let one scrollbar drag jump from before a takeover budget to after it without an active takeover frame', async () => {
      const onZoneProgress = jest.fn();

      const { container } = render(
        <DirectScrollCineView
          config={config}
          scrollbar={{ enabled: true }}
          callbacks={{ scroll: { onZoneProgress } }}
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
        </DirectScrollCineView>
      );

      const root = container.querySelector('.cineview-container') as HTMLDivElement;
      const contentSpan = 3200 - 1000;
      const budget = 1800;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200],
        sceneHeights: [1000, 1000],
      });

      act(() => {
        fireEvent.scroll(root);
      });

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2100,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(2090);
        expect(root.scrollTop).toBeLessThan(2105);
        expect(readOutputNumber('zone-1-progress')).toBe(0);
      });

      onZoneProgress.mockClear();

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 4100,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(onZoneProgress).toHaveBeenCalled();
      });

      const progressEvents = onZoneProgress.mock.calls.map((call) => call[0]?.progress);
      expect(progressEvents[0]).toBeGreaterThan(0);
      expect(progressEvents[0]).toBeLessThan(0.5);
      expect(progressEvents).toContainEqual(expect.any(Number));
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
      const contentSpan = 4200 - 1000;
      const budget = 1800;
      installScrollGeometry({
        container: root,
        sceneTops: [0, 2200, 3200],
        sceneHeights: [1000, 1000, 1000],
      });

      act(() => {
        root.scrollTop = 1000;
        fireEvent.scroll(root);
      });

      act(() => {
        clickScrollbarRailToGlobalOffset({
          container,
          globalOffset: 4050,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(1800);
      });

      act(() => {
        clickScrollbarRailToGlobalOffset({
          container,
          globalOffset: 5000,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(readOutputNumber('zone-1-progress')).toBe(1800);
        expect(root.scrollTop).toBeGreaterThan(3000);
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
      const contentSpan = 4600 - 1000;
      const budget = 100;
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

      await waitFor(() => {
        expect(root.scrollTop).toBeGreaterThan(2200);
        expect(readOutputNumber('zone-1-progress')).toBe(100);
        expect(readAnimateOpacity(container, 'scrollbar-second-forward')).toBe(0);
      });

      act(() => {
        dragScrollbarThumbToGlobalOffset({
          container,
          globalOffset: 2250,
          contentSpan,
          budget,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(45);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(55);
      });

      act(() => {
        fireEvent.wheel(root, {
          deltaY: 20,
          deltaMode: 0,
        });
      });

      await waitFor(() => {
        expect(root.scrollTop).toBe(2200);
        expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
        expect(readOutputNumber('zone-1-progress')).toBeLessThan(30);
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
      fireEvent.mouseDown(thumb, {
        button: 0,
        clientX: railRect.left + railRect.width / 2,
        clientY: railRect.top + initial.offset + initial.length / 2,
      });
    });

    act(() => {
      fireEvent.mouseMove(window, {
        buttons: 1,
        clientX: railRect.left + railRect.width / 2,
        clientY: 180,
      });
      fireEvent.mouseUp(window, {
        button: 0,
        clientX: railRect.left + railRect.width / 2,
        clientY: 180,
      });
    });

    await waitFor(() => {
      const { offset } = getThumbMetrics(container);
      expect(root.scrollTop).toBeGreaterThan(0);
      expect(offset).toBeGreaterThan(initial.offset + 1);
    });
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

    await waitFor(() => {
      expect(root.scrollTop).toBeLessThan(560);
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
    });

    const sceneWrapper = container.querySelector('[data-scene-index="1"]');
    const takeoverScene = container.querySelector('[data-cineview-scroll-zone="zone-1"]');

    expect(sceneWrapper).not.toHaveStyle({ minHeight: '100vh' });
    expect(takeoverScene).not.toHaveStyle({ height: '100%' });
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

    act(() => {
      root.scrollTop = 700;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(600);
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(ref.current?.getCurrentScene?.()).toBe(1);
    });

    act(() => {
      root.scrollTop = 650;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(650);
      expect(ref.current?.getCurrentScene?.()).toBe(2);
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

    act(() => {
      root.scrollTop = 1100;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeCloseTo(1, 1);
    });

    act(() => {
      root.scrollTop = 950;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(readOutputNumber('zone-1-progress')).toBe(50);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeGreaterThan(0.45);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeLessThan(0.55);
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
    });

    act(() => {
      root.scrollTop = 1010;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(readOutputNumber('zone-1-progress')).toBe(10);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeGreaterThan(0.05);
      expect(readAnimateOpacity(container, 'sticky-hero')).toBeLessThan(0.15);
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
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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
      sceneTops: [0, 535, 605],
      sceneHeights: [535, 70, 70],
    });

    act(() => {
      root.scrollTop = 0;
      fireEvent.scroll(root);
    });

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(onZoneEnter).toHaveBeenCalledWith({
        zoneId: 'zone-1',
        sceneIndex: 1,
      });
    });

    onZoneEnter.mockClear();

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    expect(onZoneEnter).not.toHaveBeenCalled();
    expect(root.scrollTop).toBeGreaterThan(900);
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

    await waitFor(() => {
      expect(root.scrollTop).toBe(2200);
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBeGreaterThan(0);
    });
  });

  it('does not lock wheel takeover before the input actually crosses the anchor', () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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

    expect(onZoneEnter).not.toHaveBeenCalled();
    expect(root.scrollTop).toBe(1800);
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

    await waitFor(() => {
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
    });
  });

  it('reacquires takeover on reverse wheel input after forward budget consumption and anchors the same reverse gesture', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
      expect(readAnimateOpacity(container, 'reverse-wheel-hero')).toBeCloseTo(1, 1);
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);

    onZoneEnter.mockClear();

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

    await waitFor(() => {
      expect(root.scrollTop).toBe(2200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(55, 5);
      expect(readAnimateOpacity(container, 'reverse-wheel-hero')).toBeGreaterThan(0.45);
      expect(readAnimateOpacity(container, 'reverse-wheel-hero')).toBeLessThan(0.65);
    });
    expect(onZoneEnter).toHaveBeenCalledWith({
      zoneId: 'zone-1',
      sceneIndex: 1,
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);
  });

  it('replays a completed takeover at sceneEnd when small reverse wheel input re-enters before crossing the anchor', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
      expect(readAnimateOpacity(container, 'small-reverse-reentry')).toBeCloseTo(1, 1);
    });

    onZoneEnter.mockClear();

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

    await waitFor(() => {
      expect(root.scrollTop).toBe(3200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(100);
      expect(readAnimateOpacity(container, 'small-reverse-reentry')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'small-reverse-reentry')).toBeLessThan(1);
    });
    expect(onZoneEnter).toHaveBeenCalledWith({
      zoneId: 'zone-1',
      sceneIndex: 1,
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);
  });

  it('does not jump native scrollTop back to anchor when reverse re-entering a completed takeover from sceneEnd', async () => {
    const takeoverBudget = 240;
    const sceneEnd = 2000;
    const afterSceneEndOffset = sceneEnd + 100;
    const reverseDelta = -150;
    const overshootPastSceneEnd = Math.abs(afterSceneEndOffset + reverseDelta - sceneEnd);

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
      sceneTops: [0, 1000, 2000, 3000, 4000],
      sceneHeights: [1000, 1000, 1000, 1000, 1000],
    });

    act(() => {
      root.scrollTop = 900;
      fireEvent.scroll(root);
    });

    await wheelWithNativeDefaultAndFlush(root, 500);

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
      expect(readAnimateOpacity(container, 'page-bottom-reverse-takeover')).toBeCloseTo(1, 1);
    });

    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBe(4000);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    await wheelWithNativeDefaultAndFlush(root, afterSceneEndOffset - root.scrollTop);

    await waitFor(() => {
      expect(root.scrollTop).toBe(afterSceneEndOffset);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const globalBeforeReentry = root.scrollTop + readOutputNumber('zone-1-progress');
    const expectedProgressAfterReentry = takeoverBudget - overshootPastSceneEnd;
    const expectedGlobalAfterReentry = globalBeforeReentry + reverseDelta;

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(expectedProgressAfterReentry, 5);
      expect(readAnimateOpacity(container, 'page-bottom-reverse-takeover')).toBeGreaterThan(0.75);
      expect(readAnimateOpacity(container, 'page-bottom-reverse-takeover')).toBeLessThan(0.85);
      expect(root.scrollTop).toBe(sceneEnd);
      expect(root.scrollTop).not.toBe(1000);
      expect(root.scrollTop + readOutputNumber('zone-1-progress')).toBeCloseTo(
        expectedGlobalAfterReentry,
        5
      );
    });
    expect(getThumbMetrics(container).offset).toBeCloseTo(
      getExpectedThumbOffsetForGlobalOffset({
        globalOffset: expectedGlobalAfterReentry,
        contentSpan: 4000,
      }),
      1
    );
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
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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

    const shell = container.querySelector(
      '[data-cineview-takeover-shell="1"]'
    ) as HTMLDivElement;
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

    const shell = container.querySelector(
      '[data-cineview-takeover-shell="1"]'
    ) as HTMLDivElement;
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
    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), takeoverDistance);

    const shell = container.querySelector(
      '[data-cineview-takeover-shell="1"]'
    ) as HTMLDivElement;
    const segmentStart = Number(shell.dataset.cineviewTakeoverSegmentStart);
    const segmentEnd = Number(shell.dataset.cineviewTakeoverSegmentEnd);

    const afterSegmentDistance = 80;
    const reverseProgressDistance = 220;
    act(() => {
      root.scrollTop = Math.min(segmentEnd + afterSegmentDistance, root.scrollHeight - root.clientHeight);
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
    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), takeoverDistance);

    const shell = container.querySelector(
      '[data-cineview-takeover-shell="1"]'
    ) as HTMLDivElement;
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
    const takeoverBudget = 1400;
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

    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), takeoverBudget);

    act(() => {
      root.scrollTop = afterRenderedSceneEnd;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(afterRenderedSceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, reverseDelta);

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(renderedSceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(takeoverBudget - 50, 5);
      expect(readAnimateOpacity(container, 'viewport-clamped-reverse-reentry')).toBeLessThan(1);
      expect(readAnimateOpacity(container, 'viewport-clamped-reverse-reentry')).toBeGreaterThan(0);
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

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(3500);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });

    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 4200;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(3500);
      expect(readOutputNumber('zone-3-progress')).toBe(200);
    });

    act(() => {
      root.scrollTop = 4200;
      fireEvent.scroll(root);
    });

    await wheelAndFlush(root, -250);

    await waitFor(() => {
      expect(root.scrollTop).toBe(4000);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-3-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-3-progress')).toBeLessThan(200);
      expect(readAnimateOpacity(container, 'full-page-reverse-second')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'full-page-reverse-second')).toBeLessThan(1);
    });

    await wheelAndFlush(root, -150);

    await waitFor(() => {
      expect(root.scrollTop).toBe(4000);
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-3-progress')).toBe(0);
    });

    await wheelAndFlush(root, -2050);

    await waitFor(() => {
      expect(root.scrollTop).toBe(2000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(200);
      expect(readAnimateOpacity(container, 'full-page-reverse-first')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'full-page-reverse-first')).toBeLessThan(1);
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

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(2000);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
      expect(readAnimateOpacity(container, 'native-reverse-replay')).toBeCloseTo(1, 1);
    });

    act(() => {
      root.scrollTop = 1900;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(2000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(200);
      expect(readAnimateOpacity(container, 'native-reverse-replay')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'native-reverse-replay')).toBeLessThan(1);
    });
  });

  it('keeps completed reverse replay visually mounted while native scroll is captured at sceneEnd', async () => {
    const { container } = render(
      <DirectScrollCineView config={config}>
        <Scene layout={{ height: 1000 }}>
          <div>Scene 0</div>
        </Scene>
        <Scene
          layout={{ height: 1000 }}
          scroll={{ zoneId: 'zone-1', trigger: 'center-lock' }}
        >
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

    await completeTakeoverForward(root, () => readOutputNumber('zone-1-progress'), 200);
    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(2000);
      expect(readOutputNumber('zone-1-progress')).toBe(200);
    });

    act(() => {
      root.scrollTop = 1900;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      const shell = container.querySelector(
        '[data-cineview-takeover-shell="1"]'
      ) as HTMLDivElement;
      const clip = getFixedLayerClip(container, 1);

      expect(root.scrollTop).toBe(2000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(200);
      expect(shell.style.transform).toContain('1000px');
      expect(shell.style.zIndex).toBe('30');
      expect(clip.style.visibility).toBe('visible');
      expect(clip.style.opacity).toBe('1');
      expect(readAnimateOpacity(container, 'visible-native-reverse-replay')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'visible-native-reverse-replay')).toBeLessThan(1);
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

    await completeTakeoverForward(
      root,
      () => readOutputNumber('zone-1-progress'),
      takeoverBudget
    );

    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
      expect(readAnimateOpacity(container, 'native-completion-edge-reentry')).toBeCloseTo(1, 1);
    });

    act(() => {
      root.scrollTop = sceneEnd + 3;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd + 3);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    act(() => {
      root.scrollTop = sceneEnd + 1;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    act(() => {
      root.scrollTop = sceneEnd - 24;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(takeoverBudget);
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(takeoverBudget - 80);
      expect(readAnimateOpacity(container, 'native-completion-edge-reentry')).toBeGreaterThan(0.9);
    });

    act(() => {
      root.scrollTop = sceneEnd - takeoverBudget - 24;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
    });

    act(() => {
      root.scrollTop = 960;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
    });

    const restartedForward = await wheelWithNativeDefaultAndFlush(root, 120);

    expect(restartedForward).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(120);
    });
  });

  it('reconciles native small reverse re-entry into a completed takeover before crossing the anchor', async () => {
    const onZoneEnter = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
      expect(readAnimateOpacity(container, 'native-small-reentry')).toBeCloseTo(1, 1);
    });

    onZoneEnter.mockClear();

    act(() => {
      root.scrollTop = 3300;
      fireEvent.scroll(root);
    });

    act(() => {
      root.scrollTop = 3190;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(3200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(100);
      expect(readAnimateOpacity(container, 'native-small-reentry')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'native-small-reentry')).toBeLessThan(1);
    });
    expect(onZoneEnter).toHaveBeenCalledWith({
      zoneId: 'zone-1',
      sceneIndex: 1,
    });
    expect(onZoneEnter).toHaveBeenCalledTimes(1);
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

    await completeTakeoverForward(
      root,
      () => readOutputNumber('zone-1-progress'),
      takeoverBudget
    );
    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    act(() => {
      root.scrollTop = sceneEnd + 300;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd + 300);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -500);

    expect(reentryWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(takeoverBudget * 0.94);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(takeoverBudget);
    });

    const continuedReverseWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -1200);

    expect(continuedReverseWasIntercepted).toBe(true);
    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeLessThanOrEqual(150);
      expect(readAnimateOpacity(container, 'scene-end-capture-full-delta')).toBeLessThan(0.12);
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

    await completeTakeoverForward(
      root,
      () => readOutputNumber('zone-1-progress'),
      takeoverBudget
    );
    await wheelWithNativeDefaultAndFlush(root, 5000);

    await waitFor(() => {
      expect(root.scrollTop).toBeGreaterThan(sceneEnd);
      expect(readOutputNumber('zone-1-progress')).toBe(takeoverBudget);
    });

    act(() => {
      root.scrollTop = sceneEnd + 300;
      fireEvent.scroll(root);
    });

    const reentryWasIntercepted = await wheelWithNativeDefaultAndFlush(root, -500);
    expect(reentryWasIntercepted).toBe(true);

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(takeoverBudget * 0.9);
    });
    const progressAfterReverseCapture = readOutputNumber('zone-1-progress');

    act(() => {
      root.scrollTop = sceneEnd + 2.5;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(sceneEnd);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(
        progressAfterReverseCapture - 1
      );
      expect(readOutputNumber('zone-1-progress')).toBeLessThanOrEqual(
        progressAfterReverseCapture + 3
      );
    });
  });

  it('restarts an exit-capable phased takeover from enter progress on a second forward pass after reverse re-entry', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(root.scrollTop).toBeGreaterThan(2200);
      expect(readAnimateOpacity(container, 'phased-second-forward')).toBe(0);
    });

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

    await waitFor(() => {
      expect(root.scrollTop).toBe(3200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThanOrEqual(90);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(100);
    });

    onZoneProgress.mockClear();

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(3200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(30);
      expect(readAnimateOpacity(container, 'phased-second-forward')).toBeGreaterThan(0);
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

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
    });

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

    await waitFor(() => {
      expect(root.scrollTop).toBe(3200);
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThanOrEqual(90);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(100);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(0);
      expect(readOutputNumber('zone-1-progress')).toBeLessThan(30);
    });
    const restartedProgress = readOutputNumber('zone-1-progress');

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 20,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBeGreaterThan(restartedProgress);
    });
  });

  it('prefers a newly crossed takeover over a stale active owner during native scroll reconciliation', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 200,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(1000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBeCloseTo(200, 0);
    });

    onZoneProgress.mockClear();

    act(() => {
      root.scrollTop = 3050;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(3000);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('false');
      expect(screen.getByTestId('zone-3-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-3-progress')).toBeGreaterThan(45);
      expect(readOutputNumber('zone-3-progress')).toBeLessThan(55);
      expect(readAnimateOpacity(container, 'stale-owner-second')).toBeGreaterThan(0);
      expect(readAnimateOpacity(container, 'stale-owner-second')).toBeLessThan(1);
    });
    expect(onZoneProgress.mock.calls[0]?.[0]).toMatchObject({
      zoneId: 'zone-3',
      sceneIndex: 3,
    });
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
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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

    await waitFor(() => {
      expect(onZoneProgress).toHaveBeenCalledWith({
        zoneId: 'zone-0',
        sceneIndex: 0,
        progress: 0.85,
      });
    });
    expect(onZoneProgress).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="zone-0-progress"]')).toHaveTextContent('850');
    expect(root.scrollTop).toBe(0);
  });

  it('consumes window-level PageDown input when the scroll container is not focused', async () => {
    const onZoneProgress = jest.fn();

    const { container } = render(
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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
        <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneProgress } }}>
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

    expect(onZoneProgress).not.toHaveBeenCalled();
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

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 100,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(
        Number(container.querySelector('[data-testid="zone-0-progress"]')?.textContent)
      ).toBeGreaterThan(0);
    });
  });

  it('reconciles native scroll that crosses a takeover anchor by activating the zone and consuming overshoot as progress', async () => {
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
      sceneTops: [2000],
      sceneHeights: [1000],
    });

    act(() => {
      root.scrollTop = 2120;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-0-active')).toHaveTextContent('true');
      expect(Number(screen.getByTestId('zone-0-progress').textContent)).toBeGreaterThan(0);
      expect(root.scrollTop).toBe(2000);
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

    act(() => {
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-0-active')).toHaveTextContent('true');
      expect(Number(screen.getByTestId('zone-0-progress').textContent)).toBeGreaterThan(0);
    });

    act(() => {
      root.scrollTop = 480;
      fireEvent.scroll(root);
    });

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
      root.scrollTop = 2500;
      fireEvent.scroll(root);
    });

    await waitFor(() => {
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBeGreaterThan(0);
    });

    expect(root.scrollTop).toBe(2200);
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
      <DirectScrollCineView config={config} callbacks={{ scroll: { onZoneEnter } }}>
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
      root.focus();
      fireEvent.keyDown(root, { key: 'PageDown' });
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(onZoneEnter).toHaveBeenCalledTimes(1);
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBe(200);
    });

    onZoneEnter.mockClear();

    act(() => {
      fireEvent.keyDown(root, { key: 'PageDown' });
      root.scrollTop = 0;
      fireEvent.scroll(root);
      fireEvent.keyDown(root, { key: 'PageDown' });
      fireEvent.keyDown(root, { key: 'PageDown' });
    });

    await waitFor(() => {
      expect(onZoneEnter).toHaveBeenCalled();
      expect(Number(screen.getByTestId('zone-1-progress').textContent)).toBeGreaterThan(0);
    });
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

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 1200,
        deltaMode: 0,
      });
    });

    await waitFor(() => {
      expect(readOutputNumber('zone-1-progress')).toBe(100);
      expect(readAnimateOpacity(container, 'programmatic-reentry')).toBeCloseTo(1, 1);
      expect(root.scrollTop).toBeGreaterThan(2200);
    });

    act(() => {
      ref.current?.goToZone?.('zone-1', { animated: false });
    });

    await waitFor(() => {
      expect(root.scrollTop).toBe(2200);
      expect(screen.getByTestId('zone-1-active')).toHaveTextContent('true');
      expect(readOutputNumber('zone-1-progress')).toBe(0);
      expect(readAnimateOpacity(container, 'programmatic-reentry')).toBe(0);
    });

    act(() => {
      fireEvent.wheel(root, {
        deltaY: 400,
        deltaMode: 0,
      });
    });

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
});
