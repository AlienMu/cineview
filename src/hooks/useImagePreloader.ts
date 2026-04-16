/**
 * useImagePreloader Hook
 * 管理图片预加载队列和进度
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface ImageLoadResult {
  url: string;
  success: boolean;
  error?: Error;
}

export interface UseImagePreloaderOptions {
  priorityUrls?: string[];
  backgroundUrls?: string[];
  onProgress?: (progress: number) => void;
  onComplete?: (results: ImageLoadResult[]) => void;
  onError?: (url: string, error: Error) => void;
}

export interface ImagePreloaderState {
  isLoading: boolean;
  progress: number;
  loadedCount: number;
  totalCount: number;
  results: ImageLoadResult[];
  errors: Map<string, Error>;
}

export interface ImagePreloaderActions {
  startPreload: () => void;
  reset: () => void;
  addUrls: (urls: string[], priority?: boolean) => void;
}

export const useImagePreloader = (
  options: UseImagePreloaderOptions = {}
): [ImagePreloaderState, ImagePreloaderActions] => {
  const { priorityUrls = [], backgroundUrls = [], onProgress, onComplete, onError } = options;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [results, setResults] = useState<ImageLoadResult[]>([]);
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());

  const priorityQueueRef = useRef<string[]>([...priorityUrls]);
  const backgroundQueueRef = useRef<string[]>([...backgroundUrls]);
  const loadingRef = useRef<boolean>(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const totalCount = priorityQueueRef.current.length + backgroundQueueRef.current.length;

  // 加载单张图片
  // Validates Requirement 26.3: Cancel pending image loads on unmount
  const loadImage = useCallback(
    (url: string): Promise<ImageLoadResult> => {
      return new Promise((resolve) => {
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
          const error = new Error(`Failed to load image: ${url}`);
          cleanup();
          onError?.(url, error);
          resolve({ url, success: false, error });
        };

        // Validates Requirement 26.3: Support AbortController for cancellation
        // When abort is called, the image loading is cancelled immediately
        controller.signal.addEventListener('abort', (): void => {
          // Clear the image src to stop loading
          img.src = '';
          cleanup();
          resolve({ url, success: false, error: new Error('Image load aborted') });
        });

        img.src = url;
      });
    },
    [onError]
  );

  // 更新进度
  const updateProgress = useCallback(
    (loaded: number, total: number) => {
      const newProgress = total > 0 ? Math.round((loaded / total) * 100) : 0;
      setProgress(newProgress);
      setLoadedCount(loaded);
      onProgress?.(newProgress);
    },
    [onProgress]
  );

  // 开始预加载
  const startPreload = useCallback(async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);
    setProgress(0);
    setLoadedCount(0);
    setResults([]);
    setErrors(new Map());

    const allUrls = [...priorityQueueRef.current, ...backgroundQueueRef.current];
    const total = allUrls.length;

    if (total === 0) {
      setIsLoading(false);
      loadingRef.current = false;
      onComplete?.([]);
      return;
    }

    const loadResults: ImageLoadResult[] = [];
    const errorMap = new Map<string, Error>();

    // 优先加载首屏图片
    for (let i = 0; i < priorityQueueRef.current.length; i++) {
      const url = priorityQueueRef.current[i];
      const result = await loadImage(url);
      loadResults.push(result);

      if (!result.success && result.error) {
        errorMap.set(url, result.error);
      }

      updateProgress(loadResults.length, total);
    }

    // 后台加载后续图片
    const backgroundPromises = backgroundQueueRef.current.map((url) =>
      loadImage(url).then((result) => {
        loadResults.push(result);

        if (!result.success && result.error) {
          errorMap.set(url, result.error);
        }

        updateProgress(loadResults.length, total);
        return result;
      })
    );

    await Promise.all(backgroundPromises);

    setResults(loadResults);
    setErrors(errorMap);
    setIsLoading(false);
    loadingRef.current = false;
    onComplete?.(loadResults);
  }, [loadImage, updateProgress, onComplete]);

  // 重置状态
  // Validates Requirement 26.3: Cancel pending image loads on unmount
  const reset = useCallback(() => {
    // 取消所有正在加载的图片
    // This ensures that when the component unmounts or resets,
    // all pending image loads are cancelled to free up resources
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();

    setIsLoading(false);
    setProgress(0);
    setLoadedCount(0);
    setResults([]);
    setErrors(new Map());
    loadingRef.current = false;
  }, []);

  // 添加新的 URL
  const addUrls = useCallback((urls: string[], priority: boolean = false) => {
    if (priority) {
      priorityQueueRef.current = [...priorityQueueRef.current, ...urls];
    } else {
      backgroundQueueRef.current = [...backgroundQueueRef.current, ...urls];
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return (): void => {
      controllers.forEach((controller) => {
        controller.abort();
      });
      controllers.clear();
    };
  }, []);

  const state: ImagePreloaderState = {
    isLoading,
    progress,
    loadedCount,
    totalCount,
    results,
    errors,
  };

  const actions: ImagePreloaderActions = {
    startPreload,
    reset,
    addUrls,
  };

  return [state, actions];
};
