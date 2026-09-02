import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getSnapshot(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

function subscribe(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }
  // Safari < 14 only has the deprecated listener API.
  media.addListener(listener);
  return () => media.removeListener(listener);
}

/**
 * The OS "reduce motion" preference.
 *
 * It is an external input that can flip while a scene stays mounted, so it is read
 * through `useSyncExternalStore` rather than sampled once. The server snapshot is
 * `false`: SSR has no media query, and rendering the reduced variant into HTML that
 * a full-motion client then hydrates would be the wrong default.
 *
 * Read this once at the CineView root and pass it down the runtime context — one
 * matchMedia subscription per root, not one per Animate.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
