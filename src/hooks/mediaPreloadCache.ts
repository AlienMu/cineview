/**
 * Media preload cache (video blobs), parallel to imagePreloadCache.
 *
 * Unlike images where `onload` means ready, video scrub requires the entire
 * buffer to be seekable. This cache defines "ready" as "video blob fetched
 * and seekable", and waits for it as part of priorityComplete in the first-screen
 * cold-start gate. Eviction revokes objectURLs. Disabled in SSR/no-window environments.
 */

export type MediaKind = 'video';

interface VideoEntry {
  kind: 'video';
  objectUrl: string;
  bytes: number;
}

// Default LRU byte budget: 128 MB. When exceeded, evicts least-recently-used entries (and revokes their objectURLs).
const DEFAULT_BYTE_BUDGET = 128 * 1024 * 1024;

const cache = new Map<string, VideoEntry>(); // Map iteration order = insertion order, used for LRU
const readyUrls = new Set<string>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<(url: string) => void>();
// Mounted video consumers hold a lease while their `src` points at an objectURL.
// LRU eviction must not revoke a URL that the browser is actively decoding.
const activeLeases = new Map<string, number>();
let byteBudget = DEFAULT_BYTE_BUDGET;
let totalBytes = 0;

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg)(\?|#|$)/i;

/** Infers media type from URL extension; returns null for non-video (caller can pass explicit kind). */
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

/** LRU touch: moves src to end of Map (most recently used). */
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

/** Evicts least-recently-used entries until total bytes ≤ budget. Protects the current insert and URLs held by mounted consumers. */
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
 * Acquires and leases an objectURL for a mounted video consumer. LRU must not revoke
 * URLs while leases exist. Each successful acquire must be paired with one release.
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

/** Releases the mounted consumer's lease; retries budget eviction immediately after the last lease is released. */
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

// Video fetch timeout: hung priority media would deadlock priorityComplete first-screen gate.
// Video blobs are full downloads (much larger than images; AbortSignal covers both headers
// and body reads). Allow 30s, double the 15s timeout in useImagePreloader.
const VIDEO_FETCH_TIMEOUT_MS = 30_000;

async function runVideoPreload(src: string): Promise<void> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutTimer = controller
    ? setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(src, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) {
      // 404/500 HTML error pages are not videos: must never enter cache/readyUrls
      // (would poison cache permanently, blocking retries). Reject with Error,
      // following useImagePreloader's {success:false} failure path (onError / errors).
      // In-flight record cleaned by preloadMedia's finally, allowing retries.
      throw new Error(`Failed to preload media: ${src} (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    if (!blob) {
      throw new Error(`Invalid blob response for media: ${src}`);
    }
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
 * Preloads a media resource. Already ready → resolves immediately; in-flight → reuses
 * same Promise (deduplication). When kind is missing, infers from extension; inference
 * failure rejects. Failure clears in-flight record, allowing retries.
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
    return Promise.reject(new Error('preloadMedia requires fetch (client-side only)'));
  }

  const resolvedKind = kind ?? inferMediaKind(src);
  if (!resolvedKind) {
    return Promise.reject(new Error(`Cannot determine media type: ${src} (pass explicit kind)`));
  }

  const tracked = runVideoPreload(src).finally(() => {
    inflight.delete(src);
  });
  inflight.set(src, tracked);
  return tracked;
}

/** Sets LRU byte budget (default 128MB). Immediately evicts to new budget after setting. */
export function setMediaByteBudget(bytes: number): void {
  byteBudget = Math.max(0, bytes);
  evictToBudget('');
}

/** Test/hot-reload reset: clears cache and revokes all objectURLs. */
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
