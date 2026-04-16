/**
 * Gesture Handler Utilities
 * Shared utilities for touch and mouse gesture handling
 */

import { detectGesture } from './gestureDetector';
import { throttle } from './throttle';

export interface GestureHandlerOptions {
  slideDirection: 'x' | 'y';
  slideDuration: number;
  isAnimating: boolean;
  onSceneChange?: (direction: 'forward' | 'backward') => void;
  onAnimatingChange: (isAnimating: boolean) => void;
}

export interface DragHandlerOptions {
  slideDirection: 'x' | 'y';
  isDragging: boolean;
  dragProgress: number;
  onDragStart: (startPos: { x: number; y: number }, startProgress: number) => void;
  onDragMove: (progress: number) => void;
  onDragEnd: (finalProgress: number) => void;
}

/**
 * Create snap mode gesture handlers
 */
export function createSnapGestureHandlers(
  touchStartRef: React.MutableRefObject<{ x: number; y: number } | null>,
  options: GestureHandlerOptions
): {
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchEnd: (e: TouchEvent) => void;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  handleWheel: (e: WheelEvent) => void;
} {
  const { slideDirection, slideDuration, isAnimating, onSceneChange, onAnimatingChange } = options;

  // Wheel event throttle state
  let lastWheelTime = 0;
  const WHEEL_THROTTLE_MS = 800; // 防止过快触发

  const handleTouchStart = (e: TouchEvent): void => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: TouchEvent): void => {
    if (isAnimating || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const gesture = detectGesture(
      touchStartRef.current,
      { x: touch.clientX, y: touch.clientY },
      slideDirection
    );

    if (gesture === 'swipe-up' || gesture === 'swipe-left') {
      onAnimatingChange(true);
      onSceneChange?.('forward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    } else if (gesture === 'swipe-down' || gesture === 'swipe-right') {
      onAnimatingChange(true);
      onSceneChange?.('backward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    }

    touchStartRef.current = null;
  };

  const handleMouseDown = (e: MouseEvent): void => {
    if (isAnimating) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: MouseEvent): void => {
    if (isAnimating || !touchStartRef.current) return;

    const gesture = detectGesture(
      touchStartRef.current,
      { x: e.clientX, y: e.clientY },
      slideDirection
    );

    if (gesture === 'swipe-up' || gesture === 'swipe-left') {
      onAnimatingChange(true);
      onSceneChange?.('forward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    } else if (gesture === 'swipe-down' || gesture === 'swipe-right') {
      onAnimatingChange(true);
      onSceneChange?.('backward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    }

    touchStartRef.current = null;
  };

  const handleWheel = (e: WheelEvent): void => {
    if (isAnimating) return;

    const now = Date.now();
    if (now - lastWheelTime < WHEEL_THROTTLE_MS) return;

    // 阻止默认滚动行为
    e.preventDefault();

    const delta = slideDirection === 'y' ? e.deltaY : e.deltaX;
    const threshold = 30; // 滚动阈值

    if (Math.abs(delta) < threshold) return;

    lastWheelTime = now;

    if (delta > 0) {
      // 向下/向右滚动 - 前进
      onAnimatingChange(true);
      onSceneChange?.('forward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    } else {
      // 向上/向左滚动 - 后退
      onAnimatingChange(true);
      onSceneChange?.('backward');
      setTimeout(() => onAnimatingChange(false), slideDuration);
    }
  };

  return {
    handleTouchStart,
    handleTouchEnd,
    handleMouseDown,
    handleMouseUp,
    handleWheel,
  };
}

/**
 * Create drag mode gesture handlers
 */
export function createDragGestureHandlers(
  touchStartRef: React.MutableRefObject<{ x: number; y: number } | null>,
  dragStartProgressRef: React.MutableRefObject<number>,
  options: DragHandlerOptions
): {
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: EventListener;
  handleTouchEnd: () => void;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: EventListener;
  handleMouseUp: () => void;
} {
  const { slideDirection, isDragging, dragProgress, onDragStart, onDragMove, onDragEnd } = options;

  const handleTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    const startPos = { x: touch.clientX, y: touch.clientY };
    touchStartRef.current = startPos;
    dragStartProgressRef.current = dragProgress;
    onDragStart(startPos, dragProgress);
  };

  const handleTouchMove = throttle((e: TouchEvent): void => {
    if (!isDragging || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const delta = slideDirection === 'x' ? deltaX : deltaY;
    const viewportSize = slideDirection === 'x' ? window.innerWidth : window.innerHeight;

    let progress = dragStartProgressRef.current + Math.abs(delta) / viewportSize;
    progress = Math.max(0, Math.min(1, progress));

    onDragMove(progress);
  }, 16) as EventListener;

  const handleTouchEnd = (): void => {
    if (!isDragging) return;
    onDragEnd(dragProgress);
    touchStartRef.current = null;
  };

  const handleMouseDown = (e: MouseEvent): void => {
    const startPos = { x: e.clientX, y: e.clientY };
    touchStartRef.current = startPos;
    dragStartProgressRef.current = dragProgress;
    onDragStart(startPos, dragProgress);
  };

  const handleMouseMove = throttle((e: MouseEvent): void => {
    if (!isDragging || !touchStartRef.current) return;

    const deltaX = e.clientX - touchStartRef.current.x;
    const deltaY = e.clientY - touchStartRef.current.y;

    const delta = slideDirection === 'x' ? deltaX : deltaY;
    const viewportSize = slideDirection === 'x' ? window.innerWidth : window.innerHeight;

    let progress = dragStartProgressRef.current + Math.abs(delta) / viewportSize;
    progress = Math.max(0, Math.min(1, progress));

    onDragMove(progress);
  }, 16) as EventListener;

  const handleMouseUp = (): void => {
    if (!isDragging) return;
    onDragEnd(dragProgress);
    touchStartRef.current = null;
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
