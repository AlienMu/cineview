import { isValidElement } from 'react';
import type React from 'react';
import type { AnimationType, CineViewProps, ScrollTimelineState, SceneProps } from '../../types';

export type SceneAuthoringCompatProps = SceneProps & {
  sceneId?: string;
  sceneHeight?: number | string;
  sceneWidth?: number | string;
  sceneZIndex?: number;
  sceneTransitionDuration?: number;
  enterAnimation?: AnimationType;
  exitAnimation?: AnimationType;
  exitDuration?: number;
  scrollEnterLength?: number;
  scrollExitLength?: number;
};

export interface SceneLayoutInfo {
  sceneStart: number;
  sceneEnd: number;
  visualSpan: number;
  flowSpan: number;
  timelineDistancePx: number;
  centerLockOffset: number;
  segmentStart: number;
  segmentEnd: number;
  enterLength: number;
  exitLength: number;
  stackMode: 'replace' | 'cover';
}

export interface CenterLockSegment {
  segmentStart: number;
  segmentEnd: number;
}

export type ScrollInputDirection = 'forward' | 'backward';

export const TAKEOVER_PROGRESS_SNAP_EPSILON_PX = 0.01;
export const CENTER_LOCK_BOUNDARY_EPSILON_PX = 0.5;

export function isScrollDebugEnabled(): boolean {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return false;
  }

  return Boolean(
    (window as Window & { __CINEVIEW_SCROLL_DEBUG__?: boolean }).__CINEVIEW_SCROLL_DEBUG__
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeWheelDeltaPx(
  delta: number,
  deltaMode: number,
  viewportSpan: number
): number {
  if (!Number.isFinite(delta) || delta === 0) {
    return 0;
  }

  if (deltaMode === 1) {
    return delta * 18;
  }

  if (deltaMode === 2) {
    return delta * Math.max(viewportSpan, 1);
  }

  return delta;
}

export function normalizeTouchDeltaPx(delta: number): number {
  return Number.isFinite(delta) ? delta : 0;
}

export function normalizeKeyboardDeltaPx(
  key: string,
  shiftKey: boolean,
  viewportSpan: number
): number {
  const pageStep = Math.max(viewportSpan * 0.86, 1);
  const lineStep = 80;

  switch (key) {
    case 'PageDown':
      return pageStep;
    case 'PageUp':
      return -pageStep;
    case ' ':
    case 'Spacebar':
      return shiftKey ? -pageStep : pageStep;
    case 'ArrowDown':
      return lineStep;
    case 'ArrowUp':
      return -lineStep;
    case 'Home':
      return Number.NEGATIVE_INFINITY;
    case 'End':
      return Number.POSITIVE_INFINITY;
    default:
      return 0;
  }
}

export function resolveScrollIntentOffset({
  currentOffset,
  deltaPx,
  maxNativeOffset,
  segments = [],
}: {
  currentOffset: number;
  deltaPx: number;
  maxNativeOffset: number;
  segments?: CenterLockSegment[];
}): number {
  if (deltaPx === 0) {
    return clamp(currentOffset, 0, maxNativeOffset);
  }

  const current = clamp(currentOffset, 0, maxNativeOffset);
  const target =
    deltaPx === Number.POSITIVE_INFINITY
      ? maxNativeOffset
      : deltaPx === Number.NEGATIVE_INFINITY
        ? 0
        : clamp(current + deltaPx, 0, maxNativeOffset);

  if (segments.length === 0 || Math.abs(target - current) <= CENTER_LOCK_BOUNDARY_EPSILON_PX) {
    return target;
  }

  if (target > current) {
    const crossedSegment = segments.find(
      (segment) =>
        current < segment.segmentStart - CENTER_LOCK_BOUNDARY_EPSILON_PX &&
        target > segment.segmentEnd + CENTER_LOCK_BOUNDARY_EPSILON_PX
    );
    if (crossedSegment) {
      return Math.min(crossedSegment.segmentStart + 1, crossedSegment.segmentEnd);
    }

    const activeSegment = segments.find(
      (segment) =>
        current >= segment.segmentStart - CENTER_LOCK_BOUNDARY_EPSILON_PX &&
        current < segment.segmentEnd - CENTER_LOCK_BOUNDARY_EPSILON_PX
    );
    if (activeSegment && target > activeSegment.segmentEnd + CENTER_LOCK_BOUNDARY_EPSILON_PX) {
      return activeSegment.segmentEnd;
    }

    return target;
  }

  const crossedSegment = [...segments]
    .reverse()
    .find(
      (segment) =>
        current > segment.segmentEnd + CENTER_LOCK_BOUNDARY_EPSILON_PX &&
        target < segment.segmentStart - CENTER_LOCK_BOUNDARY_EPSILON_PX
    );
  if (crossedSegment) {
    return Math.max(crossedSegment.segmentEnd - 1, crossedSegment.segmentStart);
  }

  const activeSegment = [...segments]
    .reverse()
    .find(
      (segment) =>
        current > segment.segmentStart + CENTER_LOCK_BOUNDARY_EPSILON_PX &&
        current <= segment.segmentEnd + CENTER_LOCK_BOUNDARY_EPSILON_PX
    );
  if (activeSegment && target < activeSegment.segmentStart - CENTER_LOCK_BOUNDARY_EPSILON_PX) {
    return activeSegment.segmentStart;
  }

  return target;
}

export function shouldIgnoreGlobalScrollKey(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (
    event.key === ' ' &&
    (tagName === 'button' ||
      tagName === 'summary' ||
      (tagName === 'a' && target.hasAttribute('href')) ||
      target.getAttribute('role') === 'button' ||
      target.getAttribute('role') === 'link')
  ) {
    return true;
  }

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function isSceneElement(
  node: React.ReactNode
): node is React.ReactElement<SceneAuthoringCompatProps> {
  return (
    isValidElement(node) &&
    typeof node.type !== 'string' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node.type as any).displayName === 'Scene'
  );
}

export function resolveDesignDimensions(config: CineViewProps['config']): {
  designWidth: number;
  designHeight: number;
  unit: NonNullable<CineViewProps['config']['unit']>;
} {
  return {
    designWidth: config.width ?? 750,
    designHeight: config.height ?? 1334,
    unit: config.unit ?? 'px',
  };
}

export function getSceneTransitionConfig(sceneProps: SceneAuthoringCompatProps): {
  enterAnimation?: SceneAuthoringCompatProps['enterAnimation'];
  exitAnimation?: SceneAuthoringCompatProps['exitAnimation'];
  transitionDurationMs: number;
  scrollEnterLength?: number;
  scrollExitLength?: number;
} {
  return {
    enterAnimation: sceneProps.transition?.enterAnimation ?? sceneProps.enterAnimation,
    exitAnimation: sceneProps.transition?.exitAnimation ?? sceneProps.exitAnimation,
    transitionDurationMs: sceneProps.sceneTransitionDuration ?? 800,
    scrollEnterLength: sceneProps.scrollEnterLength,
    scrollExitLength: sceneProps.scrollExitLength,
  };
}

export function resolveRootSceneStackMode(
  sceneProps: SceneAuthoringCompatProps
): 'replace' | 'cover' {
  return sceneProps.stack?.mode ?? 'cover';
}

/**
 * 把一个 scene span 原始值（number | 'NNNpx' | 'NNNvh' | 'NNNvw' | 'auto'）解析为
 * 像素跨度。两种消费模式由 `designConversion` 区分（逐分支等价于拆分前的两份实现）：
 *
 * - `designConversion = null`（普通 declared scene）：number 与 `px` 原样返回；
 *   `vh`/`vw` 按视口换算；结果不向下取整到 1。
 * - `designConversion` 提供（takeover scene）：number 与 `px` 先做 design→viewport
 *   换算（`(n / designSpan) * viewportSpan`）；所有分支结果 floor 到 ≥ 1。
 *
 * 非正数、非法字符串与 `auto` 一律返回 null（交由调用方回退到测量值）。
 */
function resolveSpanValue(
  rawSize: number | string | undefined,
  direction: 'x' | 'y',
  viewportWidth: number,
  viewportHeight: number,
  designConversion: { designWidth: number; designHeight: number } | null
): number | null {
  const viewportSpan = Math.max(direction === 'x' ? viewportWidth : viewportHeight, 1);
  // takeover 模式（有 designConversion）对所有分支 floor 到 1；declared 模式不 floor。
  const floor = (value: number): number => (designConversion ? Math.max(value, 1) : value);
  // number / px：takeover 做 design→viewport 换算后 floor；declared 原样返回。
  const resolveAbsolute = (value: number): number => {
    if (!designConversion) {
      return value;
    }
    const designSpan = Math.max(
      direction === 'x' ? designConversion.designWidth : designConversion.designHeight,
      1
    );
    return Math.max((value / designSpan) * viewportSpan, 1);
  };

  if (typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize > 0) {
    return resolveAbsolute(rawSize);
  }

  if (typeof rawSize !== 'string') {
    return null;
  }

  const value = rawSize.trim().toLowerCase();
  if (!value || value === 'auto') {
    return null;
  }

  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (value.endsWith('px')) {
    return resolveAbsolute(numericValue);
  }

  if (value.endsWith('vh')) {
    return floor((viewportHeight * numericValue) / 100);
  }

  if (value.endsWith('vw')) {
    return floor((viewportWidth * numericValue) / 100);
  }

  return null;
}

export function resolveScrollSceneDeclaredSpan(
  sceneProps: SceneAuthoringCompatProps,
  direction: 'x' | 'y',
  viewportWidth: number,
  viewportHeight: number
): number | null {
  const rawSize =
    direction === 'x'
      ? (sceneProps.layout?.width ?? sceneProps.sceneWidth)
      : (sceneProps.layout?.height ?? sceneProps.sceneHeight);

  return resolveSpanValue(rawSize, direction, viewportWidth, viewportHeight, null);
}

export function resolveTakeoverSceneSpan(
  rawSize: number | string | undefined,
  direction: 'x' | 'y',
  viewportWidth: number,
  viewportHeight: number,
  designWidth: number,
  designHeight: number
): number | null {
  return resolveSpanValue(rawSize, direction, viewportWidth, viewportHeight, {
    designWidth,
    designHeight,
  });
}

export function getRelativeOffset(
  element: HTMLElement,
  root: HTMLElement,
  direction: 'x' | 'y'
): number {
  const elementRect = element.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const rootScroll = direction === 'x' ? root.scrollLeft : root.scrollTop;
  return direction === 'x'
    ? elementRect.left - rootRect.left + rootScroll
    : elementRect.top - rootRect.top + rootScroll;
}

export function buildSceneTimelineState(
  layout: SceneLayoutInfo | null,
  scrollOffset: number,
  viewportSpan: number
): ScrollTimelineState | null {
  if (!layout) {
    return null;
  }

  const safeViewportSpan = Math.max(viewportSpan, 1);
  const viewportTop = scrollOffset;
  const viewportBottom = scrollOffset + safeViewportSpan;
  const viewportCenter = viewportTop + safeViewportSpan / 2;
  const holdStart = layout.sceneStart + layout.enterLength;
  const exitStart = layout.sceneEnd - Math.max(layout.exitLength, 0);

  let phase: ScrollTimelineState['phase'] = 'before';
  let enterProgress = 0;
  let exitProgress = 0;

  if (viewportBottom <= layout.sceneStart) {
    phase = 'before';
  } else if (viewportTop >= layout.sceneEnd) {
    phase = 'after';
    enterProgress = layout.enterLength > 0 ? 1 : 0;
    exitProgress = layout.exitLength > 0 ? 1 : 0;
  } else if (layout.enterLength > 0 && viewportTop < holdStart) {
    phase = 'enter';
    enterProgress = clamp(
      (viewportBottom - layout.sceneStart) / Math.max(layout.enterLength, 1),
      0,
      1
    );
  } else if (layout.exitLength > 0 && viewportTop >= exitStart) {
    phase = 'exit';
    exitProgress = clamp((viewportTop - exitStart) / Math.max(layout.exitLength, 1), 0, 1);
    enterProgress = layout.enterLength > 0 ? 1 : 0;
  } else {
    phase = 'hold';
    enterProgress = layout.enterLength > 0 ? 1 : 0;
  }

  const rangeLength = Math.max(layout.sceneEnd - layout.sceneStart, 1);
  const sceneProgress = clamp((viewportCenter - layout.sceneStart) / rangeLength, 0, 1);

  return {
    phase,
    enterProgress,
    exitProgress,
    sceneProgress,
    rangeStart: layout.sceneStart,
    rangeEnd: layout.sceneEnd,
    rangeLength,
    enterLength: layout.enterLength,
    exitLength: layout.exitLength,
  };
}

export function areSceneLayoutsEqual(
  currentLayouts: SceneLayoutInfo[],
  nextLayouts: SceneLayoutInfo[]
): boolean {
  if (currentLayouts.length !== nextLayouts.length) {
    return false;
  }

  return nextLayouts.every((nextLayout, index) => {
    const currentLayout = currentLayouts[index];
    return (
      currentLayout.sceneStart === nextLayout.sceneStart &&
      currentLayout.sceneEnd === nextLayout.sceneEnd &&
      currentLayout.visualSpan === nextLayout.visualSpan &&
      currentLayout.flowSpan === nextLayout.flowSpan &&
      currentLayout.timelineDistancePx === nextLayout.timelineDistancePx &&
      currentLayout.centerLockOffset === nextLayout.centerLockOffset &&
      currentLayout.segmentStart === nextLayout.segmentStart &&
      currentLayout.segmentEnd === nextLayout.segmentEnd &&
      currentLayout.enterLength === nextLayout.enterLength &&
      currentLayout.exitLength === nextLayout.exitLength &&
      currentLayout.stackMode === nextLayout.stackMode
    );
  });
}

export function createScrollbarCss(): string {
  return `
    [data-cineview-container="true"] {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    [data-cineview-container="true"]::-webkit-scrollbar {
      width: 0;
      height: 0;
      display: none;
    }
  `;
}
