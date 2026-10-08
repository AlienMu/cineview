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

interface PlatformExtras {
  ViewTimeline?: ViewTimelineCtor;
  requestIdleCallback?: (
    cb: (deadline: IdleDeadlineLike) => void,
    options?: { timeout: number }
  ) => number;
}

export const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export const platform: PlatformExtras = isBrowser ? (window as unknown as PlatformExtras) : {};

export const ElementBase: typeof HTMLElement =
  typeof HTMLElement === 'undefined' ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

/** Idle callback with a timeout; falls back to a macrotask where requestIdleCallback is missing. */
export function whenIdle(step: (deadline?: IdleDeadlineLike) => void, timeout = 200): void {
  const idle = platform.requestIdleCallback;
  if (idle) idle.call(window, step, { timeout });
  else setTimeout(step, 0);
}
