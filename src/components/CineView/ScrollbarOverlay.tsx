/**
 * ScrollbarOverlay — scroll 模式自绘滚动条覆盖层（从 DirectScrollCineView 抽出）。
 *
 * 纯展示 + 拖拽输入组件：接收已就绪的滚动量（viewportSpan / scrollContentSpan /
 * scrollOffset / isScrolling）与滚动条配置，自行计算 rail/thumb 几何并渲染；拖拽时
 * 经 `onScrollToOffset(targetOffset)` 把目标偏移回传给父组件（父持有真实 scroll
 * 状态写入权 —— containerRef / setNativeOffset / syncNativeScrollState）。
 *
 * 抽取自 DirectScrollCineView 内联实现，逐字保持几何/拖拽/自动隐藏行为不变。
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clamp, normalizeKeyboardDeltaPx } from './directScrollHelpers';
import type { ScrollExternalStore } from './scrollExternalStore';

const EMPTY_SCROLL_OFFSET_SUBSCRIBE = (): (() => void) => () => undefined;
import type { ScrollbarConfig, SlideDirection } from '../../types';

export interface ScrollbarOverlayProps {
  direction: SlideDirection;
  /** 主轴视口跨度（direction==='x' 时为宽，否则为高）。 */
  viewportSpan: number;
  /** 内容可滚动总跨度。 */
  scrollContentSpan: number;
  /** 当前原生滚动偏移（未 clamp，组件内 clamp 到可滚动范围）。 */
  scrollOffset: number;
  /** Optional live offset store; keeps the root scroll component out of the frame loop. */
  scrollOffsetStore?: ScrollExternalStore<number>;
  /** 是否正在滚动（驱动 autoHide 淡入淡出）。 */
  isScrolling: boolean;
  /** 已解析的滚动条配置对象（width/inset/colors/autoHide）。 */
  config: ScrollbarConfig;
  /** 拖拽/点击轨道时，把目标原生偏移回传父组件写入真实 scroll 状态。 */
  onScrollToOffset: (targetOffset: number) => void;
}

export function ScrollbarOverlay({
  direction,
  viewportSpan,
  scrollContentSpan,
  scrollOffset: initialScrollOffset,
  scrollOffsetStore,
  isScrolling,
  config,
  onScrollToOffset,
}: ScrollbarOverlayProps): JSX.Element | null {
  const fallbackScrollOffset = useCallback(() => initialScrollOffset, [initialScrollOffset]);
  const scrollOffset = useSyncExternalStore(
    scrollOffsetStore?.subscribe ?? EMPTY_SCROLL_OFFSET_SUBSCRIBE,
    scrollOffsetStore?.getSnapshot ?? fallbackScrollOffset,
    scrollOffsetStore?.getSnapshot ?? fallbackScrollOffset
  );
  const scrollbarAutoHide = config.autoHide ?? true;
  const scrollbarAriaLabel = config.ariaLabel ?? 'CineView scroll position';
  const scrollbarThickness = Math.max(config.width ?? 6, 4);
  const scrollbarRadius = Math.max(config.radius ?? 999, 0);
  const scrollbarInset = Math.max(config.inset ?? 0, 0);
  const scrollbarTrackColor = config.trackColor ?? 'transparent';
  const scrollbarThumbColor = config.thumbColor ?? 'rgba(255, 255, 255, 0.28)';
  const scrollbarThumbBorder = config.thumbHoverColor ?? 'rgba(255, 255, 255, 0.42)';
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);

  const nativeScrollableSpan = Math.max(scrollContentSpan - viewportSpan, 0);
  const currentNativeScrollOffset = clamp(scrollOffset, 0, nativeScrollableSpan);
  const effectiveContentSpan = nativeScrollableSpan + viewportSpan;
  const showScrollbarOverlay = nativeScrollableSpan > 1;
  const railLength = Math.max(viewportSpan - scrollbarInset * 2, 1);
  const thumbLength =
    nativeScrollableSpan > 0
      ? clamp(
          (viewportSpan / Math.max(effectiveContentSpan, viewportSpan)) * railLength,
          Math.min(40, railLength),
          railLength
        )
      : railLength;
  const thumbTravel = Math.max(railLength - thumbLength, 0);
  const thumbOffset =
    nativeScrollableSpan > 0
      ? clamp((currentNativeScrollOffset / nativeScrollableSpan) * thumbTravel, 0, thumbTravel)
      : 0;

  const scrollbarDragCleanupRef = useRef<(() => void) | null>(null);

  const handleScrollbarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const delta = normalizeKeyboardDeltaPx(event.key, event.shiftKey, viewportSpan);
      if (delta === 0) {
        return;
      }

      const targetOffset =
        delta === Number.POSITIVE_INFINITY
          ? nativeScrollableSpan
          : delta === Number.NEGATIVE_INFINITY
            ? 0
            : clamp(currentNativeScrollOffset + delta, 0, nativeScrollableSpan);
      onScrollToOffset(targetOffset);
      event.preventDefault();
    },
    [currentNativeScrollOffset, nativeScrollableSpan, onScrollToOffset, viewportSpan]
  );

  const handleScrollbarMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (nativeScrollableSpan <= 0 || typeof window === 'undefined') {
        return;
      }

      event.preventDefault();

      const railRect = event.currentTarget.getBoundingClientRect();
      const trackLength = direction === 'x' ? railRect.width : railRect.height;
      const trackStart = direction === 'x' ? railRect.left : railRect.top;
      const pointer = direction === 'x' ? event.clientX : event.clientY;
      const currentThumbOffset =
        nativeScrollableSpan > 0
          ? clamp(
              (currentNativeScrollOffset / nativeScrollableSpan) *
                Math.max(trackLength - thumbLength, 0),
              0,
              Math.max(trackLength - thumbLength, 0)
            )
          : 0;
      const localPointer = pointer - trackStart;
      const startedOnThumb =
        localPointer >= currentThumbOffset && localPointer <= currentThumbOffset + thumbLength;
      const pointerOffsetWithinThumb = startedOnThumb
        ? localPointer - currentThumbOffset
        : thumbLength / 2;

      const commitPointer = (clientPosition: number): void => {
        const thumbTravelDistance = Math.max(trackLength - thumbLength, 0);
        const localThumbOffset = clamp(
          clientPosition - trackStart - pointerOffsetWithinThumb,
          0,
          thumbTravelDistance
        );
        const ratio = thumbTravelDistance > 0 ? localThumbOffset / thumbTravelDistance : 0;
        onScrollToOffset(ratio * nativeScrollableSpan);
      };

      commitPointer(pointer);

      if (!startedOnThumb) {
        return;
      }

      const handleMove = (moveEvent: MouseEvent): void => {
        commitPointer(direction === 'x' ? moveEvent.clientX : moveEvent.clientY);
      };

      const handleUp = (): void => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        scrollbarDragCleanupRef.current = null;
      };

      // Tear down any drag still attached from a prior mousedown that never
      // received its mouseup, then track this drag's cleanup so an unmount
      // mid-drag does not leak the window listeners.
      scrollbarDragCleanupRef.current?.();
      scrollbarDragCleanupRef.current = handleUp;
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [currentNativeScrollOffset, direction, nativeScrollableSpan, onScrollToOffset, thumbLength]
  );

  useEffect(
    () => (): void => {
      scrollbarDragCleanupRef.current?.();
    },
    []
  );

  if (!showScrollbarOverlay) {
    return null;
  }

  return (
    <div
      data-cineview-scrollbar-overlay="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        pointerEvents: 'none',
        // autoHide: scrollbar is hidden at rest and fades in while
        // scrolling, driven by isScrolling (idle timer flips it
        // false ~120ms after the last scroll input). Without
        // autoHide it stays fully visible.
        opacity: scrollbarAutoHide ? (isScrolling || hasKeyboardFocus ? 1 : 0) : 1,
        // Asymmetric fade: snap visible the instant scrolling
        // starts (isScrolling flips true), then drift out gently
        // after it stops. A single symmetric duration can't both
        // appear instantly and linger — and a slow fade-in never
        // reaches full opacity within the ~120ms isScrolling
        // window during short scrolls.
        transition: scrollbarAutoHide
          ? isScrolling
            ? 'opacity 0.08s ease-out'
            : 'opacity 0.5s ease-in 0.15s'
          : 'none',
      }}
    >
      <div
        role="scrollbar"
        aria-label={scrollbarAriaLabel}
        aria-orientation={direction === 'x' ? 'horizontal' : 'vertical'}
        aria-valuemin={0}
        aria-valuemax={Math.round(nativeScrollableSpan)}
        aria-valuenow={Math.round(currentNativeScrollOffset)}
        tabIndex={0}
        data-cineview-scrollbar-rail="true"
        onMouseDown={handleScrollbarMouseDown}
        onKeyDown={handleScrollbarKeyDown}
        onFocus={() => setHasKeyboardFocus(true)}
        onBlur={() => setHasKeyboardFocus(false)}
        style={
          direction === 'x'
            ? {
                position: 'absolute',
                left: scrollbarInset,
                top: Math.max(viewportSpan - scrollbarThickness - scrollbarInset, 0),
                width: railLength,
                height: scrollbarThickness,
                borderRadius: scrollbarRadius,
                background: scrollbarTrackColor,
                boxShadow:
                  '0 0 0 1px rgba(255, 255, 255, 0.78), 0 10px 24px rgba(53, 74, 116, 0.14)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                outline: hasKeyboardFocus ? '2px solid rgba(24, 119, 242, 0.95)' : 'none',
                outlineOffset: 2,
              }
            : {
                position: 'absolute',
                top: scrollbarInset,
                right: scrollbarInset,
                width: scrollbarThickness,
                height: railLength,
                borderRadius: scrollbarRadius,
                background: scrollbarTrackColor,
                boxShadow:
                  '0 0 0 1px rgba(255, 255, 255, 0.78), 0 10px 24px rgba(53, 74, 116, 0.14)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                outline: hasKeyboardFocus ? '2px solid rgba(24, 119, 242, 0.95)' : 'none',
                outlineOffset: 2,
              }
        }
      >
        <div
          data-cineview-scrollbar-thumb="true"
          style={
            direction === 'x'
              ? {
                  position: 'absolute',
                  left: thumbOffset,
                  top: 0,
                  width: thumbLength,
                  height: scrollbarThickness,
                  borderRadius: scrollbarRadius,
                  background: scrollbarThumbColor,
                  boxShadow: `0 0 0 1px ${scrollbarThumbBorder}, 0 10px 24px rgba(53, 74, 116, 0.16)`,
                  cursor: 'grab',
                }
              : {
                  position: 'absolute',
                  top: thumbOffset,
                  left: 0,
                  width: scrollbarThickness,
                  height: thumbLength,
                  borderRadius: scrollbarRadius,
                  background: scrollbarThumbColor,
                  boxShadow: `0 0 0 1px ${scrollbarThumbBorder}, 0 10px 24px rgba(53, 74, 116, 0.16)`,
                  cursor: 'grab',
                }
          }
        />
      </div>
    </div>
  );
}

ScrollbarOverlay.displayName = 'ScrollbarOverlay';
