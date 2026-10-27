/**
 * Platform access in one place.
 *
 * - APIs missing from the DOM typings in use (ViewTimeline: Chrome 115 / Safari 26; requestIdleCallback:
 *   not in Safari) are typed here instead of with casts at each call site.
 * - The module must load where the DOM does not exist (server rendering of a page that imports
 *   cineview): element classes extend `ElementBase`, and nothing here touches `window` unless it exists.
 */
export type ViewTimelineCtor = new (options: {
  subject: Element;
  axis?: 'block' | 'inline';
}) => AnimationTimeline;

export interface IdleDeadlineLike {
  timeRemaining(): number;
}

export type ScrollTimelineCtor = new (options: {
  source?: Element | null;
  axis?: 'block' | 'inline';
}) => AnimationTimeline;

interface PlatformExtras {
  ViewTimeline?: ViewTimelineCtor;
  ScrollTimeline?: ScrollTimelineCtor;
  requestIdleCallback?: (
    cb: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number }
  ) => number;
}

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export const platform: PlatformExtras = isBrowser ? (window as unknown as PlatformExtras) : {};

/**
 * Blink (Chrome, Edge, Android WebView, headless Chrome), from the user agent. It services every
 * live scroll-driven animation on the main thread each frame, which WebKit does not (phase-0 and
 * P1.12 measurements). Only performance tuning reads this, never behaviour.
 */
export const blink = isBrowser && /Chrom(e|ium)\//.test(navigator.userAgent);

export const ElementBase: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/** Idle callback with a timeout; falls back to a macrotask where requestIdleCallback is missing. */
export function whenIdle(step: (deadline?: IdleDeadlineLike) => void, timeout = 200): void {
  const idle = platform.requestIdleCallback;
  if (idle) idle.call(window, step, { timeout });
  else setTimeout(step, 0);
}

/** prefers-reduced-motion, live. Listeners run when the preference changes. */
const reduceQuery =
  isBrowser && typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)')
    : null;
export const prefersReducedMotion = (): boolean => reduceQuery?.matches ?? false;
export function onReducedMotionChange(listener: () => void): () => void {
  reduceQuery?.addEventListener('change', listener);
  return () => reduceQuery?.removeEventListener('change', listener);
}
