/**
 * CineView component exports
 */

// `CineView` comes from the dispatcher (references both engines), not `./CineView` (now contains only the drag engine).
// See CineViewDispatch.tsx comments: this isolation is required for UMD to split output by mode.
export { CineView } from './CineViewDispatch';
export type { CineViewPreloadTarget, CineViewProps, CineViewRef } from '../../types';
