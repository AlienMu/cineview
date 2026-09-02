/**
 * 媒体预加载缓存(video blob),与 imagePreloadCache 平行。
 *
 * 与图片的区别:图片 `onload` 即可用,但 video scrub 要求**整段 buffer 可 seek**。本缓存
 * 把「已就绪」定义为「video blob 已取到、可 seek」,并在首屏冷启动门控里作为
 * priorityComplete 的一部分等待。淘汰时 revoke objectURL。SSR/无 window 时不启动。
 */

export type MediaKind = 'video';

interface VideoEntry {
  kind: 'video';
  objectUrl: string;
  bytes: number;
}

// 默认 LRU 字节预算:128 MB。超预算逐出最久未用项(并 revoke objectURL)。
const DEFAULT_BYTE_BUDGET = 128 * 1024 * 1024;

const cache = new Map<string, VideoEntry>(); // Map 迭代序 = 插入序,用于 LRU
const readyUrls = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<(url: string) => void>();
// Mounted video consumers hold a lease while their `src` points at an objectURL.
// LRU eviction must not revoke a URL that the browser is actively decoding.
const activeLeases = new Map<string, number>();
let byteBudget = DEFAULT_BYTE_BUDGET;
let totalBytes = 0;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i;

/** 从 URL 后缀推断媒体类型;非视频返回 null(调用方可显式传 kind)。 */
export function inferMediaKind(src: string): MediaKind | null {
  return VIDEO_EXT.test(src) ? 'video' : null;
}

export function isMediaPreloaded(src: string): boolean {
  return src.length > 0 && readyUrls.has(src);
}

export function getVideoObjectUrl(src: string): string | undefined {
  const entry = cache.get(src);
  if (entry) {
    touch(src);
    return entry.objectUrl;
  }
  return undefined;
}

export function subscribeToPreloadedMedia(listener: (url: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(src: string): void {
  const hadUrl = readyUrls.has(src);
  readyUrls.add(src);
  if (!hadUrl) {
    listeners.forEach((listener) => listener(src));
  }
}

/** LRU touch:把 src 移到 Map 末尾(最近使用)。 */
function touch(src: string): void {
  const entry = cache.get(src);
  if (entry) {
    cache.delete(src);
    cache.set(src, entry);
  }
}

function revoke(objectUrl: string): void {
  if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(objectUrl);
  }
}

/** 逐出最久未用项直到总字节 ≤ 预算。保护当前插入项及挂载中 consumer 的 URL。 */
function evictToBudget(protect: string): void {
  for (const [src, entry] of cache) {
    if (totalBytes <= byteBudget) {
      break;
    }
    if (src === protect || (activeLeases.get(src) ?? 0) > 0) {
      continue;
    }
    cache.delete(src);
    readyUrls.delete(src);
    totalBytes -= entry.bytes;
    revoke(entry.objectUrl);
  }
}

/**
 * 为挂载中的 video consumer 获取并租用 objectURL。租约存在期间 LRU 不得 revoke。
 * 每次成功 acquire 必须与一次 release 配对。
 */
export function acquireVideoObjectUrl(src: string): string | undefined {
  const entry = cache.get(src);
  if (!entry) {
    return undefined;
  }
  touch(src);
  activeLeases.set(src, (activeLeases.get(src) ?? 0) + 1);
  return entry.objectUrl;
}

/** 释放挂载 consumer 的租约；最后一个租约释放后立即重试预算淘汰。 */
export function releaseVideoObjectUrl(src: string): void {
  const count = activeLeases.get(src) ?? 0;
  if (count <= 1) {
    activeLeases.delete(src);
  } else {
    activeLeases.set(src, count - 1);
  }
  evictToBudget('');
}

function insert(src: string, entry: VideoEntry): void {
  const existing = cache.get(src);
  if (existing) {
    totalBytes -= existing.bytes;
    revoke(existing.objectUrl);
  }
  cache.set(src, entry);
  totalBytes += entry.bytes;
  evictToBudget(src);
}

// 视频 fetch 超时:挂起的 priority 媒体会永久卡死 priorityComplete 首屏门。video blob
// 是整段下载(体积远大于图片,AbortSignal 同时覆盖 header 与 body 读取),给 30s,
// 比图片侧 useImagePreloader 的 15s 宽。
const VIDEO_FETCH_TIMEOUT_MS = 30_000;

async function runVideoPreload(src: string): Promise<void> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutTimer = controller
    ? setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(src, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) {
      // 404/500 的 HTML 错误页不是视频:绝不能进入 cache/readyUrls(否则永久污染、
      // 后续无法重试)。以 Error reject,沿 useImagePreloader 的 {success:false}
      // 失败链路结算(onError / errors);in-flight 记录由 preloadMedia 的 finally
      // 清理,保证重试可再发起。
      throw new Error(`Failed to preload media: ${src} (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    insert(src, { kind: 'video', objectUrl, bytes: blob.size });
    notify(src);
  } catch (error) {
    if (controller?.signal.aborted) {
      // Keep the abort/network error attached: the timeout message alone says the
      // deadline passed, not what the fetch was actually doing when it did.
      // Assigned rather than passed to the constructor — the two-argument `Error`
      // form needs lib ES2022, while this package targets ES2020 and declares
      // support down to Safari 14. As a property it is inert where unsupported.
      const timeoutError = new Error(
        `Media preload timed out after ${VIDEO_FETCH_TIMEOUT_MS}ms: ${src}`
      );
      (timeoutError as Error & { cause?: unknown }).cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeoutTimer !== null) {
      clearTimeout(timeoutTimer);
    }
  }
}

/**
 * 预加载一个媒体资源。已就绪 → 立即 resolve;进行中 → 复用同一 Promise(去重)。
 * kind 缺省时按后缀推断;推断失败则 reject。失败会清理 in-flight 记录,使后续可重试。
 */
export function preloadMedia(src: string, kind?: MediaKind): Promise<void> {
  if (!src) {
    return Promise.resolve();
  }
  if (readyUrls.has(src)) {
    return Promise.resolve();
  }
  const existing = inflight.get(src);
  if (existing) {
    return existing;
  }
  if (typeof fetch === 'undefined') {
    return Promise.reject(new Error('preloadMedia 需要 fetch(仅客户端可用)'));
  }

  const resolvedKind = kind ?? inferMediaKind(src);
  if (!resolvedKind) {
    return Promise.reject(new Error(`无法判定媒体类型: ${src}(请显式传 kind)`));
  }

  const tracked = runVideoPreload(src).finally(() => {
    inflight.delete(src);
  });
  inflight.set(src, tracked);
  return tracked;
}

/** 设置 LRU 字节预算(默认 128MB)。设置后立即按新预算淘汰。 */
export function setMediaByteBudget(bytes: number): void {
  byteBudget = Math.max(0, bytes);
  evictToBudget('');
}

/** 测试/热重置:清空缓存并 revoke 所有 objectURL。 */
export function resetMediaPreloadCache(): void {
  for (const entry of cache.values()) {
    revoke(entry.objectUrl);
  }
  cache.clear();
  readyUrls.clear();
  inflight.clear();
  listeners.clear();
  activeLeases.clear();
  totalBytes = 0;
  byteBudget = DEFAULT_BYTE_BUDGET;
}
