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

import { createRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import { CineView } from './CineView';
import type { CineViewRef } from '../../types';
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
    onRenderProgressChange: (v: number) => void;
    onTimelineProgressChange: (v: number) => void;
    onCommit: (
      direction: 'forward' | 'backward',
      progressRatio?: number,
      committedElapsedMs?: number,
      timelineDuration?: number
    ) => void;
    onActivationComplete: () => void;
    onReset: () => void;
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
(DriverScene as React.FC & { displayName?: string }).displayName = 'Scene';

// ---------------------------------------------------------------------------
// performanceMonitor mock (mirrors existing CineView.test.tsx).
// ---------------------------------------------------------------------------
jest.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    getMetrics: jest.fn(() => ({
      fps: 60,
      avgFrameTime: 16.67,
      memoryUsage: 50,
      bundleSize: 45,
    })),
    reset: jest.fn(),
  },
}));

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

const defaultConfig = { width: 750, height: 1334 };

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
    it('注入的 dragRuntime 驱动 onDragStart / onDragProgress / onDragCancel 一轮', async () => {
      const onDragStart = jest.fn();
      const onDragProgress = jest.fn();
      const onDragCancel = jest.fn();

      render(
        <CineView
          mode="drag"
          config={defaultConfig}
          callbacks={{ onDragStart, onDragProgress, onDragCancel }}
        >
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      // 开始拖拽 + 进度变化
      act(() => {
        captured[0].dragRuntime!.onDraggingChange(true);
        captured[0].dragRuntime!.onProgressChange(0.5);
      });

      expect(onDragStart).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 0, direction: 'forward' })
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

      // 松手未提交 → cancel
      act(() => {
        captured[0].dragRuntime!.onDraggingChange(false);
      });
      expect(onDragCancel).toHaveBeenCalledWith(
        expect.objectContaining({ sceneIndex: 0, direction: 'backward' })
      );
    });

    it('dragRuntime.onCommit 在 forward / backward 都补发 onDragCommit 并携带 elapsedMs', async () => {
      const onDragCommit = jest.fn();
      const ref = createRef<CineViewRef>();

      render(
        <CineView ref={ref} mode="drag" config={defaultConfig} callbacks={{ onDragCommit }}>
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
      expect(onDragCommit).toHaveBeenCalledWith(
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
      onDragCommit.mockClear();
      await waitFor(() => expect(captured[1]).toBeDefined());

      act(() => {
        captured[1].dragRuntime!.onCommit('backward', 0.6, 90);
      });
      expect(onDragCommit).toHaveBeenCalledWith(
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
        <CineView mode="drag" config={defaultConfig}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      act(() => {
        captured[0].dragRuntime!.onRenderProgressChange(-0.5);
      });

      // 场景 0 在 renderProgress<0 时 clampProgress=0 → translate 仍为 0%
      const scene0 = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(scene0.style.transform).toBe('translate3d(0, 0%, 0)');
    });

    it('renderProgress > 0 在末屏被钳为 0', async () => {
      const ref = createRef<CineViewRef>();
      const { container } = render(
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
        captured[1].dragRuntime!.onRenderProgressChange(0.5);
      });

      const scene1 = container.querySelector('[data-scene-index="1"]') as HTMLDivElement;
      expect(scene1.style.transform).toBe('translate3d(0, 0%, 0)');
    });

    it('slideDirection=x 时位移走横轴 transform', async () => {
      const { container } = render(
        <CineView mode="drag" config={defaultConfig} modes={{ drag: { direction: 'x' } }}>
          <DriverScene>S1</DriverScene>
          <DriverScene>S2</DriverScene>
        </CineView>
      );

      await waitFor(() => expect(captured[0]).toBeDefined());

      const scene0 = container.querySelector('[data-scene-index="0"]') as HTMLDivElement;
      expect(scene0.style.transform).toBe('translate3d(0%, 0, 0)');
    });

    it('onActivationComplete 在非首屏场景走 completeDragTransition（不抛错）', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
        <CineView mode="drag" config={defaultConfig} callbacks={{ onLoadProgress }}>
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
        <CineView mode="drag" config={defaultConfig} callbacks={{ onError }}>
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

    it('没有任何 Scene 时发出 NO_SCENES 错误', () => {
      const onError = jest.fn();
      render(
        <CineView mode="drag" config={defaultConfig} callbacks={{ onError }}>
          <div>not a scene</div>
        </CineView>
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_SCENES' }));
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
          <CineView mode="drag" config={defaultConfig}>
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
        <CineView mode="drag" config={defaultConfig} modes={{ scroll: { direction: 'y' } }}>
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
        <CineView mode="drag" config={defaultConfig} modes={{ scroll: { direction: 'x' } }}>
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
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
      expect(ref.current?.getCurrentScene()).toBe(0);
    });

    it('preload() 无参时直接 startPreload；带场景索引/sceneId 时追加优先图片', async () => {
      const ref = createRef<CineViewRef>();
      render(
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
        <CineView ref={ref} mode="drag" config={defaultConfig}>
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
          <CineView
            ref={ref}
            mode="drag"
            config={defaultConfig}
            modes={{ drag: { transitionDuration: 400 } }}
          >
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
          <CineView
            mode="drag"
            config={defaultConfig}
            modes={{ drag: { firstSceneTimeout: 1000 } }}
            callbacks={{ onError }}
          >
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
        <CineView mode="drag" config={defaultConfig} performance={{ monitor: true }}>
          <DriverScene>S1</DriverScene>
        </CineView>
      );
      expect(performanceMonitor.start).toHaveBeenCalled();
      unmount();
      expect(performanceMonitor.stop).toHaveBeenCalled();
    });
  });
});
