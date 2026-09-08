/**
 * CineView React UI Framework
 * A React UI framework for creating cinematic full-screen sliding page introductions
 *
 * This entry point is **full-featured**: `CineView` is a runtime-dispatched component
 * based on `mode`, and both engines are included in the bundle.
 * Maintains existing behavior and export surface (default `mode='drag'`).
 *
 * For single-mode usage with smaller bundle size, use mode-specific entry points
 * (especially relevant for UMD consumers, as single-file UMD cannot code-split
 * and the full entry point will always include both engines):
 *   - `cineview/drag`   → drag engine only
 *   - `cineview/scroll` → scroll engine only
 * See `src/entry-drag.ts` / `src/entry-scroll.ts`.
 */

export * from './public-api';
export { CineView } from './components/CineView';
