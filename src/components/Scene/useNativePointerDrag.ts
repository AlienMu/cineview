import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react';
import type { PanInfo } from 'framer-motion';

interface PointerSample {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
  target: HTMLElement;
  ownsGesture: boolean;
  candidateSuspended: boolean;
  rejectedDirections: Set<'forward' | 'backward'>;
  panInfo: PanInfo | null;
}

interface UseNativePointerDragParams {
  enabled: boolean;
  axis: 'x' | 'y';
  /** Reversibly pauses an in-flight continuation for this pointer candidate. */
  onCandidateStart?: () => boolean;
  /** Restores a paused continuation when the candidate ends without ownership. */
  onCandidateEnd?: () => void;
  /** Marks a fresh physical pointer session for root-level callback de-duplication. */
  onPointerSessionStart?: () => void;
  /** Returns true only when the direction gate grants drag ownership. */
  onStart: (direction: 'forward' | 'backward') => boolean;
  onPan: (event: PointerEvent, info: PanInfo) => void;
  onEnd: (event: PointerEvent, info: PanInfo) => void;
}

export interface NativePointerDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  isActiveRef: MutableRefObject<boolean>;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        'a,button,input,textarea,select,option,summary,[contenteditable="true"],[data-cineview-ignore-drag]'
      )
    )
  );
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function updatePanInfo(sample: PointerSample, x: number, y: number): PanInfo {
  const info =
    sample.panInfo ??
    ({
      point: { x: 0, y: 0 },
      delta: { x: 0, y: 0 },
      offset: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
    } as PanInfo);
  info.point.x = x;
  info.point.y = y;
  info.delta.x = x - sample.lastX;
  info.delta.y = y - sample.lastY;
  info.offset.x = x - sample.startX;
  info.offset.y = y - sample.startY;
  info.velocity.x = sample.velocityX;
  info.velocity.y = sample.velocityY;
  sample.panInfo = info;
  return info;
}

export function useNativePointerDrag({
  enabled,
  axis,
  onCandidateStart,
  onCandidateEnd,
  onPointerSessionStart,
  onStart,
  onPan,
  onEnd,
}: UseNativePointerDragParams): NativePointerDragHandlers {
  const sampleRef = useRef<PointerSample | null>(null);
  const isActiveRef = useRef(false);
  const pointerSessionGenerationRef = useRef(0);
  const suppressionCleanupTimerRef = useRef<number | null>(null);
  const endListenerCleanupRef = useRef<(() => void) | null>(null);

  // D-F1: `enabled` gates only the gesture START (onPointerDown). A gesture
  // already in flight (sample claimed) runs to completion regardless — the
  // scene can deactivate mid-gesture (its own release commits while the
  // pointer is still down), flipping isActive/enabled to false while the
  // pointer capture still pins events here; the move/end path must keep
  // driving the (global) render lane. The callbacks are routed through refs
  // for the same reason: the window end-listeners registered at pointerdown
  // must call the LATEST closures (fresh currentSceneIndex after a commit),
  // never the stale capture-time ones.
  const onCandidateStartRef = useRef(onCandidateStart);
  onCandidateStartRef.current = onCandidateStart;
  const onCandidateEndRef = useRef(onCandidateEnd);
  onCandidateEndRef.current = onCandidateEnd;
  const onPointerSessionStartRef = useRef(onPointerSessionStart);
  onPointerSessionStartRef.current = onPointerSessionStart;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const onPanRef = useRef(onPan);
  onPanRef.current = onPan;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const clearEndListeners = useCallback((): void => {
    endListenerCleanupRef.current?.();
    endListenerCleanupRef.current = null;
  }, []);

  const clearSuppressionCleanupTimer = useCallback((): void => {
    if (suppressionCleanupTimerRef.current === null) return;
    window.clearTimeout(suppressionCleanupTimerRef.current);
    suppressionCleanupTimerRef.current = null;
  }, []);

  const finishNative = useCallback(
    (event: PointerEvent): void => {
      const sample = sampleRef.current;
      if (!sample || sample.pointerId !== event.pointerId) {
        return;
      }

      const target = sample.target;
      clearEndListeners();
      sampleRef.current = null;
      if (sample.ownsGesture) {
        target.releasePointerCapture?.(sample.pointerId);
        onEndRef.current(event, updatePanInfo(sample, event.clientX, event.clientY));
      } else if (sample.candidateSuspended) {
        onCandidateEndRef.current?.();
      }

      // Framer Motion can deliver a late pan callback for the same pointer.
      // Suppress that callback for this turn even when the pointer ended as a
      // candidate: a tap/cancel must not leak into the Framer terminal path.
      // A newer pointerdown owns a later generation, so this session's delayed
      // cleanup can never clear the next native suppression window.
      clearSuppressionCleanupTimer();
      const completedGeneration = pointerSessionGenerationRef.current;
      isActiveRef.current = true;
      const timerId = window.setTimeout(() => {
        if (suppressionCleanupTimerRef.current !== timerId) return;
        suppressionCleanupTimerRef.current = null;
        if (pointerSessionGenerationRef.current === completedGeneration) {
          isActiveRef.current = false;
        }
      }, 0);
      suppressionCleanupTimerRef.current = timerId;
    },
    [clearEndListeners, clearSuppressionCleanupTimer]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      if (
        !enabled ||
        event.isPrimary === false ||
        (event.button !== undefined && event.button !== 0) ||
        isInteractiveTarget(event.target)
      ) {
        return;
      }

      // A second primary pointer can arrive while a gesture is still tracked
      // (mouse held + touch down: each pointer TYPE has its own isPrimary).
      // Overwriting the sample without first tearing down the previous
      // gesture's window/document end listeners leaks 4 listeners per overlap.
      // Release the stale capture and run the previous cleanup before claiming.
      const staleSample = sampleRef.current;
      if (staleSample) {
        staleSample.target.releasePointerCapture?.(staleSample.pointerId);
        if (!staleSample.ownsGesture && staleSample.candidateSuspended) {
          onCandidateEndRef.current?.();
        }
      }
      clearEndListeners();
      clearSuppressionCleanupTimer();
      pointerSessionGenerationRef.current += 1;

      const target = event.currentTarget;
      onPointerSessionStartRef.current?.();
      const candidateSuspended = onCandidateStartRef.current?.() ?? false;
      sampleRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        lastTime: now(),
        velocityX: 0,
        velocityY: 0,
        target,
        ownsGesture: false,
        candidateSuspended,
        rejectedDirections: new Set(),
        panInfo: null,
      };
      isActiveRef.current = true;
      const handleWindowEnd = (nativeEvent: PointerEvent): void => {
        finishNative(nativeEvent);
      };
      window.addEventListener('pointerup', handleWindowEnd);
      window.addEventListener('pointercancel', handleWindowEnd);
      document.addEventListener('pointerup', handleWindowEnd);
      document.addEventListener('pointercancel', handleWindowEnd);
      endListenerCleanupRef.current = (): void => {
        window.removeEventListener('pointerup', handleWindowEnd);
        window.removeEventListener('pointercancel', handleWindowEnd);
        document.removeEventListener('pointerup', handleWindowEnd);
        document.removeEventListener('pointercancel', handleWindowEnd);
      };
    },
    [clearEndListeners, clearSuppressionCleanupTimer, enabled, finishNative]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const sample = sampleRef.current;
      if (!sample || sample.pointerId !== event.pointerId) {
        return;
      }

      const timestamp = now();
      if (!sample.ownsGesture) {
        const axisDelta =
          axis === 'y' ? event.clientY - sample.startY : event.clientX - sample.startX;
        const crossDelta =
          axis === 'y' ? event.clientX - sample.startX : event.clientY - sample.startY;
        if (Math.abs(axisDelta) < 1 || Math.abs(axisDelta) <= Math.abs(crossDelta)) {
          return;
        }

        const direction: 'forward' | 'backward' = axisDelta < 0 ? 'forward' : 'backward';
        if (sample.rejectedDirections.has(direction)) return;

        // A previously rejected direction restores the continuation. If the same
        // press crosses back over the origin, suspend again before preflighting
        // the opposite direction so commit cannot race that second gate either.
        if (!sample.candidateSuspended) {
          sample.candidateSuspended = onCandidateStartRef.current?.() ?? false;
        }
        if (!onStartRef.current(direction)) {
          sample.rejectedDirections.add(direction);
          if (sample.candidateSuspended) {
            onCandidateEndRef.current?.();
            sample.candidateSuspended = false;
          }
          return;
        }

        // Ownership begins on this exact frame. Rebase the gesture here so the
        // candidate slop never leaks into render/element progress.
        sample.ownsGesture = true;
        sample.startX = event.clientX;
        sample.startY = event.clientY;
        sample.lastX = event.clientX;
        sample.lastY = event.clientY;
        sample.lastTime = timestamp;
        sample.velocityX = 0;
        sample.velocityY = 0;
        sample.target.setPointerCapture?.(sample.pointerId);
        if (event.cancelable) event.preventDefault();
        return;
      }

      const elapsed = Math.max(timestamp - sample.lastTime, 1);
      sample.velocityX = ((event.clientX - sample.lastX) / elapsed) * 1000;
      sample.velocityY = ((event.clientY - sample.lastY) / elapsed) * 1000;
      onPanRef.current(event.nativeEvent, updatePanInfo(sample, event.clientX, event.clientY));
      sample.lastX = event.clientX;
      sample.lastY = event.clientY;
      sample.lastTime = timestamp;
      if (event.cancelable) event.preventDefault();
    },
    [axis]
  );

  const finishReact = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => finishNative(event.nativeEvent),
    [finishNative]
  );

  useEffect(() => {
    return (): void => {
      const sample = sampleRef.current;
      if (sample && !sample.ownsGesture && sample.candidateSuspended) {
        onCandidateEndRef.current?.();
      }
      clearEndListeners();
      clearSuppressionCleanupTimer();
      pointerSessionGenerationRef.current += 1;
      sampleRef.current = null;
      isActiveRef.current = false;
    };
  }, [clearEndListeners, clearSuppressionCleanupTimer]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishReact,
    onPointerCancel: finishReact,
    isActiveRef,
  };
}
