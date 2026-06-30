/**
 * media 预加载缓存单测(video):预加载、in-flight 去重、订阅通知、LRU 字节淘汰、
 * objectURL revoke、类型推断、reset。fetch + URL 均 mock。
 */

import {
  inferMediaKind,
  isMediaPreloaded,
  getVideoObjectUrl,
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

describe('resetMediaPreloadCache', () => {
  it('clears cache and revokes all urls', async () => {
    await preloadMedia('/clip.mp4');
    resetMediaPreloadCache();
    expect(isMediaPreloaded('/clip.mp4')).toBe(false);
    expect(getVideoObjectUrl('/clip.mp4')).toBeUndefined();
    expect(revoked).toContain('blob:mock-0');
  });
});
