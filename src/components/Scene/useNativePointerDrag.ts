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
}

interface UseNativePointerDragParams {
  enabled: boolean;
  onStart: () => void;
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

function createPanInfo(sample: PointerSample, x: number, y: number): PanInfo {
  return {
    point: { x, y },
    delta: { x: x - sample.lastX, y: y - sample.lastY },
    offset: { x: x - sample.startX, y: y - sample.startY },
    velocity: { x: sample.velocityX, y: sample.velocityY },
  } as PanInfo;
}

export function useNativePointerDrag({
  enabled,
  onStart,
  onPan,
  onEnd,
}: UseNativePointerDragParams): NativePointerDragHandlers {
  const sampleRef = useRef<PointerSample | null>(null);
  const isActiveRef = useRef(false);
  const endListenerCleanupRef = useRef<(() => void) | null>(null);

  const clearEndListeners = useCallback((): void => {
    endListenerCleanupRef.current?.();
    endListenerCleanupRef.current = null;
  }, []);

  const finishNative = useCallback(
    (event: PointerEvent): void => {
      const sample = sampleRef.current;
      if (!enabled || !sample || sample.pointerId !== event.pointerId) {
        return;
      }

      const info = createPanInfo(sample, event.clientX, event.clientY);
      const target = sample.target;
      clearEndListeners();
      sampleRef.current = null;
      target.releasePointerCapture?.(sample.pointerId);
      onEnd(event, info);

      // Framer Motion can deliver a late pan callback for the same pointer.
      // Suppress that callback for this turn, then allow the next gesture to
      // use the normal Framer path if the native fallback is not needed.
      isActiveRef.current = true;
      window.setTimeout(() => {
        isActiveRef.current = false;
      }, 0);
    },
    [clearEndListeners, enabled, onEnd]
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

      const target = event.currentTarget;
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
      };
      isActiveRef.current = true;
      target.setPointerCapture?.(event.pointerId);
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
      event.preventDefault();
      onStart();
    },
    [enabled, finishNative, onStart]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const sample = sampleRef.current;
      if (!enabled || !sample || sample.pointerId !== event.pointerId) {
        return;
      }

      const timestamp = now();
      const elapsed = Math.max(timestamp - sample.lastTime, 1);
      sample.velocityX = ((event.clientX - sample.lastX) / elapsed) * 1000;
      sample.velocityY = ((event.clientY - sample.lastY) / elapsed) * 1000;
      onPan(event.nativeEvent, createPanInfo(sample, event.clientX, event.clientY));
      sample.lastX = event.clientX;
      sample.lastY = event.clientY;
      sample.lastTime = timestamp;
      if (event.cancelable) {
        event.preventDefault();
      }
    },
    [enabled, onPan]
  );

  const finishReact = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => finishNative(event.nativeEvent),
    [finishNative]
  );

  useEffect(() => {
    return (): void => {
      clearEndListeners();
      sampleRef.current = null;
      isActiveRef.current = false;
    };
  }, [clearEndListeners]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishReact,
    onPointerCancel: finishReact,
    isActiveRef,
  };
}
