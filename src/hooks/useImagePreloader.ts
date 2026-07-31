/**
 * useImagePreloader Hook
 * 管理图片预加载队列和进度
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { markImageAsPreloaded } from './imagePreloadCache';
import { inferMediaKind, preloadMedia } from './mediaPreloadCache';

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

export interface UseImagePreloaderState {
  isLoading: boolean;
  progress: number;
  loadedCount: number;
  totalCount: number;
  results: ImageLoadResult[];
  errors: Map<string, Error>;
  // True once every first-screen priority image has settled (loaded or errored).
  // Drives the first-scene enter animation independently of background images.
  priorityComplete: boolean;
}

export interface UseImagePreloaderActions {
  startPreload: () => Promise<void>;
  reset: () => void;
  addUrls: (urls: string[], priority?: boolean) => void;
}

// 图片加载超时:对既不 onload 也不 onerror 的挂起请求,超时后按加载失败
// {success:false} 结算。否则一张挂起的 priority 图会冻结 progress、阻塞
// background 队列、让 priorityComplete 永不放行(首屏门卡死)。
const IMAGE_LOAD_TIMEOUT_MS = 15_000;

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.filter((url) => url.length > 0)));
}

function resolvePendingBatches(
  priorityQueue: string[],
  backgroundQueue: string[],
  loadedUrls: Set<string>,
  processedUrls: Set<string>
): { priorityBatch: string[]; backgroundBatch: string[] } {
  const priorityBatch = uniqueUrls(priorityQueue).filter(
    (url) => !loadedUrls.has(url) && !processedUrls.has(url)
  );
  const prioritySet = new Set(priorityBatch);
  const backgroundBatch = uniqueUrls(backgroundQueue).filter(
    (url) => !loadedUrls.has(url) && !processedUrls.has(url) && !prioritySet.has(url)
  );

  return { priorityBatch, backgroundBatch };
}

export const useImagePreloader = (
  options: UseImagePreloaderOptions = {}
): [UseImagePreloaderState, UseImagePreloaderActions] => {
  const { priorityUrls = [], backgroundUrls = [], onProgress, onComplete, onError } = options;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(priorityUrls.length + backgroundUrls.length);
  const [results, setResults] = useState<ImageLoadResult[]>([]);
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const [priorityComplete, setPriorityComplete] = useState<boolean>(false);

  const priorityQueueRef = useRef<string[]>([...priorityUrls]);
  const backgroundQueueRef = useRef<string[]>([...backgroundUrls]);
  const loadingRef = useRef<boolean>(false);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeRunIdRef = useRef(0);
  const currentRunPromiseRef = useRef<Promise<void> | null>(null);
  const loadedUrlsRef = useRef<Set<string>>(new Set());
  const processedRunUrlsRef = useRef<Set<string>>(new Set());
  const runLoadedCountRef = useRef(0);
  const runTotalCountRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onProgress, onComplete, onError]);

  const enqueueUrls = useCallback((urls: string[], priority: boolean) => {
    const incoming = uniqueUrls(urls).filter((url) => !loadedUrlsRef.current.has(url));
    if (incoming.length === 0) {
      return;
    }

    const currentPriority = new Set(priorityQueueRef.current);
    const currentBackground = new Set(backgroundQueueRef.current);
    const filtered = incoming.filter(
      (url) => !currentPriority.has(url) && !currentBackground.has(url)
    );

    if (filtered.length === 0) {
      return;
    }

    if (priority) {
      priorityQueueRef.current = [...priorityQueueRef.current, ...filtered];
    } else {
      backgroundQueueRef.current = [...backgroundQueueRef.current, ...filtered];
    }
  }, []);

  useEffect(() => {
    enqueueUrls(priorityUrls, true);
    enqueueUrls(backgroundUrls, false);
    if (!loadingRef.current) {
      setTotalCount(priorityQueueRef.current.length + backgroundQueueRef.current.length);
    }
  }, [priorityUrls, backgroundUrls, enqueueUrls]);

  // 加载单个资源。video 走 mediaPreloadCache(blob buffer),普通图片走 Image()。
  // 媒体资源经此路径进入同一优先级批次,故 priorityComplete 会等首屏 video buffer
  // 完才 fire——首屏冷启动门控天然覆盖媒体,无需额外信号。
  // Validates Requirement 26.3: Cancel pending image loads on unmount
  const loadImage = useCallback((url: string, runId: number): Promise<ImageLoadResult> => {
    const mediaKind = inferMediaKind(url);
    if (mediaKind) {
      // 媒体预加载不支持 AbortController;卸载时靠 run-id 守卫忽略结果(见 startPreload)。
      return preloadMedia(url, mediaKind)
        .then((): ImageLoadResult => {
          markImageAsPreloaded(url);
          return { url, success: true };
        })
        .catch((error: unknown): ImageLoadResult => {
          const wrapped = error instanceof Error ? error : new Error(String(error));
          if (activeRunIdRef.current === runId) {
            onErrorRef.current?.(url, wrapped);
          }
          return { url, success: false, error: wrapped };
        });
    }
    return new Promise((resolve) => {
      const img = new Image();
      const controller = new AbortController();
      abortControllersRef.current.set(url, controller);

      let settled = false;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      // 单一结算出口:清理监听/定时器并 resolve,幂等(load/error/abort/timeout
      // 竞争时只有第一个生效)。
      const settle = (result: ImageLoadResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutTimer !== null) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        abortControllersRef.current.delete(url);
        resolve(result);
      };

      img.onload = (): void => {
        markImageAsPreloaded(url);
        settle({ url, success: true });
      };

      img.onerror = (): void => {
        const error = new Error(`Failed to load image: ${url}`);
        if (activeRunIdRef.current === runId) {
          onErrorRef.current?.(url, error);
        }
        settle({ url, success: false, error });
      };

      // Validates Requirement 26.3: Support AbortController for cancellation
      // When abort is called, the image loading is cancelled immediately
      controller.signal.addEventListener('abort', (): void => {
        // Clear the image src to stop loading
        img.src = '';
        settle({ url, success: false, error: new Error('Image load aborted') });
      });

      // 挂起请求(既不 load 也不 error)超时:按加载失败结算并停止加载,
      // 保证 progress / priorityComplete 不被一张挂起图永久卡死。
      timeoutTimer = setTimeout(() => {
        timeoutTimer = null;
        img.onload = null;
        img.onerror = null;
        img.src = '';
        const error = new Error(`Image load timed out after ${IMAGE_LOAD_TIMEOUT_MS}ms: ${url}`);
        if (activeRunIdRef.current === runId) {
          onErrorRef.current?.(url, error);
        }
        settle({ url, success: false, error });
      }, IMAGE_LOAD_TIMEOUT_MS);

      img.src = url;
    });
  }, []);

  // 更新进度
  const updateProgress = useCallback((loaded: number, total: number) => {
    const safeTotal = Math.max(total, 0);
    const safeLoaded = safeTotal > 0 ? Math.min(Math.max(loaded, 0), safeTotal) : 0;
    const newProgress = safeTotal > 0 ? Math.round((safeLoaded / safeTotal) * 100) : 100;
    setProgress(newProgress);
    setLoadedCount(safeLoaded);
    onProgressRef.current?.(newProgress);
  }, []);

  // 开始预加载
  const startPreload = useCallback((): Promise<void> => {
    if (loadingRef.current) {
      return currentRunPromiseRef.current ?? Promise.resolve();
    }

    const runPromise = (async (): Promise<void> => {
      const runId = activeRunIdRef.current + 1;
      activeRunIdRef.current = runId;
      loadingRef.current = true;
      setIsLoading(true);
      setProgress(0);
      setLoadedCount(0);
      setResults([]);
      setErrors(new Map());
      setPriorityComplete(false);
      processedRunUrlsRef.current = new Set();
      runLoadedCountRef.current = 0;
      runTotalCountRef.current = 0;

      const initialBatches = resolvePendingBatches(
        priorityQueueRef.current,
        backgroundQueueRef.current,
        loadedUrlsRef.current,
        processedRunUrlsRef.current
      );
      const initialTotal =
        initialBatches.priorityBatch.length + initialBatches.backgroundBatch.length;
      runTotalCountRef.current = initialTotal;
      setTotalCount(initialTotal);

      if (initialTotal === 0) {
        updateProgress(0, 0);
        if (activeRunIdRef.current === runId) {
          setIsLoading(false);
          setPriorityComplete(true);
        }
        loadingRef.current = false;
        onCompleteRef.current?.([]);
        return;
      }

      // First-screen priority URLs captured at run start. priorityComplete
      // fires once every one of these has settled (loaded or errored), which
      // gates the first-scene enter animation independently of background
      // images. URLs added later via addUrls do not affect this signal.
      const initialPriorityUrls = new Set(initialBatches.priorityBatch);
      let priorityCompleteFired = initialPriorityUrls.size === 0;
      if (priorityCompleteFired) {
        setPriorityComplete(true);
      }

      const loadResults: ImageLoadResult[] = [];
      const errorMap = new Map<string, Error>();

      const syncRunTotals = (): { priorityBatch: string[]; backgroundBatch: string[] } => {
        const batches = resolvePendingBatches(
          priorityQueueRef.current,
          backgroundQueueRef.current,
          loadedUrlsRef.current,
          processedRunUrlsRef.current
        );
        runTotalCountRef.current =
          runLoadedCountRef.current + batches.priorityBatch.length + batches.backgroundBatch.length;
        setTotalCount(runTotalCountRef.current);
        return batches;
      };

      const commitResult = (url: string, result: ImageLoadResult): void => {
        loadResults.push(result);
        processedRunUrlsRef.current.add(url);
        runLoadedCountRef.current += 1;

        if (!result.success && result.error) {
          errorMap.set(url, result.error);
        } else if (result.success) {
          loadedUrlsRef.current.add(url);
        }

        updateProgress(runLoadedCountRef.current, runTotalCountRef.current);

        if (!priorityCompleteFired) {
          initialPriorityUrls.delete(url);
          if (initialPriorityUrls.size === 0) {
            priorityCompleteFired = true;
            setPriorityComplete(true);
          }
        }
      };

      for (;;) {
        const { priorityBatch, backgroundBatch } = syncRunTotals();
        if (priorityBatch.length === 0 && backgroundBatch.length === 0) {
          break;
        }

        // Priority 批并发加载:priorityComplete 的等待时间取决于最慢一张,而非各图
        // 之和(旧实现逐张串行 await)。逐张 settle 即 commit(保持进度递增与
        // priorityComplete 尽早放行);runId 守卫防止被 reset/unmount 取代的 run 提交。
        await Promise.all(
          priorityBatch.map(async (url) => {
            const result = await loadImage(url, runId);
            if (activeRunIdRef.current !== runId) {
              return;
            }
            commitResult(url, result);
          })
        );

        if (activeRunIdRef.current !== runId) {
          return;
        }

        const backgroundResults = await Promise.all(
          backgroundBatch.map(async (url) => ({
            url,
            result: await loadImage(url, runId),
          }))
        );

        if (activeRunIdRef.current !== runId) {
          return;
        }

        backgroundResults.forEach(({ url, result }) => {
          commitResult(url, result);
        });
      }

      setResults(loadResults);
      setErrors(errorMap);
      setIsLoading(false);
      loadingRef.current = false;
      setTotalCount(priorityQueueRef.current.length + backgroundQueueRef.current.length);
      onCompleteRef.current?.(loadResults);
    })();

    currentRunPromiseRef.current = runPromise.finally(() => {
      if (currentRunPromiseRef.current === runPromise) {
        currentRunPromiseRef.current = null;
      }
    });

    return currentRunPromiseRef.current;
  }, [loadImage, updateProgress]);

  // 重置状态
  // Validates Requirement 26.3: Cancel pending image loads on unmount
  const reset = useCallback(() => {
    activeRunIdRef.current += 1;
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
    setTotalCount(priorityQueueRef.current.length + backgroundQueueRef.current.length);
    setResults([]);
    setErrors(new Map());
    setPriorityComplete(false);
    loadedUrlsRef.current.clear();
    processedRunUrlsRef.current.clear();
    runLoadedCountRef.current = 0;
    runTotalCountRef.current = 0;
    loadingRef.current = false;
    currentRunPromiseRef.current = null;
  }, []);

  // 添加新的 URL
  const addUrls = useCallback(
    (urls: string[], priority: boolean = false) => {
      enqueueUrls(urls, priority);

      const { priorityBatch, backgroundBatch } = resolvePendingBatches(
        priorityQueueRef.current,
        backgroundQueueRef.current,
        loadedUrlsRef.current,
        processedRunUrlsRef.current
      );
      const nextTotal = loadingRef.current
        ? runLoadedCountRef.current + priorityBatch.length + backgroundBatch.length
        : priorityBatch.length + backgroundBatch.length;

      if (loadingRef.current) {
        runTotalCountRef.current = nextTotal;
      }
      setTotalCount(nextTotal);
    },
    [enqueueUrls]
  );

  // 组件卸载时清理
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return (): void => {
      activeRunIdRef.current += 1;
      loadingRef.current = false;
      currentRunPromiseRef.current = null;
      controllers.forEach((controller) => {
        controller.abort();
      });
      controllers.clear();
    };
  }, []);

  const state: UseImagePreloaderState = {
    isLoading,
    progress,
    loadedCount,
    totalCount,
    results,
    errors,
    priorityComplete,
  };

  const actions: UseImagePreloaderActions = {
    startPreload,
    reset,
    addUrls,
  };

  return [state, actions];
};
