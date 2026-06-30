/**
 * Performance Monitor
 * 性能监控工具，用于收集和分析应用性能指标
 */

// 单一真源：公共 PerformanceMetrics（types/index.ts）。运行时监控不再自定义副本，
// 避免两份定义漂移（历史上内部曾多一个从不被读取的 `timestamp` 字段，已删除）。
import type { PerformanceMetrics } from '../types';

export type { PerformanceMetrics };

export class PerformanceMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private frameTimes: number[] = [];
  private readonly maxFrameTimeSamples: number = 60;
  private memorySamples: number[] = [];
  private readonly maxMemorySamples: number = 8;
  private readonly memorySampleIntervalMs: number = 1000;
  private lastMemorySampleTime: number = 0;
  private cachedMemoryUsage: number | undefined = undefined;
  private cachedBundleSizeKb: number = 0;
  private rafId: number | null = null;
  private isMonitoring: boolean = false;

  /**
   * 开始监控性能
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
   * 停止监控性能
   */
  stop(): void {
    this.isMonitoring = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 测量帧性能
   */
  private measure = (): void => {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    this.frameCount++;
    this.frameTimes.push(deltaTime);

    // 保持固定数量的样本
    if (this.frameTimes.length > this.maxFrameTimeSamples) {
      this.frameTimes.shift();
    }

    this.sampleMemory(currentTime);
    this.lastTime = currentTime;
    this.rafId = requestAnimationFrame(this.measure);
  };

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    const avgFrameTime = this.calculateAvgFrameTime();

    // 如果没有帧时间数据，返回 0
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        avgFrameTime: 0,
        memoryUsage: this.getMemoryUsage(),
        bundleSize: this.getBundleSizeKb(),
      };
    }

    // 防止除以零或异常小的值，设置最小帧时间为 1ms
    const safeFrameTime = Math.max(avgFrameTime, 1);
    const fps = 1000 / safeFrameTime;
    // 限制 FPS 在合理范围内 (0-60)
    const clampedFps = Math.min(Math.max(fps, 0), 60);

    return {
      fps: Math.round(clampedFps * 10) / 10,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      memoryUsage: this.getMemoryUsage(),
      bundleSize: this.getBundleSizeKb(),
    };
  }

  /**
   * 计算平均帧时间
   */
  private calculateAvgFrameTime(): number {
    if (this.frameTimes.length === 0) return 0;

    const sum = this.frameTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.frameTimes.length;
  }

  /**
   * 获取内存使用情况（如果浏览器支持）
   * @returns 内存使用量（MB）
   */
  private getMemoryUsage(): number | undefined {
    this.sampleMemory(performance.now(), this.cachedMemoryUsage === undefined);
    return this.cachedMemoryUsage;
  }

  private sampleMemory(currentTime: number, force: boolean = false): void {
    // @ts-expect-error - performance.memory 不是标准 API
    if (!performance.memory) {
      this.cachedMemoryUsage = undefined;
      this.memorySamples = [];
      return;
    }

    if (!force && currentTime - this.lastMemorySampleTime < this.memorySampleIntervalMs) {
      return;
    }

    // @ts-expect-error - performance.memory.usedJSHeapSize is non-standard API
    const usedJSHeapSize = performance.memory.usedJSHeapSize;
    const memoryInMb = usedJSHeapSize / (1024 * 1024);

    this.memorySamples.push(memoryInMb);
    if (this.memorySamples.length > this.maxMemorySamples) {
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

  /**
   * 重置监控数据
   */
  reset(): void {
    this.frameCount = 0;
    this.frameTimes = [];
    this.memorySamples = [];
    this.lastTime = performance.now();
    this.lastMemorySampleTime = 0;
    this.cachedMemoryUsage = undefined;
    this.cachedBundleSizeKb = this.estimateBundleSizeKb();
  }

  /**
   * 检查性能是否良好
   */
  isPerformanceGood(): boolean {
    const metrics = this.getMetrics();
    return metrics.fps >= 55; // 接近 60fps 认为性能良好
  }
}

/**
 * 创建性能监控实例
 */
export const createPerformanceMonitor = (): PerformanceMonitor => {
  return new PerformanceMonitor();
};

/**
 * 单例性能监控器（用于全局监控）
 */
const globalMonitor = new PerformanceMonitor();

export const performanceMonitor = globalMonitor;

/**
 * 开始性能监控（使用单例）
 */
export const startPerformanceMonitoring = (): void => {
  globalMonitor.start();
};

/**
 * 停止性能监控（使用单例）
 */
export const stopPerformanceMonitoring = (): void => {
  globalMonitor.stop();
};

/**
 * 获取性能指标（使用单例）
 */
export const getPerformanceMetrics = (): PerformanceMetrics => {
  return globalMonitor.getMetrics();
};

/**
 * 重置性能指标（使用单例）
 */
export const resetPerformanceMetrics = (): void => {
  globalMonitor.reset();
};

/**
 * 获取全局性能监控器实例
 * @deprecated 使用 performanceMonitor 单例代替
 */
export const getGlobalPerformanceMonitor = (): PerformanceMonitor => {
  return globalMonitor;
};
