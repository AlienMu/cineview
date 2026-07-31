import { useCallback, useEffect, useRef } from 'react';
import type { PointerEventHandler } from 'react';
import type { PanInfo } from 'framer-motion';
import { useNativePointerDrag } from './useNativePointerDrag';

type PanEvent = MouseEvent | TouchEvent | PointerEvent;

interface UseScenePointerInputParams {
  enabled: boolean;
  axis: 'x' | 'y';
  onCandidateStart?: () => boolean;
  onCandidateEnd?: () => void;
  onPointerSessionStart?: () => void;
  onDragStart: (direction: 'forward' | 'backward') => boolean;
  onPan: (event: PanEvent, info: PanInfo) => void;
  onPanEnd: (event: PanEvent, info: PanInfo) => void;
  authoredPointerDown?: PointerEventHandler<HTMLDivElement>;
  authoredPointerMove?: PointerEventHandler<HTMLDivElement>;
  authoredPointerUp?: PointerEventHandler<HTMLDivElement>;
  authoredPointerCancel?: PointerEventHandler<HTMLDivElement>;
}

export interface ScenePointerInput {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onFramerPanStart: () => void;
  onFramerPan: (event: PanEvent, info: PanInfo) => void;
  onFramerPanEnd: (event: PanEvent, info: PanInfo) => void;
}

export function useScenePointerInput({
  enabled,
  axis,
  onCandidateStart,
  onCandidateEnd,
  onPointerSessionStart,
  onDragStart,
  onPan,
  onPanEnd,
  authoredPointerDown,
  authoredPointerMove,
  authoredPointerUp,
  authoredPointerCancel,
}: UseScenePointerInputParams): ScenePointerInput {
  const nativePointerDrag = useNativePointerDrag({
    enabled,
    axis,
    onCandidateStart,
    onCandidateEnd,
    onPointerSessionStart,
    onStart: onDragStart,
    onPan,
    onEnd: onPanEnd,
  });
  const {
    onPointerDown: nativePointerDown,
    onPointerMove: nativePointerMove,
    onPointerUp: nativePointerUp,
    onPointerCancel: nativePointerCancel,
  } = nativePointerDrag;

  const onPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      authoredPointerDown?.(event);
      if (!event.defaultPrevented) {
        nativePointerDown(event);
      }
    },
    [authoredPointerDown, nativePointerDown]
  );
  const onPointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      authoredPointerMove?.(event);
      if (!event.defaultPrevented) {
        nativePointerMove(event);
      }
    },
    [authoredPointerMove, nativePointerMove]
  );
  const onPointerUp = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      authoredPointerUp?.(event);
      nativePointerUp(event);
    },
    [authoredPointerUp, nativePointerUp]
  );
  const onPointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      authoredPointerCancel?.(event);
      nativePointerCancel(event);
    },
    [authoredPointerCancel, nativePointerCancel]
  );
  const framerCandidateRef = useRef<{
    ownsGesture: boolean;
    candidateSuspended: boolean;
    baseline: number;
    rejectedDirections: Set<'forward' | 'backward'>;
  }>({
    ownsGesture: false,
    candidateSuspended: false,
    baseline: 0,
    rejectedDirections: new Set(),
  });
  const onCandidateEndRef = useRef(onCandidateEnd);
  onCandidateEndRef.current = onCandidateEnd;
  const clearFramerCandidate = useCallback((resumeSuspension: boolean): void => {
    const candidate = framerCandidateRef.current;
    if (resumeSuspension && !candidate.ownsGesture && candidate.candidateSuspended) {
      onCandidateEndRef.current?.();
    }
    framerCandidateRef.current = {
      ownsGesture: false,
      candidateSuspended: false,
      baseline: 0,
      rejectedDirections: new Set(),
    };
  }, []);
  const onFramerPanStart = useCallback((): void => {
    if (nativePointerDrag.isActiveRef.current) {
      clearFramerCandidate(true);
      return;
    }
    // A replacement Framer sequence must release an unresolved candidate from
    // the previous one before taking a fresh reversible hold.
    clearFramerCandidate(true);
    onPointerSessionStart?.();
    framerCandidateRef.current = {
      ownsGesture: false,
      candidateSuspended: onCandidateStart?.() ?? false,
      baseline: 0,
      rejectedDirections: new Set(),
    };
  }, [
    clearFramerCandidate,
    nativePointerDrag.isActiveRef,
    onCandidateStart,
    onPointerSessionStart,
  ]);
  const onFramerPan = useCallback(
    (event: PanEvent, info: PanInfo): void => {
      if (nativePointerDrag.isActiveRef.current) {
        clearFramerCandidate(true);
        return;
      }

      const candidate = framerCandidateRef.current;
      const axisOffset = axis === 'y' ? info.offset.y : info.offset.x;
      const crossOffset = axis === 'y' ? info.offset.x : info.offset.y;
      if (!candidate.ownsGesture) {
        if (Math.abs(axisOffset) < 1 || Math.abs(axisOffset) <= Math.abs(crossOffset)) return;
        const direction: 'forward' | 'backward' = axisOffset < 0 ? 'forward' : 'backward';
        if (candidate.rejectedDirections.has(direction)) return;
        if (!candidate.candidateSuspended) {
          candidate.candidateSuspended = onCandidateStart?.() ?? false;
        }
        if (!onDragStart(direction)) {
          candidate.rejectedDirections.add(direction);
          if (candidate.candidateSuspended) {
            onCandidateEnd?.();
            candidate.candidateSuspended = false;
          }
          return;
        }
        candidate.ownsGesture = true;
        candidate.baseline = axisOffset;
        return;
      }

      const rebasedOffset = axisOffset - candidate.baseline;
      onPan(event, {
        ...info,
        offset:
          axis === 'y'
            ? { x: info.offset.x, y: rebasedOffset }
            : { x: rebasedOffset, y: info.offset.y },
      });
    },
    [
      axis,
      clearFramerCandidate,
      nativePointerDrag.isActiveRef,
      onCandidateEnd,
      onCandidateStart,
      onDragStart,
      onPan,
    ]
  );
  const onFramerPanEnd = useCallback(
    (event: PanEvent, info: PanInfo): void => {
      if (nativePointerDrag.isActiveRef.current) {
        clearFramerCandidate(true);
        return;
      }
      const candidate = framerCandidateRef.current;
      if (!candidate.ownsGesture) {
        clearFramerCandidate(true);
        return;
      }
      const axisOffset = axis === 'y' ? info.offset.y : info.offset.x;
      const rebasedOffset = axisOffset - candidate.baseline;
      onPanEnd(event, {
        ...info,
        offset:
          axis === 'y'
            ? { x: info.offset.x, y: rebasedOffset }
            : { x: rebasedOffset, y: info.offset.y },
      });
      clearFramerCandidate(false);
    },
    [axis, clearFramerCandidate, nativePointerDrag.isActiveRef, onPanEnd]
  );

  useEffect(() => () => clearFramerCandidate(true), [clearFramerCandidate]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onFramerPanStart,
    onFramerPan,
    onFramerPanEnd,
  };
}
