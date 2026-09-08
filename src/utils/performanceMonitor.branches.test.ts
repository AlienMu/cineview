/**
 * performanceMonitor branch coverage tests
 * Covers previously untested branches:
 *  - line 147: memorySamples shift() when exceeding maxMemorySamples(8)
 *  - line 163: getBundleSizeKb cached (>0) branch
 *  - line 177: estimateBundleSizeKb returns 0 when resource entries are empty
 *  - line 227: createPerformanceMonitor()
 *  - line 270: getGlobalPerformanceMonitor()
 */

import {
  PerformanceMonitor,
  createPerformanceMonitor,
  getGlobalPerformanceMonitor,
  performanceMonitor,
} from './performanceMonitor';

describe('performanceMonitor extra branches', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.stop();
    jest.restoreAllMocks();
  });

  it('shifts the memory sample window once it exceeds maxMemorySamples (line 147)', () => {
    const originalMemory = (performance as unknown as { memory?: unknown }).memory;
    const memoryState = { usedJSHeapSize: 16 * 1024 * 1024 };
    (performance as unknown as { memory: { usedJSHeapSize: number } }).memory = memoryState;

    // Each getMetrics() takes one memory sample, but is time-gated to the 1000ms
    // interval after the first (forced) sample. Advance now by >1000ms per call so
    // every call pushes. maxMemorySamples is 8, so 10 calls push 10 -> shift fires.
    const nowSpy = jest.spyOn(performance, 'now');
    for (let i = 0; i < 10; i++) {
      nowSpy.mockReturnValue(i * 1100);
      // vary the heap so the median stays defined and finite
      memoryState.usedJSHeapSize = (16 + i) * 1024 * 1024;
      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBeDefined();
      expect(Number.isFinite(metrics.memoryUsage as number)).toBe(true);
    }

    (performance as unknown as { memory?: unknown }).memory = originalMemory;
  });

  it('returns the cached bundle size on subsequent reads (line 163)', () => {
    const originalGetEntriesByType = (
      performance as Performance & { getEntriesByType?: (type: string) => PerformanceEntry[] }
    ).getEntriesByType;

    const getEntriesSpy = jest.fn((type: string) => {
      if (type !== 'resource') return [] as unknown as PerformanceEntry[];
      return [
        {
          name: 'http://localhost:3000/assets/index.js',
          decodedBodySize: 102400, // 100 KB
          transferSize: 0,
        },
      ] as unknown as PerformanceEntry[];
    });

    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: getEntriesSpy,
    });

    monitor.getMetrics();
    const callsAfterFirstRead = getEntriesSpy.mock.calls.length;
    expect(callsAfterFirstRead).toBeGreaterThan(0);

    // getMetrics() -> getBundleSizeKb() sees cachedBundleSizeKb > 0 and returns it
    // WITHOUT re-estimating, so getEntriesByType is not called again.
    const metrics = monitor.getMetrics();
    expect(metrics.bundleSize).toBeCloseTo(100, 1);
    expect(getEntriesSpy.mock.calls.length).toBe(callsAfterFirstRead);

    if (originalGetEntriesByType) {
      Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: originalGetEntriesByType,
      });
    } else {
      delete (performance as { getEntriesByType?: unknown }).getEntriesByType;
    }
  });

  it('estimates 0 when there are no resource entries (line 177)', () => {
    const originalGetEntriesByType = (
      performance as Performance & { getEntriesByType?: (type: string) => PerformanceEntry[] }
    ).getEntriesByType;

    Object.defineProperty(performance, 'getEntriesByType', {
      configurable: true,
      value: () => [] as unknown as PerformanceEntry[],
    });

    const metrics = monitor.getMetrics();
    expect(metrics.bundleSize).toBe(0);

    if (originalGetEntriesByType) {
      Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: originalGetEntriesByType,
      });
    } else {
      delete (performance as { getEntriesByType?: unknown }).getEntriesByType;
    }
  });

  it('createPerformanceMonitor returns a fresh instance (line 227)', () => {
    const created = createPerformanceMonitor();
    expect(created).toBeInstanceOf(PerformanceMonitor);
    expect(created).not.toBe(performanceMonitor);
  });

  it('getGlobalPerformanceMonitor returns the singleton (line 270)', () => {
    expect(getGlobalPerformanceMonitor()).toBe(performanceMonitor);
  });
});
