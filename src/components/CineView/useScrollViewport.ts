import { useCallback, useRef, useState, type RefObject } from 'react';
import type { SlideDirection } from '../../types';

interface UseScrollViewportParams {
  rootRef: RefObject<HTMLDivElement>;
  direction: SlideDirection;
}

export interface ScrollViewportPort {
  viewportSize: { width: number; height: number };
  viewportSizeRef: React.MutableRefObject<{ width: number; height: number }>;
  getViewportSpan: () => number;
  updateViewportMetrics: () => void;
}

export function useScrollViewport({
  rootRef,
  direction,
}: UseScrollViewportParams): ScrollViewportPort {
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const viewportSizeRef = useRef({ width: 0, height: 0 });

  const getViewportSpan = useCallback((): number => {
    const root = rootRef.current;
    const liveWidth = root?.clientWidth ?? viewportSizeRef.current.width;
    const liveHeight = root?.clientHeight ?? viewportSizeRef.current.height;
    return Math.max(direction === 'x' ? liveWidth : liveHeight, 1);
  }, [direction, rootRef]);

  const updateViewportMetrics = useCallback((): void => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const nextWidth = root.clientWidth;
    const nextHeight = root.clientHeight;
    viewportSizeRef.current = { width: nextWidth, height: nextHeight };
    setViewportSize((current) =>
      current.width === nextWidth && current.height === nextHeight
        ? current
        : { width: nextWidth, height: nextHeight }
    );
  }, [rootRef]);

  return { viewportSize, viewportSizeRef, getViewportSpan, updateViewportMetrics };
}
