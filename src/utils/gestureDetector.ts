import { GestureType } from '../types';

/**
 * Gesture detection configuration
 */
interface GestureConfig {
  minSwipeDistance?: number;
  maxSwipeTime?: number;
  direction?: 'x' | 'y' | 'both';
}

/**
 * Touch or mouse event position
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
 * Gesture detector class
 */
export class GestureDetector {
  private startPos: Position | null = null;
  private config: Required<GestureConfig>;

  constructor(config: GestureConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle touch or mouse start event
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
   * Handle touch or mouse end event
   * @returns Detected gesture type
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

    if (deltaTime > this.config.maxSwipeTime) {
      return 'none';
    }

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < this.config.minSwipeDistance && absY < this.config.minSwipeDistance) {
      return 'none';
    }

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

    if (absX > absY) {
      return deltaX > 0 ? 'swipe-right' : 'swipe-left';
    } else {
      return deltaY > 0 ? 'swipe-down' : 'swipe-up';
    }
  }

  /**
   * Get current drag progress (0-1)
   * @param event - Current event
   * @param containerSize - Container size (width or height)
   * @returns Drag progress
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
   * Reset gesture detector
   */
  reset(): void {
    this.startPos = null;
  }

  /**
   * Extract position from event
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
 * Create gesture detector
 * @param config - Gesture detection configuration
 * @returns Gesture detector instance
 */
export function createGestureDetector(config?: GestureConfig): GestureDetector {
  return new GestureDetector(config);
}

/**
 * Detect if device supports touch
 */
export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    ((navigator as unknown as { msMaxTouchPoints?: number }).msMaxTouchPoints ?? 0) > 0
  );
}

/**
 * Simple gesture detection function
 * @param start - Start position
 * @param end - End position
 * @param direction - Detection direction
 * @param minDistance - Minimum swipe distance
 * @returns Gesture type
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

  if (absX < minDistance && absY < minDistance) {
    return 'none';
  }

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
