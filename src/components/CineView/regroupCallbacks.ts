import type {
  CineViewCommonCallbacks,
  CineViewDragCallbacks,
  CineViewScrollCallbacks,
} from '../../types';

// The public callback surface is flat + mode-aware (see CineViewProps). Internally
// the consumers still read by group (`resolvedCallbacks.common?.X` /
// `.drag?.X` / `.scroll?.X`), so regroupCallbacks splits the flat object back into
// the nested shape. Keeping the internal read points grouped means the ~30 call
// sites across CineView/DirectScroll do not change when the public API flattens.

/** Superset of every flat callback key a consumer might pass (any mode). */
export type FlatCallbacks = CineViewCommonCallbacks &
  CineViewDragCallbacks &
  CineViewScrollCallbacks;

/** Internal grouped shape the runtime reads from. */
export interface GroupedCallbacks {
  common?: CineViewCommonCallbacks;
  drag?: CineViewDragCallbacks;
  scroll?: CineViewScrollCallbacks;
}

export function regroupCallbacks(flat: FlatCallbacks | undefined): GroupedCallbacks {
  if (!flat) {
    return { common: {}, drag: {}, scroll: {} };
  }
  return {
    common: {
      onReady: flat.onReady,
      onLoadProgress: flat.onLoadProgress,
      onSceneWillChange: flat.onSceneWillChange,
      onSceneDidChange: flat.onSceneDidChange,
      onError: flat.onError,
    },
    drag: {
      onDragStart: flat.onDragStart,
      onDragProgress: flat.onDragProgress,
      onDragCommit: flat.onDragCommit,
      onDragCancel: flat.onDragCancel,
    },
    scroll: {
      onZoneEnter: flat.onZoneEnter,
      onZoneLeave: flat.onZoneLeave,
      onZoneProgress: flat.onZoneProgress,
      onSceneVisibilityChange: flat.onSceneVisibilityChange,
    },
  };
}
