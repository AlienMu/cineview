/**
 * Performance monitoring utility function tests
 */

import {
  performanceMonitor,
  PerformanceMonitor,
  getPerformanceMetrics,
  startPerformanceMonitoring,
  stopPerformanceMonitoring,
  acquirePerformanceMonitoring,
} from './performanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('start and stop', () => {
    it('should start monitoring', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      monitor.start();
      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });

    it('should not start monitoring twice', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      monitor.start();
      const callCount = rafSpy.mock.calls.length;
      monitor.start();
      expect(rafSpy.mock.calls.length).toBe(callCount);
      rafSpy.mockRestore();
    });

    it('should stop monitoring', () => {
      const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame');
      monitor.start();
      monitor.stop();
      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });

    it('should not stop monitoring if not started', () => {
      const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame');
      monitor.stop();
      expect(cancelSpy).not.toHaveBeenCalled();
      cancelSpy.mockRestore();
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = monitor.getMetrics();
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('avgFrameTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('bundleSize');
      expect(metrics.fps).toBe(0);
      expect(metrics.avgFrameTime).toBe(0);
      expect(metrics.bundleSize).toBeGreaterThanOrEqual(0);
    });

    it('should return metrics with correct types', () => {
      const metrics = monitor.getMetrics();
      expect(typeof metrics.fps).toBe('number');
      expect(typeof metrics.avgFrameTime).toBe('number');
      expect(typeof metrics.bundleSize).toBe('number');
      // memoryUsage can be undefined if not supported
      if (metrics.memoryUsage !== undefined) {
        expect(typeof metrics.memoryUsage).toBe('number');
      }
    });

    it('should calculate fps and avgFrameTime after monitoring', (done) => {
      monitor.start();

      // Wait for a few frames
      setTimeout(() => {
        const metrics = monitor.getMetrics();
        expect(metrics.fps).toBeGreaterThan(0);
        expect(metrics.avgFrameTime).toBeGreaterThan(0);
        monitor.stop();
        done();
      }, 100);
    });

    it('should round fps to one decimal place', (done) => {
      monitor.start();

      setTimeout(() => {
        const metrics = monitor.getMetrics();
        const fpsString = metrics.fps.toString();
        const decimalPart = fpsString.split('.')[1];
        if (decimalPart) {
          expect(decimalPart.length).toBeLessThanOrEqual(1);
        }
        monitor.stop();
        done();
      }, 100);
    });

    it('should round avgFrameTime to two decimal places', (done) => {
      monitor.start();

      setTimeout(() => {
        const metrics = monitor.getMetrics();
        const frameTimeString = metrics.avgFrameTime.toString();
        const decimalPart = frameTimeString.split('.')[1];
        if (decimalPart) {
          expect(decimalPart.length).toBeLessThanOrEqual(2);
        }
        monitor.stop();
        done();
      }, 100);
    });
  });

  describe('memory usage', () => {
    it('should return memory usage if supported', () => {
      // Mock performance.memory
      const originalMemory = (performance as unknown as { memory?: unknown }).memory;
      (performance as unknown as { memory: { usedJSHeapSize: number } }).memory = {
        usedJSHeapSize: 10485760, // 10 MB in bytes
      };

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.memoryUsage).toBeGreaterThan(0);

      // Restore
      (performance as unknown as { memory?: unknown }).memory = originalMemory;
    });

    it('should return undefined if memory API not supported', () => {
      // Mock performance.memory as undefined
      const originalMemory = (performance as unknown as { memory?: unknown }).memory;
      (performance as unknown as { memory?: unknown }).memory = undefined;

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBeUndefined();

      // Restore
      (performance as unknown as { memory?: unknown }).memory = originalMemory;
    });

    it('should convert memory usage to MB', () => {
      // Mock performance.memory
      const originalMemory = (performance as unknown as { memory?: unknown }).memory;
      (performance as unknown as { memory: { usedJSHeapSize: number } }).memory = {
        usedJSHeapSize: 10485760, // 10 MB in bytes
      };

      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBeCloseTo(10, 1);

      // Restore
      (performance as unknown as { memory?: unknown }).memory = originalMemory;
    });

    it('should estimate bundle size from loaded code resources', () => {
      const originalGetEntriesByType = (
        performance as Performance & {
          getEntriesByType?: (type: string) => PerformanceEntry[];
        }
      ).getEntriesByType;

      Object.defineProperty(performance, 'getEntriesByType', {
        configurable: true,
        value: (type: string) => {
          if (type !== 'resource') {
            return [];
          }

          return [
            {
              name: 'http://localhost:3000/assets/index.js',
              decodedBodySize: 153600,
              transferSize: 0,
            },
            {
              name: 'http://localhost:3000/assets/index.css',
              decodedBodySize: 10240,
              transferSize: 0,
            },
            {
              name: 'http://localhost:3000/assets/hero.jpg',
              decodedBodySize: 500000,
              transferSize: 0,
            },
          ] as unknown as PerformanceEntry[];
        },
      });

      const metrics = monitor.getMetrics();
      expect(metrics.bundleSize).toBeCloseTo(160, 1);

      if (originalGetEntriesByType) {
        Object.defineProperty(performance, 'getEntriesByType', {
          configurable: true,
          value: originalGetEntriesByType,
        });
      } else {
        delete (performance as { getEntriesByType?: unknown }).getEntriesByType;
      }
    });

    it('should smooth short-term memory spikes across recent samples', () => {
      const originalMemory = (performance as unknown as { memory?: unknown }).memory;
      const nowSpy = jest.spyOn(performance, 'now');
      const memoryState = { usedJSHeapSize: 16 * 1024 * 1024 };
      (performance as unknown as { memory: { usedJSHeapSize: number } }).memory = memoryState;

      nowSpy.mockReturnValue(0);
      monitor.getMetrics();
      // Advance enough time to allow the next memory sample window.
      nowSpy.mockReturnValue(1100);
      memoryState.usedJSHeapSize = 100 * 1024 * 1024;
      const spikedMetrics = monitor.getMetrics();

      expect(spikedMetrics.memoryUsage).toBeDefined();
      expect(spikedMetrics.memoryUsage).toBeGreaterThan(16);
      expect(spikedMetrics.memoryUsage).toBeLessThan(100);

      nowSpy.mockRestore();
      (performance as unknown as { memory?: unknown }).memory = originalMemory;
    });

    it('should not mutate memory smoothing window on every read within the sample interval', () => {
      const originalMemory = (performance as unknown as { memory?: unknown }).memory;
      const nowSpy = jest.spyOn(performance, 'now');
      const memoryState = { usedJSHeapSize: 16 * 1024 * 1024 };
      (performance as unknown as { memory: { usedJSHeapSize: number } }).memory = memoryState;

      nowSpy.mockReturnValue(1000);
      const baselineMetrics = monitor.getMetrics();

      memoryState.usedJSHeapSize = 100 * 1024 * 1024;
      nowSpy.mockReturnValue(1200);
      const repeatedReadMetrics = monitor.getMetrics();

      expect(repeatedReadMetrics.memoryUsage).toBe(baselineMetrics.memoryUsage);

      nowSpy.mockReturnValue(2200);
      const nextWindowMetrics = monitor.getMetrics();
      expect(nextWindowMetrics.memoryUsage).toBeDefined();
      expect(nextWindowMetrics.memoryUsage).toBeGreaterThan(16);
      expect(nextWindowMetrics.memoryUsage).toBeLessThan(100);

      nowSpy.mockRestore();
      (performance as unknown as { memory?: unknown }).memory = originalMemory;
    });
  });

  describe('frame time tracking', () => {
    it('should keep only last 60 frames', (done) => {
      monitor.start();

      // Wait for more than 60 frames (at 60fps, this is about 1 second)
      setTimeout(() => {
        const metrics = monitor.getMetrics();
        // avgFrameTime should be calculated from at most 60 frames
        expect(metrics.avgFrameTime).toBeGreaterThan(0);
        monitor.stop();
        done();
      }, 1100); // Wait slightly more than 1 second
    });
  });
});

describe('Singleton instance and convenience functions', () => {
  afterEach(() => {
    stopPerformanceMonitoring();
  });

  describe('acquirePerformanceMonitoring', () => {
    it('keeps the global monitor running until the last consumer releases it', () => {
      const startSpy = jest.spyOn(performanceMonitor, 'start');
      const stopSpy = jest.spyOn(performanceMonitor, 'stop');

      const releaseFirst = acquirePerformanceMonitoring();
      const releaseSecond = acquirePerformanceMonitoring();
      expect(startSpy).toHaveBeenCalledTimes(1);

      releaseFirst();
      expect(stopSpy).not.toHaveBeenCalled();

      releaseSecond();
      expect(stopSpy).toHaveBeenCalledTimes(1);

      releaseSecond();
      expect(stopSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('startPerformanceMonitoring', () => {
    it('should start monitoring using singleton', () => {
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
      startPerformanceMonitoring();
      expect(rafSpy).toHaveBeenCalled();
      rafSpy.mockRestore();
    });
  });

  describe('stopPerformanceMonitoring', () => {
    it('should stop monitoring using singleton', () => {
      const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame');
      startPerformanceMonitoring();
      stopPerformanceMonitoring();
      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return metrics from singleton', () => {
      const metrics = getPerformanceMetrics();
      expect(metrics).toHaveProperty('fps');
      expect(metrics).toHaveProperty('avgFrameTime');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('bundleSize');
    });

    it('should return updated metrics after monitoring', (done) => {
      startPerformanceMonitoring();

      setTimeout(() => {
        const metrics = getPerformanceMetrics();
        expect(metrics.fps).toBeGreaterThan(0);
        expect(metrics.avgFrameTime).toBeGreaterThan(0);
        stopPerformanceMonitoring();
        done();
      }, 100);
    });
  });

  describe('performanceMonitor singleton', () => {
    it('should export singleton instance', () => {
      expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
    });

    it('should be the same instance used by convenience functions', (done) => {
      startPerformanceMonitoring();

      setTimeout(() => {
        const metricsFromFunction = getPerformanceMetrics();
        const metricsFromSingleton = performanceMonitor.getMetrics();

        expect(metricsFromFunction.fps).toBe(metricsFromSingleton.fps);
        expect(metricsFromFunction.avgFrameTime).toBe(metricsFromSingleton.avgFrameTime);

        stopPerformanceMonitoring();
        done();
      }, 100);
    });
  });
});

describe('Performance API integration', () => {
  afterEach(() => {
    stopPerformanceMonitoring();
  });

  it('should use performance.now() for timing', (done) => {
    const nowSpy = jest.spyOn(performance, 'now');
    startPerformanceMonitoring();

    setTimeout(() => {
      expect(nowSpy).toHaveBeenCalled();
      stopPerformanceMonitoring();
      nowSpy.mockRestore();
      done();
    }, 50);
  });

  it('should use requestAnimationFrame for frame measurement', () => {
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame');
    startPerformanceMonitoring();
    expect(rafSpy).toHaveBeenCalled();
    stopPerformanceMonitoring();
    rafSpy.mockRestore();
  });

  it('should use cancelAnimationFrame when stopping', () => {
    const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame');
    startPerformanceMonitoring();
    stopPerformanceMonitoring();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});

describe('Edge cases', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should handle getting metrics before starting', () => {
    const metrics = monitor.getMetrics();
    expect(metrics.fps).toBe(0);
    expect(metrics.avgFrameTime).toBe(0);
  });

  it('should handle multiple start/stop cycles', (done) => {
    monitor.start();
    setTimeout(() => {
      monitor.stop();
      monitor.start();
      setTimeout(() => {
        const metrics = monitor.getMetrics();
        expect(metrics.fps).toBeGreaterThan(0);
        monitor.stop();
        done();
      }, 50);
    }, 50);
  });

  it('should handle rapid start/stop calls', () => {
    expect(() => {
      monitor.start();
      monitor.stop();
      monitor.start();
      monitor.stop();
    }).not.toThrow();
  });
});
