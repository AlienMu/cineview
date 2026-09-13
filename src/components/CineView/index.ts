/**
 * Cineview component exports
 */

// `Cineview` comes from the dispatcher (references both engines), not `./Cineview` (now contains only the drag engine).
// See CineviewDispatch.tsx comments: this isolation is required for UMD to split output by mode.
export { Cineview } from './CineviewDispatch';
export type { CineviewPreloadTarget, CineviewProps, CineviewRef } from '../../types';
