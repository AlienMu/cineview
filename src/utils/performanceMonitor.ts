/**
 * Performance Monitor
 * Performance monitoring utility for collecting and analyzing application performance metrics
 */

// Single source of truth: public PerformanceMetrics (types/index.ts). Runtime monitoring no longer
// maintains a custom copy, avoiding definition drift (historically had an extra unused `timestamp` field).
import type { PerformanceMetrics } from '../types';

export type { PerformanceMetrics };

export class PerformanceMonitor {
  declare private frameCount: number;
  declare private lastTime: number;
  declare private frameTimes: number[];
  declare private memorySamples: number[];
  declare private lastMemorySampleTime: number;
  declare private cachedMemoryUsage: number | undefined;
  declare private cachedBundleSizeKb: number;
  declare private rafId: number | null;
  declare private isMonitoring: boolean;
  declare private measure: () => void;

  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.frameTimes = [];
    this.memorySamples = [];
    this.lastMemorySampleTime = 0;
    this.cachedMemoryUsage = undefined;
    this.cachedBundleSizeKb = 0;
    this.rafId = null;
    this.isMonitoring = false;
    this.measure = (): void => {
      if (!this.isMonitoring) return;

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTime;

      this.frameCount++;
      this.frameTimes.push(deltaTime);

      // Keep a fixed number of samples
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }

      this.sampleMemory(currentTime);
      this.lastTime = currentTime;
      this.rafId = requestAnimationFrame(this.measure);
    };
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.frameTimes = [];
    this.memorySamples = [];
    this.lastMemorySampleTime = 0;
    this.cachedMemoryUsage = undefined;
    this.cachedBundleSizeKb = this.estimateBundleSizeKb();
    this.measure();
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    this.isMonitoring = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const avgFrameTime = this.calculateAvgFrameTime();

    // Return zeros if no frame time data available
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        avgFrameTime: 0,
        memoryUsage: this.getMemoryUsage(),
        bundleSize: this.getBundleSizeKb(),
      };
    }

    // Prevent division by zero or abnormally small values, set minimum frame time to 1ms
    const safeFrameTime = Math.max(avgFrameTime, 1);
    const fps = 1000 / safeFrameTime;
    // Clamp FPS to reasonable range (0-60)
    const clampedFps = Math.min(Math.max(fps, 0), 60);

    return {
      fps: Math.round(clampedFps * 10) / 10,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      bundleSize: this.getBundleSizeKb(),
    };
  }

  /**
   * Calculate average frame time
   */
  private calculateAvgFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;

    const sum = this.frameTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * Get memory usage (if browser supports it)
   * @returns Memory usage in MB
   */
  private getMemoryUsage(): number | undefined {
    this.sampleMemory(performance.now(), this.cachedMemoryUsage === undefined);
    return this.cachedMemoryUsage;
  }

  private sampleMemory(currentTime: number, force: boolean = false): void {
    // @ts-expect-error - performance.memory is non-standard API
    if (!performance.memory) {
      this.cachedMemoryUsage = undefined;
      this.memorySamples = [];
      return;
    }

    if (!force && currentTime - this.lastMemorySampleTime < 1000) {
      return;
    }

    // @ts-expect-error - performance.memory.usedJSHeapSize is non-standard API
    const usedJSHeapSize = performance.memory.usedJSHeapSize;
    const memoryInMb = usedJSHeapSize / (1024 * 1024);

    this.memorySamples.push(memoryInMb);
    if (this.memorySamples.length > 8) {
      this.memorySamples.shift();
    }

    const sortedSamples = [...this.memorySamples].sort((a, b) => a - b);
    const middleIndex = Math.floor(sortedSamples.length / 2);
    const medianMemory =
      sortedSamples.length % 2 === 0
        ? (sortedSamples[middleIndex - 1] + sortedSamples[middleIndex]) / 2
        : sortedSamples[middleIndex];

    this.cachedMemoryUsage = Math.round(medianMemory * 10) / 10;
    this.lastMemorySampleTime = currentTime;
  }

  private getBundleSizeKb(): number {
    if (this.cachedBundleSizeKb > 0) {
      return this.cachedBundleSizeKb;
    }

    this.cachedBundleSizeKb = this.estimateBundleSizeKb();
    return this.cachedBundleSizeKb;
  }

  private estimateBundleSizeKb(): number {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
      return 0;
    }

    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (resourceEntries.length === 0) {
      return 0;
    }

    const bundleBytes = resourceEntries.reduce((total, entry) => {
      const normalizedName = entry.name.toLowerCase();
      const isCodeAsset =
        normalizedName.endsWith('.js') ||
        normalizedName.endsWith('.mjs') ||
        normalizedName.endsWith('.css') ||
        normalizedName.includes('.js?') ||
        normalizedName.includes('.mjs?') ||
        normalizedName.includes('.css?');

      if (!isCodeAsset) {
        return total;
      }

      const entryBytes = Math.max(entry.decodedBodySize || 0, entry.transferSize || 0);
      return total + entryBytes;
    }, 0);

    return Math.round((bundleBytes / 1024) * 10) / 10;
  }
}

/**
 * Create performance monitor instance
 */
export const createPerformanceMonitor = (): PerformanceMonitor => {
  return new PerformanceMonitor();
};

/**
 * Singleton performance monitor (for global monitoring)
 */
const globalMonitor = new PerformanceMonitor();
let globalMonitorLeaseCount = 0;

export const performanceMonitor = globalMonitor;

/**
 * Acquire page-level performance monitoring for a mounted CineView instance.
 * First lease starts monitoring, stops only after last lease is released; release is idempotent.
 */
export const acquirePerformanceMonitoring = (): (() => void) => {
  globalMonitorLeaseCount += 1;
  if (globalMonitorLeaseCount === 1) {
    globalMonitor.start();
  }

  let released = false;
  return (): void => {
    if (released) return;
    released = true;
    globalMonitorLeaseCount = Math.max(globalMonitorLeaseCount - 1, 0);
    if (globalMonitorLeaseCount === 0) {
      globalMonitor.stop();
    }
  };
};

/**
 * Start performance monitoring (using singleton)
 */
export const startPerformanceMonitoring = (): void => {
  globalMonitor.start();
};

/**
 * Stop performance monitoring (using singleton)
 */
export const stopPerformanceMonitoring = (): void => {
  globalMonitor.stop();
};

/**
 * Get performance metrics (using singleton)
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
  return globalMonitor.getMetrics();
};

/**
 * Get global performance monitor instance
 * @deprecated Use performanceMonitor singleton instead
 */
export const getGlobalPerformanceMonitor = (): PerformanceMonitor => {
  return globalMonitor;
};
