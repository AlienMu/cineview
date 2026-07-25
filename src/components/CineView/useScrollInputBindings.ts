import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  normalizeKeyboardDeltaPx,
  normalizeTouchDeltaPx,
  normalizeWheelDeltaPx,
  shouldDeferToNestedScrollable,
  shouldIgnoreGlobalScrollKey,
} from './directScrollHelpers';

interface UseScrollInputBindingsParams {
  rootRef: RefObject<HTMLDivElement | null>;
  direction: 'x' | 'y';
  getViewportSpan: () => number;
  applyNativeScrollDelta: (deltaPx: number) => boolean;
}

export function useScrollInputBindings({
  rootRef,
  direction,
  getViewportSpan,
  applyNativeScrollDelta,
}: UseScrollInputBindingsParams): void {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent): void => {
      const delta = direction === 'x' ? event.deltaX : event.deltaY;
      const normalizedDelta = normalizeWheelDeltaPx(delta, event.deltaMode, getViewportSpan());
      if (normalizedDelta === 0) return;
      if (shouldDeferToNestedScrollable(event.target, root, direction, normalizedDelta)) return;

      if (applyNativeScrollDelta(normalizedDelta) && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchStart = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (event: TouchEvent): void => {
      const touch = event.touches[0];
      if (!touch || !touchStartRef.current) return;

      const rawDelta =
        direction === 'x'
          ? touchStartRef.current.x - touch.clientX
          : touchStartRef.current.y - touch.clientY;
      const normalizedDelta = normalizeTouchDeltaPx(rawDelta);
      if (shouldDeferToNestedScrollable(event.target, root, direction, normalizedDelta)) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        return;
      }

      if (normalizedDelta !== 0 && applyNativeScrollDelta(normalizedDelta)) {
        if (event.cancelable) event.preventDefault();
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }
    };

    const clearTouch = (): void => {
      touchStartRef.current = null;
    };

    root.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    root.addEventListener('touchstart', handleTouchStart, { passive: true });
    root.addEventListener('touchmove', handleTouchMove, { passive: false });
    root.addEventListener('touchend', clearTouch);
    root.addEventListener('touchcancel', clearTouch);

    return (): void => {
      root.removeEventListener('wheel', handleWheel, { capture: true });
      root.removeEventListener('touchstart', handleTouchStart);
      root.removeEventListener('touchmove', handleTouchMove);
      root.removeEventListener('touchend', clearTouch);
      root.removeEventListener('touchcancel', clearTouch);
      touchStartRef.current = null;
    };
  }, [applyNativeScrollDelta, direction, getViewportSpan, rootRef]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (shouldIgnoreGlobalScrollKey(event)) return;

      const normalizedDelta = normalizeKeyboardDeltaPx(
        event.key,
        event.shiftKey,
        getViewportSpan()
      );
      if (normalizedDelta === 0) return;

      const activeElement = document.activeElement;
      const shouldForwardToContainer =
        activeElement === document.body || activeElement === document.documentElement;
      if (shouldForwardToContainer && applyNativeScrollDelta(normalizedDelta) && event.cancelable) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [applyNativeScrollDelta, getViewportSpan]);
}
