/**
 * View progress: a subject's passage through the viewport, and named ranges on it (CSS
 * `animation-range`, plan v3 §3.4–3.5). The native path hands the same ranges to a ViewTimeline;
 * this is the formula for the direct-write path (fallback, drag), which must agree with it.
 *
 * Positions are scroll offsets into the `cover` range: 0 when the subject's top edge meets the
 * viewport's bottom edge, `viewport + height` when its bottom edge meets the viewport's top edge.
 * Drag computes the same with the paging offset in place of the scroll offset (plan v3 F7).
 */
import type { ViewEdge, ViewRangeName } from './fx';

/** A layer's named range, both edges; null = all of `cover`. */
export type ViewRange = readonly [ViewEdge, ViewEdge];

/** Start and end of a named range, as offsets into `cover` (px). */
export function rangeSpan(name: ViewRangeName, height: number, viewport: number): [number, number] {
  const low = Math.min(height, viewport);
  const high = Math.max(height, viewport);
  switch (name) {
    case 'cover':
      return [0, viewport + height];
    case 'contain':
      return [low, high];
    case 'entry':
      return [0, low];
    case 'exit':
      return [high, viewport + height];
    case 'entry-crossing':
      return [0, height];
    case 'exit-crossing':
      return [viewport, viewport + height];
  }
}

const edgeAt = (edge: ViewEdge, height: number, viewport: number): number => {
  const [a, b] = rangeSpan(edge.name, height, viewport);
  return a + (b - a) * edge.offset;
};

/**
 * Progress (0–1) of a subject whose top edge is `top` px below the viewport's top edge, through
 * `range` (all of `cover` when null).
 */
export function viewProgress(
  top: number,
  height: number,
  viewport: number,
  range: ViewRange | null
): number {
  const at = viewport - top;
  const start = range ? edgeAt(range[0], height, viewport) : 0;
  const end = range ? edgeAt(range[1], height, viewport) : viewport + height;
  if (end <= start) return at >= end ? 1 : 0;
  return at <= start ? 0 : at >= end ? 1 : (at - start) / (end - start);
}

/** `rangeStart` / `rangeEnd` for a native view-driven animation. */
export function rangeCss(range: ViewRange | null): { rangeStart: string; rangeEnd: string } {
  if (!range) return { rangeStart: 'cover 0%', rangeEnd: 'cover 100%' };
  const css = (e: ViewEdge): string => `${e.name} ${+(e.offset * 100).toFixed(4)}%`;
  return { rangeStart: css(range[0]), rangeEnd: css(range[1]) };
}

/** Same range (null = all of cover). */
export function sameRange(a: ViewRange | null, b: ViewRange | null): boolean {
  if (!a || !b) return a === b;
  return (
    a[0].name === b[0].name &&
    a[0].offset === b[0].offset &&
    a[1].name === b[1].name &&
    a[1].offset === b[1].offset
  );
}
