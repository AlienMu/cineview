/**
 * Preloader 组件
 * 管理图片预加载队列、优先级和进度
 */

import { useEffect, useCallback, useRef } from 'react';

export interface PreloaderProps {
  /** 首屏图片 URL 列表（优先加载） */
  priorityImages: string[];
  /** 后续场景图片 URL 列表（后台加载） */
  backgroundImages?: string[];
  /** 加载进度回调 (0-100) */
  onProgress?: (progress: number) => void;
  /** 首屏加载完成回调 */
  onFirstSceneLoaded?: () => void;
  /** 全部加载完成回调 */
  onAllLoaded?: () => void;
  /** 加载失败回调 */
  onError?: (url: string, error: Error) => void;
  children?: React.ReactNode;
}

interface ImageLoadResult {
  url: string;
  success: boolean;
  error?: Error;
}

/**
 * 检测浏览器是否支持 WebP 格式
 */
const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = (): void => {
      resolve(webP.height === 2);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * 将图片 URL 转换为 WebP 格式（如果支持）
 */
const getWebPUrl = (url: string, supportsWebP: boolean): string => {
  if (!supportsWebP) return url;

  // 如果 URL 已经是 WebP，直接返回
  if (url.endsWith('.webp')) return url;

  // 简单的 fallback 策略：尝试将扩展名替换为 .webp
  // 实际项目中可能需要更复杂的逻辑
  const webpUrl = url.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return webpUrl;
};

/**
 * 验证图片 URL 协议
 */
const validateImageUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url, window.location.href);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Preloader 组件
 */
export const Preloader: React.FC<PreloaderProps> = ({
  priorityImages,
  backgroundImages = [],
  onProgress,
  onFirstSceneLoaded,
  onAllLoaded,
  onError,
  children,
}) => {
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const loadedCountRef = useRef<number>(0);
  const totalCountRef = useRef<number>(0);
  const firstSceneLoadedRef = useRef<boolean>(false);
  const supportsWebPRef = useRef<boolean>(false);

  /**
   * 加载单张图片
   */
  const loadImage = useCallback(
    (url: string, useWebP: boolean): Promise<ImageLoadResult> => {
      return new Promise((resolve) => {
        // 验证 URL
        if (!validateImageUrl(url)) {
          const error = new Error(`Invalid image URL protocol: ${url}`);
          onError?.(url, error);
          resolve({ url, success: false, error });
          return;
        }

        const finalUrl = useWebP ? getWebPUrl(url, supportsWebPRef.current) : url;
        const img = new Image();
        const controller = new AbortController();
        abortControllersRef.current.set(url, controller);

        const cleanup = (): void => {
          abortControllersRef.current.delete(url);
        };

        img.onload = (): void => {
          cleanup();
          resolve({ url, success: true });
        };

        img.onerror = (): void => {
          cleanup();

          // 如果 WebP 加载失败，尝试加载原始格式
          if (useWebP && finalUrl !== url) {
            loadImage(url, false).then(resolve);
            return;
          }

          const error = new Error(`Failed to load image: ${url}`);
          onError?.(url, error);
          resolve({ url, success: false, error });
        };

        // 支持 AbortController
        controller.signal.addEventListener('abort', (): void => {
          img.src = '';
          cleanup();
          resolve({ url, success: false, error: new Error('Aborted') });
        });

        img.src = finalUrl;
      });
    },
    [onError]
  );

  /**
   * 更新加载进度
   */
  const updateProgress = useCallback(
    (loaded: number, total: number): void => {
      const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
      onProgress?.(progress);
    },
    [onProgress]
  );

  /**
   * 开始预加载
   */
  const startPreload = useCallback(async (): Promise<void> => {
    // 检测 WebP 支持
    supportsWebPRef.current = await checkWebPSupport();

    const allImages = [...priorityImages, ...backgroundImages];
    totalCountRef.current = allImages.length;

    if (totalCountRef.current === 0) {
      onProgress?.(100);
      onFirstSceneLoaded?.();
      onAllLoaded?.();
      return;
    }

    // 优先加载首屏图片
    for (let i = 0; i < priorityImages.length; i++) {
      const url = priorityImages[i];
      await loadImage(url, true);

      loadedCountRef.current++;
      updateProgress(loadedCountRef.current, totalCountRef.current);
    }

    // 首屏加载完成
    if (!firstSceneLoadedRef.current) {
      firstSceneLoadedRef.current = true;
      onFirstSceneLoaded?.();
    }

    // 后台静默加载后续场景图片
    if (backgroundImages.length > 0) {
      const backgroundPromises = backgroundImages.map((url) =>
        loadImage(url, true).then(() => {
          loadedCountRef.current++;
          updateProgress(loadedCountRef.current, totalCountRef.current);
        })
      );

      await Promise.all(backgroundPromises);
    }

    // 全部加载完成
    onAllLoaded?.();
  }, [
    priorityImages,
    backgroundImages,
    loadImage,
    updateProgress,
    onProgress,
    onFirstSceneLoaded,
    onAllLoaded,
  ]);

  /**
   * 组件挂载时开始预加载
   */
  useEffect(() => {
    startPreload();

    // 组件卸载时取消所有加载
    const controllers = abortControllersRef.current;
    return (): void => {
      controllers.forEach((controller) => {
        controller.abort();
      });
      controllers.clear();
    };
  }, [startPreload]);

  return <>{children}</>;
};

Preloader.displayName = 'Preloader';
