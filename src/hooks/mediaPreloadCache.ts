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

/** 逐出最久未用项直到总字节 ≤ 预算。保护当前正在插入的 src(protect)。 */
function evictToBudget(protect: string): void {
  for (const [src, entry] of cache) {
    if (totalBytes <= byteBudget) {
      break;
    }
    if (src === protect) {
      continue;
    }
    cache.delete(src);
    readyUrls.delete(src);
    totalBytes -= entry.bytes;
    revoke(entry.objectUrl);
  }
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

async function runVideoPreload(src: string): Promise<void> {
  const response = await fetch(src);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  insert(src, { kind: 'video', objectUrl, bytes: blob.size });
  notify(src);
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
  totalBytes = 0;
  byteBudget = DEFAULT_BYTE_BUDGET;
}
