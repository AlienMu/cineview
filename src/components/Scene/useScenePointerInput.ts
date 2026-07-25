import { useCallback } from 'react';
import type { PointerEventHandler } from 'react';
import type { PanInfo } from 'framer-motion';
import { useNativePointerDrag } from './useNativePointerDrag';

type PanEvent = MouseEvent | TouchEvent | PointerEvent;

interface UseScenePointerInputParams {
  enabled: boolean;
  onDragStart: () => void;
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
  const onFramerPanStart = useCallback((): void => {
    if (!nativePointerDrag.isActiveRef.current) {
      onDragStart();
    }
  }, [nativePointerDrag.isActiveRef, onDragStart]);
  const onFramerPan = useCallback(
    (event: PanEvent, info: PanInfo): void => {
      if (!nativePointerDrag.isActiveRef.current) {
        onPan(event, info);
      }
    },
    [nativePointerDrag.isActiveRef, onPan]
  );
  const onFramerPanEnd = useCallback(
    (event: PanEvent, info: PanInfo): void => {
      if (!nativePointerDrag.isActiveRef.current) {
        onPanEnd(event, info);
      }
    },
    [nativePointerDrag.isActiveRef, onPanEnd]
  );

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
