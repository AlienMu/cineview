/**
 * media 预加载缓存单测(video):预加载、in-flight 去重、订阅通知、LRU 字节淘汰、
 * objectURL revoke、类型推断、reset。fetch + URL 均 mock。
 */

import {
  inferMediaKind,
  isMediaPreloaded,
  getVideoObjectUrl,
  acquireVideoObjectUrl,
  releaseVideoObjectUrl,
  preloadMedia,
  subscribeToPreloadedMedia,
  setMediaByteBudget,
  resetMediaPreloadCache,
} from './mediaPreloadCache';

let objectUrlCounter = 0;
const revoked: string[] = [];

beforeEach(() => {
  objectUrlCounter = 0;
  revoked.length = 0;
  (global as unknown as { fetch: unknown }).fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve({ size: url.includes('big') ? 100 * 1024 * 1024 : 1024 } as Blob),
    })
  );
  (global as unknown as { URL: Partial<typeof URL> }).URL = {
    createObjectURL: jest.fn(() => `blob:mock-${objectUrlCounter++}`),
    revokeObjectURL: jest.fn((u: string) => {
      revoked.push(u);
    }),
  } as unknown as typeof URL;
});

afterEach(() => {
  resetMediaPreloadCache();
  jest.clearAllMocks();
});

describe('inferMediaKind', () => {
  it('detects video by extension, null otherwise', () => {
    expect(inferMediaKind('/a.mp4')).toBe('video');
    expect(inferMediaKind('/a.webm?x=1')).toBe('video');
    expect(inferMediaKind('/a.gif')).toBeNull();
    expect(inferMediaKind('/a.png')).toBeNull();
  });
});

describe('preloadMedia — video', () => {
  it('fetches blob, creates objectURL, marks ready', async () => {
    expect(isMediaPreloaded('/clip.mp4')).toBe(false);
    await preloadMedia('/clip.mp4');
    expect(isMediaPreloaded('/clip.mp4')).toBe(true);
    expect(getVideoObjectUrl('/clip.mp4')).toBe('blob:mock-0');
  });

  it('notifies subscribers on ready', async () => {
    const seen: string[] = [];
    const unsub = subscribeToPreloadedMedia((u) => seen.push(u));
    await preloadMedia('/y.mp4');
    expect(seen).toEqual(['/y.mp4']);
    unsub();
  });
});

describe('preloadMedia — dedup & guards', () => {
  it('reuses the in-flight promise for concurrent calls', async () => {
    const p1 = preloadMedia('/z.mp4');
    const p2 = preloadMedia('/z.mp4');
    expect(p1).toBe(p2);
    await p1;
    await expect(preloadMedia('/z.mp4')).resolves.toBeUndefined();
    expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown media type without explicit kind', async () => {
    await expect(preloadMedia('/mystery')).rejects.toThrow(/无法判定媒体类型/);
  });

  it('honours explicit kind override', async () => {
    await preloadMedia('/stream', 'video');
    expect(isMediaPreloaded('/stream')).toBe(true);
  });

  it('empty src resolves as no-op', async () => {
    await expect(preloadMedia('')).resolves.toBeUndefined();
  });
});

describe('preloadMedia — HTTP failure & timeout (E-A1 / E-A4)', () => {
  it('rejects a non-ok response, keeps every ready set clean, and allows retry', async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        blob: () => Promise.resolve({ size: 5 } as Blob),
      })
    );
    await expect(preloadMedia('/missing.mp4')).rejects.toThrow(/404/);
    // 失败不得进入任何「已就绪」缓存集合:否则 readyUrls 含该 src,永久污染无法重试。
    expect(isMediaPreloaded('/missing.mp4')).toBe(false);
    expect(getVideoObjectUrl('/missing.mp4')).toBeUndefined();
    // in-flight 已清理 → 重试可再次发起并成功。
    await expect(preloadMedia('/missing.mp4')).resolves.toBeUndefined();
    expect(isMediaPreloaded('/missing.mp4')).toBe(true);
    expect(global.fetch as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('does not notify subscribers for a non-ok response', async () => {
    const seen: string[] = [];
    const unsub = subscribeToPreloadedMedia((u) => seen.push(u));
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        blob: () => Promise.resolve({ size: 5 } as Blob),
      })
    );
    await expect(preloadMedia('/boom.mp4')).rejects.toThrow(/500/);
    expect(seen).toEqual([]);
    unsub();
  });

  it('aborts a hung fetch after the timeout and settles as a retryable failure', async () => {
    jest.useFakeTimers();
    try {
      (global.fetch as jest.Mock).mockImplementationOnce(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
          })
      );
      const pending = preloadMedia('/hung.mp4');
      const settled = expect(pending).rejects.toThrow(/timed out/);
      jest.advanceTimersByTime(30_000);
      await settled;
      expect(isMediaPreloaded('/hung.mp4')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('LRU eviction', () => {
  it('evicts least-recently-used entries past the byte budget and revokes urls', async () => {
    setMediaByteBudget(50 * 1024 * 1024); // 50MB
    await preloadMedia('/clip.mp4'); // 1KB
    await preloadMedia('/big.mp4'); // 100MB → over budget, evicts clip.mp4
    expect(isMediaPreloaded('/big.mp4')).toBe(true);
    expect(isMediaPreloaded('/clip.mp4')).toBe(false);
    expect(revoked).toContain('blob:mock-0');
  });
});

describe('LRU active leases', () => {
  it('does not revoke an objectURL while a mounted consumer holds it', async () => {
    await preloadMedia('/held.mp4');
    expect(acquireVideoObjectUrl('/held.mp4')).toBe('blob:mock-0');

    setMediaByteBudget(0);
    expect(getVideoObjectUrl('/held.mp4')).toBe('blob:mock-0');
    expect(revoked).not.toContain('blob:mock-0');

    releaseVideoObjectUrl('/held.mp4');
    expect(getVideoObjectUrl('/held.mp4')).toBeUndefined();
    expect(revoked).toContain('blob:mock-0');
  });
});

describe('resetMediaPreloadCache', () => {
  it('clears cache and revokes all urls', async () => {
    await preloadMedia('/clip.mp4');
    resetMediaPreloadCache();
    expect(isMediaPreloaded('/clip.mp4')).toBe(false);
    expect(getVideoObjectUrl('/clip.mp4')).toBeUndefined();
    expect(revoked).toContain('blob:mock-0');
  });
});
