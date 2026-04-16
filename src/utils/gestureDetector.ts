import { GestureType } from '../types';

/**
 * 手势检测配置
 */
interface GestureConfig {
  minSwipeDistance?: number; // 最小滑动距离（px）
  maxSwipeTime?: number; // 最大滑动时间（ms）
  direction?: 'x' | 'y' | 'both'; // 检测方向
}

/**
 * 触摸/鼠标事件位置
 */
interface Position {
  x: number;
  y: number;
  time: number;
}

const DEFAULT_CONFIG: Required<GestureConfig> = {
  minSwipeDistance: 50,
  maxSwipeTime: 300,
  direction: 'both',
};

/**
 * 手势检测器类
 */
export class GestureDetector {
  private startPos: Position | null = null;
  private config: Required<GestureConfig>;

  constructor(config: GestureConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理触摸/鼠标开始事件
   */
  handleStart(event: TouchEvent | MouseEvent): void {
    const pos = this.getPosition(event);
    this.startPos = {
      x: pos.x,
      y: pos.y,
      time: Date.now(),
    };
  }

  /**
   * 处理触摸/鼠标结束事件
   * @returns 检测到的手势类型
   */
  handleEnd(event: TouchEvent | MouseEvent): GestureType {
    if (!this.startPos) {
      return 'none';
    }

    const endPos = this.getPosition(event);
    const deltaX = endPos.x - this.startPos.x;
    const deltaY = endPos.y - this.startPos.y;
    const deltaTime = Date.now() - this.startPos.time;

    this.startPos = null;

    // 检查时间是否超过最大滑动时间
    if (deltaTime > this.config.maxSwipeTime) {
      return 'none';
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 检查是否达到最小滑动距离
    if (absX < this.config.minSwipeDistance && absY < this.config.minSwipeDistance) {
      return 'none';
    }

    // 根据配置的方向检测手势
    if (this.config.direction === 'x') {
      if (absX < this.config.minSwipeDistance) {
        return 'none';
      }
      return deltaX > 0 ? 'swipe-right' : 'swipe-left';
    }

    if (this.config.direction === 'y') {
      if (absY < this.config.minSwipeDistance) {
        return 'none';
      }
      return deltaY > 0 ? 'swipe-down' : 'swipe-up';
    }

    // 'both' 模式：检测主要方向
    if (absX > absY) {
      return deltaX > 0 ? 'swipe-right' : 'swipe-left';
    } else {
      return deltaY > 0 ? 'swipe-down' : 'swipe-up';
    }
  }

  /**
   * 获取当前拖拽进度（0-1）
   * @param event - 当前事件
   * @param containerSize - 容器尺寸（宽度或高度）
   * @returns 拖拽进度
   */
  getDragProgress(event: TouchEvent | MouseEvent, containerSize: number): number {
    if (!this.startPos) {
      return 0;
    }

    const currentPos = this.getPosition(event);
    const delta =
      this.config.direction === 'x'
        ? currentPos.x - this.startPos.x
        : currentPos.y - this.startPos.y;

    const progress = Math.abs(delta) / containerSize;
    return Math.min(Math.max(progress, 0), 1);
  }

  /**
   * 重置手势检测器
   */
  reset(): void {
    this.startPos = null;
  }

  /**
   * 从事件中获取位置
   */
  private getPosition(event: TouchEvent | MouseEvent): { x: number; y: number } {
    if ('touches' in event && event.touches.length > 0) {
      return {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
    } else if ('clientX' in event) {
      return {
        x: event.clientX,
        y: event.clientY,
      };
    }
    return { x: 0, y: 0 };
  }
}

/**
 * 创建手势检测器
 * @param config - 手势检测配置
 * @returns 手势检测器实例
 */
export function createGestureDetector(config?: GestureConfig): GestureDetector {
  return new GestureDetector(config);
}

/**
 * 检测是否为触摸设备
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ((navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints ?? 0) > 0
  );
}

/**
 * 简单的手势检测函数
 * @param start - 起始位置
 * @param end - 结束位置
 * @param direction - 检测方向
 * @param minDistance - 最小滑动距离
 * @returns 手势类型
 */
export function detectGesture(
  start: { x: number; y: number },
  end: { x: number; y: number },
  direction: 'x' | 'y' = 'y',
  minDistance: number = 50
): GestureType {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // 检查是否达到最小滑动距离
  if (absX < minDistance && absY < minDistance) {
    return 'none';
  }

  // 根据方向检测
  if (direction === 'x') {
    if (absX < minDistance) return 'none';
    return deltaX > 0 ? 'swipe-right' : 'swipe-left';
  }

  if (direction === 'y') {
    if (absY < minDistance) return 'none';
    return deltaY > 0 ? 'swipe-down' : 'swipe-up';
  }

  return 'none';
}
