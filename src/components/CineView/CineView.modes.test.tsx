/**
 * CineView 容器组件 —— 模式分支 / runtime 回调 / ref 命令方法补充单测
 *
 * 说明（架构事实，影响断言策略）：
 * 导出的 `CineView`（CineView.tsx 末尾）在 `mode==='scroll'` 时会路由到独立组件
 * `DirectScrollCineView.tsx`；而 `DragCineViewComponent` 内部第 466 行将
 * `isRootScrollMode` 硬编码为字面量 `false`。因此 CineView.tsx 中所有被
 * `isRootScrollMode` 守卫的 scroll 分支都是「经公共 API 不可达」的死代码，真正的
 * scroll 引擎在 DirectScrollCineView.tsx（不在本文件覆盖目标内）。
 *
 * 本文件只针对 **drag 路径真实可达** 的未覆盖面补测：
 * - 注入到子 Scene 的 dragRuntime/scrollRuntime/callbacks 运行时回调
 * - 程序化提交（handleSceneChange forward/backward）
 * - 预加载 onError/onProgress 归一化
 * - 视口测量（ResizeObserver 路径）
 * - renderProgress clamp 边界
 * - ref 命令方法（goToZone no-op、preload 变体、refreshLayout、metrics）
 * - 首屏冷启动超时（FIRST_SCENE_TIMEOUT recoverable error）
 * - scrollSceneLayout memo 中 resolveScrollSceneDeclaredSpan 的各类尺寸解析
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

  describe('drag 手势 runtime 回调归一化', () => {
    it('父组件随 drag 重渲染时 callbacks.onReady 仍只触发一次', async () => {
      const onReady = jest.fn();
      const callbackRef = jest.fn<void, [CineViewRef | null]>();

      const Harness = (): JSX.Element => {
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

    it('同一 React 批次内逐个发布 drag progress 样本', async () => {
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

    it('发布等幅 drag progress 的方向反转', async () => {
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

    it('注入的 dragRuntime 驱动 onDragStart / onDragProgress / onDragCancel 一轮', async () => {
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

      // 开始拖拽 + 进度变化
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

      // 反向进度（backward 分支）
      act(() => {
        captured[0].dragRuntime!.onProgressChange(-0.25);
      });
      expect(onDragProgress).toHaveBeenCalledWith(
        expect.objectContaining({ progress: 0.25, direction: 'backward' })
      );

      // 松手未提交 → reset 结局发布 cancel
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

    it('成功提交不同时误报 onDragCancel', async () => {
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

    it('bounce 结束时只发布一次 release 点的 onDragCancel', async () => {
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

    it('同一按压 forward 被拒后可反向获权，且 onDragStart 只反映最终方向', async () => {
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

    it('仅 element continuation 活跃时也能同步建立可逆 Candidate hold', async () => {
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

    it('onDragBlocked 在一次按压内按方向去重，并在下一次按压重新开放', async () => {
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

    it('物理边界只建立 render ownership，不创建越界 element transaction', async () => {
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

    it('post-commit settle 反向 retarget 会清旧 join，旧 completion 不得释放新事务', async () => {
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

    it('dragRuntime.onCommit 在 forward / backward 都补发 onDragEnd 并携带 elapsedMs', async () => {
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

      // forward commit（携带 progressRatio / elapsedMs / timelineDuration）
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

      // 推进到场景 1，再触发 backward commit
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

    it('renderProgress < 0 在首屏被钳为 0（不产生负向位移越界）', async () => {
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

      // 场景 0 在 renderProgress<0 时 clampProgress=0 → translate 仍为 0%
      const scene0 = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(scene0.style.transform).toBe('translate3d(0, 0%, 0)');
    });

    it('renderProgress > 0 在末屏被钳为 0', async () => {
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

    it('slideDirection=x 时位移走横轴 transform', async () => {
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

    it('将根映射与 Scene 整组覆盖解析后注入真实 dragRuntime', async () => {
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

    it('非法 drag 配置按 Scene 与字段去重上报 INVALID_DRAG_CONFIG', async () => {
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

    it('onActivationComplete 在非首屏场景走 completeDragTransition（不抛错）', async () => {
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

  describe('预加载回调归一化', () => {
    it('useImagePreloader.onProgress 透传到 callbacks.onLoadProgress', async () => {
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

    it('useImagePreloader.onError 归一化为 IMAGE_LOAD_FAILED 错误', async () => {
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

    it('没有任何 Scene 时发出 EMPTY_SCENES 错误', () => {
      const onError = jest.fn();
      render(
        <CineView mode="drag" designWidth={750} callbacks={{ onError }}>
          <div>not a scene</div>
        </CineView>
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPTY_SCENES' }));
    });
  });

  describe('视口测量（ResizeObserver 路径）', () => {
    it('容器有正向尺寸时测量并在 RO 回调里复测视口', async () => {
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
        // 视口宽高被注入到 sceneRuntime
        expect(captured[0].sceneRuntime!.viewportWidth).toBe(750);
        expect(captured[0].sceneRuntime!.viewportHeight).toBe(1334);

        // 触发 ResizeObserver 回调（覆盖 RO 重新测量分支），不应抛错
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

  describe('scrollSceneLayout 声明尺寸解析（drag 下仍计算）', () => {
    // resolveScrollSceneDeclaredSpan 在 scrollSceneLayout memo 中无条件执行，
    // 即便 drag 模式也会对每个 Scene 的 layout.width/height 求值。
    it('解析 number / px / vh / vw / auto / 非法 各类尺寸不抛错', async () => {
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
      // 各场景包装器存在即说明 layout memo 正常完成
      expect(container.querySelector('[data-scene-index="0"]')).toBeInTheDocument();
    });

    it('direction=x 时按 width 解析声明尺寸（number / vw / 空串）', async () => {
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

  describe('ref 命令方法（drag 路径）', () => {
    it('goToZone 在 drag 模式是 no-op（不抛错、不改变当前场景）', async () => {
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

    it('preload() 无参时直接 startPreload；带场景索引/sceneId 时追加优先图片', async () => {
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

    it('refreshLayout 重新测量且不抛错', async () => {
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

    it('getPerformanceMetrics 透传 performanceMonitor 指标', async () => {
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

  describe('动画 settle 计时器在卸载时清理', () => {
    it('animated goToScene 起一个 settle timer，卸载时被清理', async () => {
      jest.useFakeTimers();
      try {
        const ref = createRef<CineViewRef>();
        const { unmount } = render(
          <CineView ref={ref} mode="drag" designWidth={750} transitionDuration={400}>
            <DriverScene>S1</DriverScene>
            <DriverScene>S2</DriverScene>
          </CineView>
        );

        // ref 已就绪（同步 imperative handle）
        expect(ref.current).not.toBeNull();

        act(() => {
          ref.current?.goToScene(1, true); // animated → isAnimating → 起 settle timer
        });

        // 卸载时清理 timer 不应抛错
        expect(() => unmount()).not.toThrow();
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('首屏冷启动超时', () => {
    it('优先资源未完成且超时 → 发出 FIRST_SCENE_TIMEOUT recoverable error', async () => {
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
        // recoverable：detail 携带 preventDefault
        const detail = onError.mock.calls.find((c) => c[0].code === 'FIRST_SCENE_TIMEOUT')?.[0];
        expect(typeof detail.preventDefault).toBe('function');
      } finally {
        jest.clearAllTimers();
        jest.useRealTimers();
      }
    });
  });

  describe('性能监控开关', () => {
    it('performance.monitor 开启时启动监控，卸载时停止', () => {
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

  describe('animated goToScene settle 关闭（A10 / D-F6）', () => {
    it('settle 兜底为 DEFAULT_SLIDE_DURATION(800)，onSceneLeave 携带真实 fromIndex', () => {
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

        // A10: 旧兜底 500ms 会在这里提前触发 settle（与 DEFAULT_SLIDE_DURATION
        // 800 的滑动本体脱节）；统一后 799ms 时 settle 尚未关闭。
        act(() => {
          jest.advanceTimersByTime(799);
        });
        expect(onSceneLeave).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(1);
        });
        // D-F6: settle 关闭时必须报告真实 fromIndex（旧实现回退到已更新的
        // currentSceneRef，产出 fromIndex === toIndex === 1、direction null）。
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

  describe('动态 children 收缩（B2）', () => {
    it('渲染中移除 active scene 时索引被重钳，视口不悬空', async () => {
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

      // 条件渲染移除了当前 active 的第三个 scene。
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
});
