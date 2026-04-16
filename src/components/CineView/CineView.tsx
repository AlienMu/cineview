/**
 * CineView 容器组件
 * 提供全局配置上下文，管理响应式尺寸换算、场景切换、事件系统和图片预加载
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  Children,
  isValidElement,
} from 'react';
import { CineViewProvider } from '../../context/CineViewContext';
import { useSceneManager } from '../../hooks/useSceneManager';
import { useImagePreloader } from '../../hooks/useImagePreloader';
import { performanceMonitor } from '../../utils/performanceMonitor';
import type { CineViewProps, CineViewRef, PerformanceMetrics, SceneProps } from '../../types';

/**
 * CineView 组件实现
 */
const CineViewComponent = forwardRef<CineViewRef, CineViewProps>((props, ref) => {
  const {
    config,
    children,
    onInit,
    onBeforeSceneChange,
    onAfterSceneChange,
    onLoadProgress,
    performanceMode = false,
  } = props;

  const { designSize, unit } = config;

  // 场景引用存储（使用 WeakMap 避免内存泄漏）
  // Validates Requirement 26.2: Use WeakMap to store component references
  const animateRefsMap = useRef<Map<string, unknown>>(new Map());

  // Track cleanup timers to clear on unmount
  // Validates Requirement 26.5: Clean up timers on unmount
  const cleanupTimersRef = useRef<Set<NodeJS.Timeout>>(new Set());

  // 收集所有 Scene 子组件
  const scenes = useMemo(() => {
    const sceneArray: React.ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (
        isValidElement(child) &&
        child.type &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (child.type as any).displayName === 'Scene'
      ) {
        sceneArray.push(child);
      }
    });
    return sceneArray;
  }, [children]);

  const totalScenes = scenes.length;

  // 场景管理
  const [sceneState, sceneActions] = useSceneManager({
    totalScenes,
    initialScene: 0,
    mode: 'snap',
    onBeforeChange: onBeforeSceneChange,
    onAfterChange: onAfterSceneChange,
  });

  const { currentScene, isAnimating } = sceneState;

  // 监听场景切换，在动画完成后调用 setAnimating(false)
  useEffect(() => {
    if (!isAnimating) return;

    // 获取当前场景的动画持续时间
    const currentSceneElement = scenes[currentScene];
    if (!currentSceneElement) return;

    const sceneProps = currentSceneElement.props as SceneProps;
    const duration = sceneProps.slideDuration || 500;

    // 等待动画完成后通知 scene manager
    const timer = setTimeout(() => {
      sceneActions.setAnimating(false);
    }, duration);

    // Track timer for cleanup
    const timersRef = cleanupTimersRef.current;
    timersRef.add(timer);

    return (): void => {
      clearTimeout(timer);
      timersRef.delete(timer);
    };
  }, [isAnimating, currentScene, scenes, sceneActions]);

  // 收集所有场景的预加载图片
  const { priorityImages, backgroundImages } = useMemo((): {
    priorityImages: string[];
    backgroundImages: string[];
  } => {
    const priority: string[] = [];
    const background: string[] = [];

    scenes.forEach((scene, index) => {
      const sceneProps = scene.props as SceneProps;
      const images = sceneProps.preloadImages || [];

      if (index === 0) {
        // 首屏图片优先加载
        priority.push(...images);
      } else {
        // 后续场景图片后台加载
        background.push(...images);
      }
    });

    return { priorityImages: priority, backgroundImages: background };
  }, [scenes]);

  // 图片预加载
  const [preloadState, preloadActions] = useImagePreloader({
    priorityUrls: priorityImages,
    backgroundUrls: backgroundImages,
    onProgress: onLoadProgress,
  });

  // 首屏加载完成标志
  const [firstSceneLoaded, setFirstSceneLoaded] = useState(false);

  // 初始化
  useEffect(() => {
    // Validates Requirement 26.5: Capture ref value before cleanup function
    const timersRef = cleanupTimersRef.current;

    // 开始预加载
    preloadActions.startPreload();

    // 性能模式下启动性能监控
    if (performanceMode) {
      performanceMonitor.start();
    }

    // 触发 onInit 回调
    onInit?.();

    return (): void => {
      // Validates Requirement 26.5: Clean up all tracked timers on unmount
      timersRef.forEach((timer) => {
        clearTimeout(timer);
      });
      timersRef.clear();

      // 清理性能监控
      if (performanceMode) {
        performanceMonitor.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 监听首屏图片加载完成
  useEffect(() => {
    // 如果没有优先图片，立即标记为已加载
    if (priorityImages.length === 0) {
      setFirstSceneLoaded(true);
      return;
    }

    // 如果有优先图片，等待加载完成
    if (preloadState.loadedCount >= priorityImages.length && !firstSceneLoaded) {
      setFirstSceneLoaded(true);
    }
  }, [preloadState.loadedCount, priorityImages.length, firstSceneLoaded]);

  // 虚拟化渲染：仅渲染当前场景及前后各一个
  const visibleSceneIndices = useMemo(() => {
    const indices = new Set<number>();

    // 当前场景
    indices.add(currentScene);

    // 前一个场景
    if (currentScene > 0) {
      indices.add(currentScene - 1);
    }

    // 后一个场景
    if (currentScene < totalScenes - 1) {
      indices.add(currentScene + 1);
    }

    return indices;
  }, [currentScene, totalScenes]);

  // API 方法实现
  const goToScene = useCallback(
    (index: number, animated: boolean = true): void => {
      sceneActions.goToScene(index, animated);
    },
    [sceneActions]
  );

  const triggerAnimation = useCallback(
    (sceneIndex: number, animateId?: string): void => {
      // 实现动画触发逻辑
      if (sceneIndex < 0 || sceneIndex >= totalScenes) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(
            `[CineView] Invalid scene index: ${sceneIndex}. Must be between 0 and ${totalScenes - 1}`
          );
        }
        return;
      }

      // 如果指定了 animateId，触发特定动画
      if (animateId) {
        const animateRef = animateRefsMap.current.get(animateId);
        if (animateRef && typeof (animateRef as { trigger?: () => void }).trigger === 'function') {
          (animateRef as { trigger: () => void }).trigger();
        }
      }
    },
    [totalScenes]
  );

  const reload = useCallback((): void => {
    // 重新加载：重置状态并重新初始化
    preloadActions.reset();
    sceneActions.goToScene(0, false);
    setFirstSceneLoaded(false);

    // 重新开始预加载
    setTimeout(() => {
      preloadActions.startPreload();
    }, 0);
  }, [preloadActions, sceneActions]);

  const getCurrentScene = useCallback((): number => {
    return currentScene;
  }, [currentScene]);

  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    const metrics = performanceMonitor.getMetrics();
    return {
      fps: metrics.fps,
      avgFrameTime: metrics.avgFrameTime,
      memoryUsage: metrics.memoryUsage,
      bundleSize: metrics.bundleSize,
    };
  }, []);

  // 暴露 API 方法
  useImperativeHandle(
    ref,
    () => ({
      goToScene,
      triggerAnimation,
      reload,
      getCurrentScene,
      getPerformanceMetrics,
    }),
    [goToScene, triggerAnimation, reload, getCurrentScene, getPerformanceMetrics]
  );

  // 场景切换处理
  const handleSceneChange = useCallback(
    (direction: 'forward' | 'backward') => {
      if (direction === 'forward') {
        sceneActions.nextScene();
      } else {
        sceneActions.prevScene();
      }
    },
    [sceneActions]
  );

  // 渲染场景
  const renderScenes = useCallback((): (JSX.Element | null)[] => {
    return scenes.map((scene, index) => {
      const isVisible = visibleSceneIndices.has(index);
      const isCurrent = index === currentScene;

      // 虚拟化：不可见的场景不渲染
      if (!isVisible) {
        return null;
      }

      // 使用 content-visibility 优化非当前场景
      const sceneStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        visibility: isCurrent ? 'visible' : 'hidden',
        contentVisibility: isCurrent ? 'auto' : 'hidden',
      };

      // Clone scene element and inject props
      const clonedScene = React.cloneElement(scene, {
        isActive: isCurrent,
        sceneIndex: index,
        onSceneChange: handleSceneChange,
      });

      return (
        <div key={index} style={sceneStyle} data-scene-index={index}>
          {clonedScene}
        </div>
      );
    });
  }, [scenes, visibleSceneIndices, currentScene, handleSceneChange]);

  // 开发环境检查
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // 检查是否有 Scene 子组件
      if (totalScenes === 0) {
        console.warn('[CineView] No Scene components found. Please add at least one Scene child.');
      }

      // 检查设计稿尺寸
      if (designSize <= 0) {
        console.error('[CineView] Invalid designSize. Must be greater than 0.');
      }

      // 性能调试模式
      if (performanceMode) {
        console.log('[CineView] Performance mode enabled. Monitoring performance metrics...');
      }
    }
  }, [totalScenes, designSize, performanceMode]);

  // 容器样式
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    overflow: 'hidden',
  };

  return (
    <CineViewProvider designSize={designSize} unit={unit}>
      <div style={containerStyle} className="cineview-container">
        {renderScenes()}
      </div>
    </CineViewProvider>
  );
});

CineViewComponent.displayName = 'CineView';

export const CineView = CineViewComponent;
