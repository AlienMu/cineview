/**
 * Gesture Handler Utilities
 * Shared utilities for touch and mouse gesture handling
 */

import { throttle } from './throttle';

/**
 * @deprecated This interface will be removed once Scene.tsx is refactored to use Framer Motion drag
 */
export interface DragHandlerOptions {
  slideDirection: 'x' | 'y';
  isDragging: boolean;
  dragProgress: number;
  onDragStart: (startPos: { x: number; y: number }, startProgress: number) => void;
  onDragMove: (progress: number) => void;
  onDragEnd: (finalProgress: number, velocity: number) => void;
  onWheel?: (progress: number) => void;
}

/**
 * Create drag mode gesture handlers
 * @deprecated This function will be removed once Scene.tsx is refactored to use Framer Motion drag.
 * The drag mode refactor (tasks 1-4) is incomplete - Scene.tsx still uses manual event handlers.
 * This function is kept temporarily to avoid breaking existing code.
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
  handleWheel: (e: WheelEvent) => void;
} {
  const { slideDirection, isDragging, dragProgress, onDragStart, onDragMove, onDragEnd, onWheel } =
    options;

  // 滚轮累积进度
  let wheelProgress = 0;
  let wheelTimeout: NodeJS.Timeout | null = null;

  // 速度追踪
  let lastMoveTime = 0;
  let lastMoveProgress = 0;
  let velocity = 0;

  const handleTouchStart = (e: TouchEvent): void => {
    const touch = e.touches[0];
    const startPos = { x: touch.clientX, y: touch.clientY };
    touchStartRef.current = startPos;
    dragStartProgressRef.current = dragProgress;

    lastMoveTime = Date.now();
    lastMoveProgress = dragProgress;
    velocity = 0;

    onDragStart(startPos, dragProgress);
  };

  const handleTouchMove = throttle((e: TouchEvent): void => {
    if (!isDragging || !touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    const delta = slideDirection === 'x' ? deltaX : deltaY;
    const viewportSize = slideDirection === 'x' ? window.innerWidth : window.innerHeight;

    let progress = dragStartProgressRef.current + -delta / viewportSize;
    progress = Math.max(-1.5, Math.min(1.5, progress));

    const now = Date.now();
    const timeDelta = now - lastMoveTime;
    if (timeDelta > 0) {
      const progressDelta = Math.abs(progress - lastMoveProgress);
      velocity = progressDelta / timeDelta;
      lastMoveTime = now;
      lastMoveProgress = progress;
    }

    onDragMove(progress);
  }, 16) as EventListener;

  const handleTouchEnd = (): void => {
    if (!isDragging) return;
    onDragEnd(dragProgress, velocity);
    touchStartRef.current = null;
    velocity = 0;
  };

  const handleMouseDown = (e: MouseEvent): void => {
    const startPos = { x: e.clientX, y: e.clientY };
    touchStartRef.current = startPos;
    dragStartProgressRef.current = dragProgress;

    lastMoveTime = Date.now();
    lastMoveProgress = dragProgress;
    velocity = 0;

    onDragStart(startPos, dragProgress);
  };

  const handleMouseMove = throttle((e: MouseEvent): void => {
    if (!isDragging || !touchStartRef.current) return;

    const deltaX = e.clientX - touchStartRef.current.x;
    const deltaY = e.clientY - touchStartRef.current.y;

    const delta = slideDirection === 'x' ? deltaX : deltaY;
    const viewportSize = slideDirection === 'x' ? window.innerWidth : window.innerHeight;

    let progress = dragStartProgressRef.current + -delta / viewportSize;
    progress = Math.max(-1.5, Math.min(1.5, progress));

    const now = Date.now();
    const timeDelta = now - lastMoveTime;
    if (timeDelta > 0) {
      const progressDelta = Math.abs(progress - lastMoveProgress);
      velocity = progressDelta / timeDelta;
      lastMoveTime = now;
      lastMoveProgress = progress;
    }

    onDragMove(progress);
  }, 16) as EventListener;

  const handleMouseUp = (): void => {
    if (!isDragging) return;
    onDragEnd(dragProgress, velocity);
    touchStartRef.current = null;
    velocity = 0;
  };

  const handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    const delta = slideDirection === 'y' ? e.deltaY : e.deltaX;
    const progressDelta = delta / 1000;
    wheelProgress += progressDelta;
    wheelProgress = Math.max(-1.5, Math.min(1.5, wheelProgress));

    if (onWheel) {
      onWheel(wheelProgress);
    }

    if (wheelTimeout) {
      clearTimeout(wheelTimeout);
    }

    wheelTimeout = setTimeout(() => {
      if (onDragEnd) {
        onDragEnd(wheelProgress, 0);
      }
      wheelProgress = 0;
      wheelTimeout = null;
    }, 500);
  };

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
  };
}
