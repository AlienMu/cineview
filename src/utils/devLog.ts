/**
 * Development logging utility: outputs only when `NODE_ENV === 'development'`, silent in production.
 *
 * Background: the animations layer historically had raw `console.warn/error` calls scattered throughout
 * (no NODE_ENV guard). While `esbuild.drop:['console']` removes console calls from production bundles,
 * dev builds and SSR scenarios that depend on the library source still log. This utility centralizes
 * the gate, aligning with existing guard patterns in context/Scene modules.
 *
 * Uniform prefix `[CineView]` for consistency with other developer-facing diagnostic messages.
 */

const PREFIX = '[CineView]';

const onceKeys = new Set<string>();

export function devWarn(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(PREFIX, ...args);
  }
}

export function devError(...args: unknown[]): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(PREFIX, ...args);
  }
}

/** Cross-instance deduplicated devWarn: warns once per key across the entire session, replacing per-module once flags. */
export function devWarnOnce(key: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'development' || onceKeys.has(key)) return;
  onceKeys.add(key);
  console.warn(PREFIX, ...args);
}

/** Cross-instance deduplicated devError: same semantics as devWarnOnce. */
export function devErrorOnce(key: string, ...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'development' || onceKeys.has(key)) return;
  onceKeys.add(key);
  console.error(PREFIX, ...args);
}
