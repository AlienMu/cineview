import { useEffect, useLayoutEffect } from 'react';

/**
 * SSR-safe `useLayoutEffect`.
 *
 * Background: `useLayoutEffect` does not execute during server-side rendering,
 * causing React to emit "useLayoutEffect does nothing on the server" warnings.
 * For a library, this warning appears directly in the consumer's (Next.js / Remix, etc.)
 * server console, even though the library itself has no layout measurements to perform.
 *
 * The fix is a standard community pattern: fall back to `useEffect` when DOM is absent.
 * Neither hook executes on the server, so **client-side behavior is unchanged** — this
 * only suppresses the meaningless server-side warning.
 *
 * Detection uses `typeof document !== 'undefined'` rather than `window`: both are absent
 * in SSR scenarios, but `document` is the actual dependency for layout measurements,
 * making it semantically more precise.
 *
 * Note: this constant is evaluated once at module load time. The library's entire output
 * runs in either browser or server environment for its full lifecycle — there is no
 * mid-execution DOM acquisition, so re-checking on every render is unnecessary.
 */
export const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;
