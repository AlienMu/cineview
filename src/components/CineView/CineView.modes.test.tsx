/**
 * CineView container component — mode branches / runtime callbacks / ref command method supplementary tests
 *
 * Context (architectural fact, affects assertion strategy):
 * The exported `CineView` (end of CineView.tsx) routes to a separate component
 * `DirectScrollCineView.tsx` when `mode==='scroll'`; and `DragCineViewComponent` internally at line 466 has
 * `isRootScrollMode` hardcoded to the literal `false`. Therefore all scroll branches
 * guarded by `isRootScrollMode` in CineView.tsx are "unreachable via public API" dead code, the real
 * scroll engine is in DirectScrollCineView.tsx (not within this file's coverage target).
 *
 * This file only supplements tests for **drag path actually reachable** uncovered areas:
 * - dragRuntime/scrollRuntime/callbacks runtime callbacks injected into child Scene
 * - Programmatic commits (handleSceneChange forward/backward)
 * - Preload onError/onProgress normalization
 * - Viewport measurement (ResizeObserver path)
 * - renderProgress clamp boundaries
 * - ref command methods (goToZone no-op, preload variants, refreshLayout, metrics)
 * - First screen cold start timeout (FIRST_SCENE_TIMEOUT recoverable error)
 * - Various size resolution in scrollSceneLayout memo's resolveScrollSceneDeclaredSpan
 */

import { createRef, useState } from 'react';
import { render, waitFor } from '@testing-library/react';
import { CineView } from './CineViewDispatch';
import type { CineViewRef } from '../../types';
import type { MotionValue } from 'framer-motion';
import { freezeAnimationRegistrySnapshot } from '../../animations/registry';
import type { DragSceneTransaction, PreparedSceneSnapshot } from '../Scene/dragPreparedState';
import { performanceMonitor } from '../../utils/performanceMonitor';

const act = (globalThis as unknown as { act: typeof import('@testing-library/react').act }).act;

// ---------------------------------------------------------------------------
// Driver mock Scene: captures the props CineView injects (sceneRuntime /
// dragRuntime / scrollRuntime / callbacks / onSceneChange) so the test can
// invoke them to exercise the drag-path runtime effects.
// ---------------------------------------------------------------------------
type CapturedSceneProps = {
  children?: React.ReactNode;
  sceneRuntime?: { sceneIndex: number; [k: string]: unknown };
  dragRuntime?: {
    onDraggingChange: (v: boolean) => void;
    onProgressChange: (v: number) => void;
    renderProgressMotion: MotionValue<number>;
    onTimelineProgressChange: (v: number) => void;
    onSharedTimelineDurationChange: (v: number) => void;
    onCommit: (
      direction: 'forward' | 'backward',
      progressRatio?: number,
      committedElapsedMs?: number,
      timelineDuration?: number
    ) => void;
    onRelease: (release: {
      mode: 'settle' | 'bounce' | 'enter';
      direction: 'forward' | 'backward';
      targetSceneIndex: number;
      progressRatio?: number;
    }) => void;
    onActivationComplete: () => void;
    onReset: () => void;
    onPrepared: (snapshot: PreparedSceneSnapshot) => void;
    onOwnershipRequest: (direction: 'forward' | 'backward') => boolean;
    onCandidateSuspensionChange: (suspended: boolean) => boolean;
    onElementContinuationChange: (active: boolean) => void;
    onPointerSessionStart: () => void;
    transaction?: DragSceneTransaction | null;
    [k: string]: unknown;
  };
  scrollRuntime?: { [k: string]: unknown };
  callbacks?: { onVisibilityChange?: (d: unknown) => void; [k: string]: unknown };
  onSceneChange?: (direction: 'forward' | 'backward') => void;
};

const captured: Record<number, CapturedSceneProps> = {};
const DriverScene: React.FC<CapturedSceneProps> = (props) => {
  const index = props.sceneRuntime?.sceneIndex ?? 0;
  captured[index] = props;
  return <div data-testid={`driver-scene-${index}`}>{props.children}</div>;
};
(DriverScene as React.FC & { cineViewScene?: boolean; displayName?: string }).cineViewScene = true;
(DriverScene as React.FC & { displayName?: string }).displayName = 'Scene';

// ---------------------------------------------------------------------------
// performanceMonitor mock (mirrors existing CineView.test.tsx).
// ---------------------------------------------------------------------------
jest.mock('../../utils/performanceMonitor', () => {
  const performanceMonitor = {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 50,
      bundleSize: 45,
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

// ---------------------------------------------------------------------------
// Configurable useImagePreloader mock. Captures the latest options so tests can
// invoke onError / onProgress, and lets tests control preloadState fields.
// ---------------------------------------------------------------------------
let preloaderOptions: {
  priorityUrls?: string[];
  backgroundUrls?: string[];
  onProgress?: (p: number) => void;
  onError?: (url: string, error: Error) => void;
} = {};
const preloaderActions = {
  startPreload: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn(),
  addUrls: jest.fn(),
};
let preloaderState: Record<string, unknown> = {
  isLoading: false,
  progress: 100,
  loadedCount: 1,
  totalCount: 1,
  results: [],
  errors: new Map(),
  priorityComplete: true,
};

jest.mock('../../hooks/useImagePreloader', () => ({
  useImagePreloader: jest.fn((options: typeof preloaderOptions) => {
    preloaderOptions = options;
    return [preloaderState, preloaderActions];
  }),
}));

function createPreparedSnapshot(sceneIndex: number): PreparedSceneSnapshot {
  return {
    sceneIndex,
    instanceId: Symbol(`driver-scene-${sceneIndex}`),
    revision: 1,
    enabled: true,
    mapping: { unit: 'time', scale: 10 },
    registrySnapshot: freezeAnimationRegistrySnapshot({
      registrations: new Map(),
      calculatedDelays: new Map(),
      issues: [],
      timelineDuration: 100,
    }),
    enterVariantsByAnimateId: new Map(),
  };
}

function acquireInjectedForwardDrag(): boolean {
  const runtime = captured[0].dragRuntime!;
  runtime.onPrepared(createPreparedSnapshot(1));
  const acquired = runtime.onOwnershipRequest('forward');
  if (acquired) runtime.onDraggingChange(true);
  return acquired;
}

// ResizeObserver capture so the viewport-measure effect's RO branch is exercised.
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  cb: ResizeObserverCallback;
  observed: Element[] = [];
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    MockResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {}
  trigger(): void {
    this.cb([], this as unknown as ResizeObserver);
  }
}

describe('CineView drag-path modes / runtime callbacks', () => {
  const originalRO = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(captured)) delete captured[Number(k)];
    MockResizeObserver.instances = [];
    preloaderOptions = {};
    preloaderState = {
      isLoading: false,
      progress: 100,
      loadedCount: 1,
      totalCount: 1,
      results: [],
      errors: new Map(),
      priorityComplete: true,
    };
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver;
  });

  afterEach(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = originalRO;
  });

  describe('drag gesture runtime callback normalization', () => {
    it('callbacks.onReady fires only once even when parent re-renders with drag', async () => {
      const onReady = jest.fn();
      const callbackRef = jest.fn<void, [CineViewRef | null]>();

      const Harness = (): React.JSX.Element => {
        const [, setRevision] = useState(0);
        return (
          <CineView
            ref={(api) => callbackRef(api)}
            mode="drag"
            designWidth={750}
            callbacks={{
              onReady,
              onDragProgress: () => setRevision((revision) => revision + 1),
            }}
          >
            <DriverScene>S1</DriverScene>
            <DriverScene>S2</DriverScene>
          </CineView>
        );
      };

      render(<Harness />);
      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.1);
      });
      act(() => {
        captured[0].dragRuntime!.onProgressChange(0.2);
      });

      expect(onReady).toHaveBeenCalledTimes(1);
      expect(callbackRef.mock.calls.filter(([api]) => api !== null).length).toBeGreaterThan(1);
    });

    it('publishes drag progress samples one-by-one within same React batch', async () => {
      const onDragProgress = jest.fn();

      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragProgress }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.1);
        captured[0].dragRuntime!.onProgressChange(0.35);
        captured[0].dragRuntime!.onProgressChange(0.6);
      });

      expect(onDragProgress.mock.calls.map(([detail]) => detail)).toEqual([
        expect.objectContaining({ progress: 0.1, direction: 'forward' }),
        expect.objectContaining({ progress: 0.35, direction: 'forward' }),
        expect.objectContaining({ progress: 0.6, direction: 'forward' }),
      ]);
    });

    it('publishes direction reversal of equal-magnitude drag progress', async () => {
      const onDragProgress = jest.fn();

      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragProgress }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.25);
        captured[0].dragRuntime!.onProgressChange(-0.25);
      });

      expect(onDragProgress.mock.calls.map(([detail]) => detail)).toEqual([
        expect.objectContaining({ progress: 0.25, direction: 'forward' }),
        expect.objectContaining({ progress: 0.25, direction: 'backward' }),
      ]);
    });

    it('injected dragRuntime drives onDragStart / onDragProgress / onDragCancel one round', async () => {
      const onDragStart = jest.fn();
      const onDragProgress = jest.fn();
      const onDragCancel = jest.fn();

      render(
        <CineView
          mode="drag"
          designWidth={750}
          callbacks={{ onDragStart, onDragProgress, onDragCancel }}
        >
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      // Start dragging + progress change
      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.5);
      });

      expect(onDragStart).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 0, progress: 0, direction: 'forward' })
      );
      expect(onDragProgress).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 0, progress: 0.5, direction: 'forward' })
      );

      // Reverse progress (backward branch)
      act(() => {
        captured[0].dragRuntime!.onProgressChange(-0.25);
      });
      expect(onDragProgress).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 0.25, direction: 'backward' })
      );

      // Release without commit → reset outcome publishes cancel
      act(() => {
        captured[0].dragRuntime!.onRelease({
          mode: 'bounce',
          direction: 'backward',
          targetSceneIndex: -1,
        });
        captured[0].dragRuntime!.onReset();
        captured[0].dragRuntime!.onDraggingChange(false);
      });
      expect(onDragCancel).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 0, direction: 'backward' })
      );
    });

    it('successful commit does not falsely report onDragCancel', async () => {
      const onDragCancel = jest.fn();
      const onDragEnd = jest.fn();

      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragCancel, onDragEnd }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.7);
        captured[0].dragRuntime!.onDraggingChange(false);
        captured[0].dragRuntime!.onRelease({
          mode: 'settle',
          direction: 'forward',
          targetSceneIndex: 1,
          progressRatio: 0.7,
        });
        captured[0].dragRuntime!.onCommit('forward', 0.7, 70, 100);
      });

      expect(onDragEnd).toHaveBeenCalledTimes(1);
      expect(onDragCancel).not.toHaveBeenCalled();
    });

    it('bounce end publishes onDragCancel only once at release point', async () => {
      const onDragCancel = jest.fn();

      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragCancel }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.4);
        captured[0].dragRuntime!.onRelease({
          mode: 'bounce',
          direction: 'forward',
          targetSceneIndex: 1,
        });
        captured[0].dragRuntime!.onProgressChange(0);
        captured[0].dragRuntime!.onReset();
        captured[0].dragRuntime!.onDraggingChange(false);
      });

      expect(onDragCancel).toHaveBeenCalledTimes(1);
      expect(onDragCancel).toHaveBeenCalledWith({
        sceneIndex: 0,
        progress: 0.4,
        direction: 'forward',
      });
    });

    it('same press: forward rejected then reverse acquired, onDragStart reflects only final direction', async () => {
      const onDragStart = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onDragStart }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
          <DriverScene {...({ drag: { enabled: false } } as object)}>S3</DriverScene>
        </CineView>
      );

      act(() => ref.current?.goToScene(1, false));
      await waitFor(() => expect(captured[1]).toBeDefined());

      const runtime = captured[1].dragRuntime!;
      act(() => {
        runtime.onPrepared(createPreparedSnapshot(0));
        runtime.onPointerSessionStart();
        expect(runtime.onOwnershipRequest('forward')).toBe(false);
        expect(runtime.onOwnershipRequest('backward')).toBe(true);
      });

      expect(onDragStart).toHaveBeenCalledTimes(1);
      expect(onDragStart).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 1, direction: 'backward' })
      );
    });

    it('can establish reversible Candidate hold even when only element continuation is active', async () => {
      render(
        <CineView mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[1]).toBeDefined());

      const runtime = captured[1].dragRuntime!;
      act(() => runtime.onElementContinuationChange(true));
      let suspended = false;
      act(() => {
        suspended = runtime.onCandidateSuspensionChange(true);
      });
      expect(suspended).toBe(true);
      expect(runtime.transaction ?? null).toBeNull();

      act(() => {
        runtime.onCandidateSuspensionChange(false);
        runtime.onElementContinuationChange(false);
        suspended = runtime.onCandidateSuspensionChange(true);
      });
      expect(suspended).toBe(false);
    });

    it('onDragBlocked dedupes per direction within one press, reopens on next press', async () => {
      const onDragBlocked = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onDragBlocked }}>
          <DriverScene {...({ drag: { enabled: false } } as object)}>S1</DriverScene>
          <DriverScene>S2</DriverScene>
          <DriverScene {...({ drag: { enabled: false } } as object)}>S3</DriverScene>
        </CineView>
      );

      act(() => ref.current?.goToScene(1, false));
      await waitFor(() => expect(captured[1]).toBeDefined());
      const runtime = captured[1].dragRuntime!;

      act(() => {
        runtime.onPointerSessionStart();
        expect(runtime.onOwnershipRequest('forward')).toBe(false);
        expect(runtime.onOwnershipRequest('forward')).toBe(false);
        expect(runtime.onOwnershipRequest('backward')).toBe(false);
        expect(runtime.onOwnershipRequest('backward')).toBe(false);
      });
      expect(onDragBlocked).toHaveBeenCalledTimes(2);
      expect(onDragBlocked.mock.calls.map(([detail]) => detail.direction)).toEqual([
        'forward',
        'backward',
      ]);

      act(() => {
        runtime.onPointerSessionStart();
        expect(runtime.onOwnershipRequest('forward')).toBe(false);
      });
      expect(onDragBlocked).toHaveBeenCalledTimes(3);
    });

    it('physical boundary only establishes render ownership, does not create out-of-bounds element transaction', async () => {
      const onDragStart = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragStart }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[0]).toBeDefined());
      const runtime = captured[0].dragRuntime!;

      act(() => {
        runtime.onPointerSessionStart();
        expect(runtime.onOwnershipRequest('backward')).toBe(true);
        runtime.onProgressChange(-0.5);
      });

      expect(onDragStart).toHaveBeenCalledTimes(1);
      expect(captured[0].dragRuntime?.transaction ?? null).toBeNull();
    });

    it('post-commit settle reverse retarget clears old join, old completion must not release new transaction', async () => {
      const onDragEnd = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onDragEnd }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        expect(acquireInjectedForwardDrag()).toBe(true);
        captured[0].dragRuntime!.onProgressChange(0.7);
        captured[0].dragRuntime!.onRelease({
          mode: 'settle',
          direction: 'forward',
          targetSceneIndex: 1,
          progressRatio: 0.7,
        });
        captured[0].dragRuntime!.onCommit('forward', 0.7, 70, 100);
      });
      await waitFor(() =>
        expect(captured[1].dragRuntime?.transaction).toEqual(
          expect.objectContaining({ targetSceneIndex: 1, phase: 'settling' })
        )
      );

      const oldCompletion = captured[1].dragRuntime!.onActivationComplete;
      act(() => {
        captured[1].dragRuntime!.onElementContinuationChange(true);
        captured[1].dragRuntime!.onPrepared(createPreparedSnapshot(0));
        captured[1].dragRuntime!.onPointerSessionStart();
        expect(captured[1].dragRuntime!.onCandidateSuspensionChange(true)).toBe(true);
        expect(captured[1].dragRuntime!.onOwnershipRequest('backward')).toBe(true);
      });
      await waitFor(() =>
        expect(captured[0].dragRuntime?.transaction).toEqual(
          expect.objectContaining({ targetSceneIndex: 0, phase: 'driving' })
        )
      );

      act(() => oldCompletion());
      expect(captured[0].dragRuntime?.transaction).toEqual(
        expect.objectContaining({ targetSceneIndex: 0, phase: 'driving' })
      );
      expect(onDragEnd).toHaveBeenCalledTimes(1);
    });

    it('dragRuntime.onCommit supplements onDragEnd in both forward / backward with elapsedMs', async () => {
      const onDragEnd = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onDragEnd }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
          <DriverScene>S3</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      // forward commit (carries progressRatio / elapsedMs / timelineDuration)
      act(() => {
        captured[0].dragRuntime!.onCommit('forward', 0.8, 120, 240);
      });
      expect(onDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          sceneIndex: 0,
          targetSceneIndex: 1,
          progress: 0.8,
          direction: 'forward',
          elapsedMs: 120,
          timelineDurationMs: 240,
        })
      );

      // Advance to scene 1, then trigger backward commit
      act(() => {
        ref.current?.goToScene(1, false);
      });
      onDragEnd.mockClear();
      await waitFor(() => expect(captured[1]).toBeDefined());

      act(() => {
        captured[1].dragRuntime!.onCommit('backward', 0.6, 90);
      });
      expect(onDragEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          targetSceneIndex: 0,
          direction: 'backward',
          progress: 0.6,
          elapsedMs: 90,
        })
      );
    });

    it('renderProgress < 0 clamped to 0 on first screen (no negative displacement overflow)', async () => {
      const { container } = render(
        <CineView mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        captured[0].dragRuntime!.renderProgressMotion.set(-0.5);
      });

      // Scene 0 at renderProgress<0 has clampProgress=0 → translate remains 0%
      const scene0 = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(scene0.style.transform).toBe('translate3d(0, 0%, 0)');
    });

    it('renderProgress > 0 clamped to 0 on last screen', async () => {
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(ref.current).not.toBeNull());

      act(() => {
        ref.current?.goToScene(1, false);
      });
      await waitFor(() => expect(captured[1]).toBeDefined());

      act(() => {
        captured[1].dragRuntime!.renderProgressMotion.set(0.5);
      });

      const scene1 = container.querySelector('[data-scene-index="1"]') as HTMLDivElement;
      expect(scene1.style.transform).toBe('translate3d(0, 0%, 0)');
    });

    it('slideDirection=x uses horizontal axis transform for displacement', async () => {
      const { container } = render(
        <CineView mode="drag" designWidth={750} direction={'x'}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      const scene0 = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(scene0.style.transform).toBe('translate3d(0%, 0, 0)');
    });

    it('injects root mapping and Scene group override resolution into real dragRuntime', async () => {
      render(
        <CineView mode="drag" designWidth={750} unit={'percent'} scale={0.5}>
          <DriverScene>S-root</DriverScene>
          <DriverScene {...({ drag: { scale: 2 } } as object)}>S-scene</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[1]).toBeDefined());
      expect(captured[0].dragRuntime?.dragMappingConfig).toEqual({
        unit: 'percent',
        scale: 0.5,
      });
      expect(captured[1].dragRuntime?.dragMappingConfig).toEqual({ unit: 'time', scale: 2 });
    });

    it('invalid drag config reports INVALID_DRAG_CONFIG deduped by Scene and field', async () => {
      const onError = jest.fn();
      const invalidRootProps = { unit: 'frames', scale: 3 } as unknown as Pick<
        React.ComponentProps<typeof CineView>,
        'unit' | 'scale'
      >;
      const invalidSceneProps = {
        drag: { scale: -5, enabled: 'yes' },
      } as object;
      const view = (
        <CineView mode="drag" designWidth={750} {...invalidRootProps} callbacks={{ onError }}>
          <DriverScene>S-root-invalid</DriverScene>
          <DriverScene {...invalidSceneProps}>S-scene-invalid</DriverScene>
        </CineView>
      );
      const { rerender } = render(view);

      await waitFor(() => {
        const dragErrors = onError.mock.calls
          .map(([detail]) => detail)
          .filter((detail) => detail.code === 'INVALID_DRAG_CONFIG');
        expect(dragErrors).toHaveLength(3);
        expect(dragErrors.map((detail) => detail.context)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ sceneIndex: 0, field: 'unit', value: 'frames' }),
            expect.objectContaining({ sceneIndex: 1, field: 'scale', value: -5 }),
            expect.objectContaining({ sceneIndex: 1, field: 'enabled', value: 'yes' }),
          ])
        );
      });

      rerender(view);
      expect(
        onError.mock.calls
          .map(([detail]) => detail)
          .filter((detail) => detail.code === 'INVALID_DRAG_CONFIG')
      ).toHaveLength(3);
    });

    it('onActivationComplete in non-first-screen scene goes through completeDragTransition (no error)', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(ref.current).not.toBeNull());
      act(() => {
        ref.current?.goToScene(1, false);
      });
      await waitFor(() => expect(captured[1]).toBeDefined());

      expect(() => {
        act(() => {
          captured[1].dragRuntime!.onActivationComplete();
        });
      }).not.toThrow();
    });
  });

  describe('preload callback normalization', () => {
    it('useImagePreloader.onProgress passes through to callbacks.onLoadProgress', async () => {
      const onLoadProgress = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onLoadProgress }}>
          <DriverScene>S1</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(preloaderOptions.onProgress).toBeDefined());
      act(() => {
        preloaderOptions.onProgress!(42);
      });
      expect(onLoadProgress).toHaveBeenCalledWith(42);
    });

    it('useImagePreloader.onError normalizes to IMAGE_LOAD_FAILED error', async () => {
      const onError = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onError }}>
          <DriverScene>S1</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(preloaderOptions.onError).toBeDefined());
      act(() => {
        preloaderOptions.onError!('broken.jpg', new Error('boom'));
      });
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'IMAGE_LOAD_FAILED',
          message: 'boom',
          context: { url: 'broken.jpg' },
        })
      );
    });

    it('emits EMPTY_SCENES error when there are no Scenes', () => {
      const onError = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onError }}>
          <div>not a scene</div>
        </CineView>
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPTY_SCENES' }));
    });
  });

  describe('viewport measurement (ResizeObserver path)', () => {
    it('measures container when it has positive dimensions and re-measures in RO callback', async () => {
      const rectSpy = jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 750,
        height: 1334,
        top: 0,
        left: 0,
        right: 750,
        bottom: 1334,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);

      try {
        render(
          <CineView mode="drag" designWidth={750}>
            <DriverScene>S1</DriverScene>
          </CineView>
        );

        await waitFor(() => expect(captured[0]).toBeDefined());
        // Viewport width/height injected into sceneRuntime
        expect(captured[0].sceneRuntime!.viewportWidth).toBe(750);
        expect(captured[0].sceneRuntime!.viewportHeight).toBe(1334);

        // Trigger ResizeObserver callback (covers RO re-measure branch), should not throw
        expect(() => {
          act(() => {
            MockResizeObserver.instances.forEach((i) => i.trigger());
          });
        }).not.toThrow();
      } finally {
        rectSpy.mockRestore();
      }
    });
  });

  describe('scrollSceneLayout declared size resolution (still calculated in drag mode)', () => {
    // resolveScrollSceneDeclaredSpan executes unconditionally in scrollSceneLayout memo,
    // even in drag mode it evaluates each Scene's layout.width/height.
    it('resolves number / px / vh / vw / auto / invalid size types without error', async () => {
      const { container } = render(
        <CineView mode="drag" designWidth={750} direction={'y'}>
          <DriverScene {...({ layout: { height: 500 } } as object)}>S-number</DriverScene>
          <DriverScene {...({ layout: { height: '600px' } } as object)}>S-px</DriverScene>
          <DriverScene {...({ layout: { height: '80vh' } } as object)}>S-vh</DriverScene>
          <DriverScene {...({ layout: { height: '50vw' } } as object)}>S-vw</DriverScene>
          <DriverScene {...({ layout: { height: 'auto' } } as object)}>S-auto</DriverScene>
          <DriverScene {...({ layout: { height: 'banana' } } as object)}>S-bad</DriverScene>
          <DriverScene {...({ layout: { height: '600em' } } as object)}>S-unitless</DriverScene>
          <DriverScene {...({ layout: { height: '0px' } } as object)}>S-zero</DriverScene>
          <DriverScene {...({ sceneHeight: 300 } as object)}>S-sceneHeight</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());
      // Each scene wrapper exists, indicating layout memo completed normally
      expect(container.querySelector('[data-scene-index="0"]')).toBeInTheDocument();
    });

    it('direction=x resolves declared size by width (number / vw / empty string)', async () => {
      const { container } = render(
        <CineView mode="drag" designWidth={750} direction={'x'}>
          <DriverScene {...({ layout: { width: 400 } } as object)}>S1</DriverScene>
          <DriverScene {...({ layout: { width: '70vw' } } as object)}>S2</DriverScene>
          <DriverScene {...({ layout: { width: '  ' } } as object)}>S3</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[0]).toBeDefined());
      expect(container.querySelector('[data-scene-index="0"]')).toBeInTheDocument();
    });
  });

  describe('ref command methods (drag path)', () => {
    it('goToZone is no-op in drag mode (no error, does not change current scene)', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(ref.current).not.toBeNull());
      expect(() => {
        act(() => {
          ref.current?.goToZone?.('any-zone', { align: 'center', animated: true });
        });
      }).not.toThrow();
      expect(ref.current?.getCurrentIndex()).toBe(0);
    });

    it('preload() without args calls startPreload directly; with scene index/sceneId appends priority images', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene
            sceneRuntime={{ sceneIndex: 0 }}
            {...({ sceneId: 'a', assets: { preloadImages: ['a.jpg'] } } as object)}
          >
            S1
          </DriverScene>
          <DriverScene
            sceneRuntime={{ sceneIndex: 1 }}
            {...({ sceneId: 'b', assets: { preloadImages: ['b.jpg'] } } as object)}
          >
            S2
          </DriverScene>
        </CineView>
      );

      await waitFor(() => expect(ref.current).not.toBeNull());

      preloaderActions.startPreload.mockClear();
      await act(async () => {
        await ref.current?.preload?.();
      });
      expect(preloaderActions.startPreload).toHaveBeenCalled();
    });

    it('refreshLayout re-measures without error', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(ref.current?.refreshLayout).toBeDefined());
      expect(() => {
        act(() => {
          ref.current?.refreshLayout?.();
        });
      }).not.toThrow();
    });

    it('getPerformanceMetrics passes through performanceMonitor metrics', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(ref.current).not.toBeNull());
      const metrics = ref.current?.getPerformanceMetrics();
      expect(metrics).toEqual({ fps: 60, avgFrameTime: 16.67, memoryUsage: 50, bundleSize: 45 });
    });
  });

  describe('animation settle timer cleanup on unmount', () => {
    it('animated goToScene starts settle timer, cleaned up on unmount', async () => {
      jest.useFakeTimers();
      try {
        const ref = createRef<CineViewRef>();
        const { unmount } = render(
          <CineView ref={ref} mode="drag" designWidth={750} transitionDuration={400}>
            <DriverScene>S1</DriverScene>
            <DriverScene>S2</DriverScene>
          </CineView>
        );

        // ref ready immediately (synchronous imperative handle)
        expect(ref.current).not.toBeNull();

        act(() => {
          ref.current?.goToScene(1, true); // animated → isAnimating → starts settle timer
        });

        // Unmount should clean up timer without error
        expect(() => unmount()).not.toThrow();
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('first screen cold start timeout', () => {
    it('priority resources not complete and timeout → emits FIRST_SCENE_TIMEOUT recoverable error', async () => {
      jest.useFakeTimers();
      try {
        preloaderState = {
          isLoading: true,
          progress: 0,
          loadedCount: 0,
          totalCount: 2,
          results: [],
          errors: new Map(),
          priorityComplete: false,
        };

        const onError = jest.fn();
        render(
          <CineView mode="drag" designWidth={750} firstSceneTimeout={1000} callbacks={{ onError }}>
            <DriverScene>S1</DriverScene>
          </CineView>
        );

        act(() => {
          jest.advanceTimersByTime(1100);
        });

        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'FIRST_SCENE_TIMEOUT' })
        );
        // recoverable: detail carries preventDefault
        const detail = onError.mock.calls.find((c) => c[0].code === 'FIRST_SCENE_TIMEOUT')?.[0];
        expect(typeof detail.preventDefault).toBe('function');
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('performance monitoring toggle', () => {
    it('performance.monitor enabled starts monitoring, stops on unmount', () => {
      const { unmount } = render(
        <CineView mode="drag" designWidth={750} monitor>
          <DriverScene>S1</DriverScene>
        </CineView>
      );
      expect(performanceMonitor.start).toHaveBeenCalled();
      unmount();
      expect(performanceMonitor.stop).toHaveBeenCalled();
    });
  });

  describe('animated goToScene settle closure (A10 / D-F6)', () => {
    it('settle defaults to DEFAULT_SLIDE_DURATION(800), onSceneLeave carries real fromIndex', () => {
      jest.useFakeTimers();
      try {
        const onSceneLeave = jest.fn();
        const ref = createRef<CineViewRef>();
        render(
          <CineView ref={ref} mode="drag" designWidth={750} callbacks={{ onSceneLeave }}>
            <DriverScene>S1</DriverScene>
            <DriverScene>S2</DriverScene>
          </CineView>
        );

        act(() => {
          ref.current?.goToScene(1, true);
        });

        // A10: old fallback 500ms would trigger settle prematurely here (disconnected
        // from DEFAULT_SLIDE_DURATION 800 slide body); after unification, at 799ms
        // settle has not yet closed.
        act(() => {
          jest.advanceTimersByTime(799);
        });
        expect(onSceneLeave).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(1);
        });
        // D-F6: settle closure must report real fromIndex (old implementation fell back
        // to already-updated currentSceneRef, producing fromIndex === toIndex === 1, direction null).
        expect(onSceneLeave).toHaveBeenCalledTimes(1);
        expect(onSceneLeave).toHaveBeenCalledWith(
          expect.objectContaining({ fromIndex: 0, toIndex: 1, direction: 'forward' })
        );
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('dynamic children shrinkage (B2)', () => {
    it('removing active scene during render re-clamps index, viewport does not hang', async () => {
      const ref = createRef<CineViewRef>();
      const { rerender } = render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
          <DriverScene>S3</DriverScene>
        </CineView>
      );

      act(() => {
        ref.current?.goToScene(2, false);
      });
      expect(ref.current?.getCurrentIndex()).toBe(2);

      // Conditional rendering removed the currently active third scene.
      rerender(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => {
        expect(ref.current?.getCurrentIndex()).toBe(1);
      });
    });
  });

  // N2b — regression for the renderProgress stale latch (task-flow 2026-09-01, A15).
  //
  // CineView arms `pendingRenderRebaseRef` before calling commitDragSceneChange and
  // clears it in a layout effect keyed on `currentScene`. An out-of-bounds target makes
  // the reducer early-return WITHOUT touching `currentScene`, so that effect never runs
  // and the flag stays armed — discharging on the NEXT, unrelated scene change and
  // zeroing renderProgressMotion / dragTimelineProgressMotion when nothing asked for it.
  describe('rejected commit must not leave render rebase flag armed (N2b / A15)', () => {
    it('out-of-bounds commit followed by normal scene change does not zero renderProgressMotion', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[0]).toBeDefined());

      const renderProgressMotion = captured[0].dragRuntime!.renderProgressMotion;

      // Scene 0, backward -> target -1: the reducer refuses the move.
      act(() => {
        captured[0].dragRuntime!.onCommit('backward', 0.8, 400, 500);
      });
      expect(ref.current?.getCurrentIndex()).toBe(0);

      // A live value on the render track at the moment of an unrelated scene jump.
      act(() => {
        renderProgressMotion.set(0.42);
      });

      act(() => {
        ref.current?.goToScene(1, false);
      });
      expect(ref.current?.getCurrentIndex()).toBe(1);

      // With the latch left armed this reads 0 — a whole-stack teleport.
      expect(renderProgressMotion.get()).toBeCloseTo(0.42, 5);
    });

    it('committed scene change still zeroes renderProgressMotion (not over-corrected)', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" designWidth={750}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );
      await waitFor(() => expect(captured[0]).toBeDefined());

      const renderProgressMotion = captured[0].dragRuntime!.renderProgressMotion;
      act(() => {
        renderProgressMotion.set(0.42);
      });

      // Scene 0, forward -> target 1: in bounds, so the rebase must still happen.
      act(() => {
        captured[0].dragRuntime!.onCommit('forward', 0.8, 400, 500);
      });

      await waitFor(() => expect(ref.current?.getCurrentIndex()).toBe(1));
      expect(renderProgressMotion.get()).toBe(0);
    });
  });
});
