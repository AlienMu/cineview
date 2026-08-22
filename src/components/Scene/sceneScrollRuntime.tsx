import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type {
  ResolvedSceneScrollSequence,
  SceneScrollAnimationRegistration,
} from './sceneScrollBudget';
import type { KeyedScrollExternalStore } from '../runtime/scrollExternalStore';

/**
 * Scroll-offset residency of a zone's segment, quantized with a Schmitt trigger
 * (task-flow 2026-08-14, Plan A "release when far / preload when near"):
 * the near→far (release) transition fires beyond RELEASE margin past the
 * segment; the far→near (preload) transition fires once the viewer returns
 * within PRELOAD margin. The release margin is intentionally the *larger* of
 * the two — a Schmitt trigger is only stable when the return threshold sits
 * strictly inside the leave threshold, otherwise hovering between them flaps
 * release/preload every frame. The timeline store still publishes continuous
 * progress, so its listeners run during scrolling; selecting this discrete band
 * keeps approach consumers render-silent until a threshold crossing. Consumed by
 * AnimateVideo's `releaseOnLeave` to drop decoded video frames once the viewer
 * has scrolled well past the zone.
 */
export type SceneScrollZoneApproach = 'inside' | 'near' | 'far';

/** Beyond this distance past the segment the band flips to 'far' (release). */
export const SCENE_SCROLL_APPROACH_FAR_VH = 1.5;
/** Within this distance of the segment a 'far' band flips back to 'near' (preload). */
export const SCENE_SCROLL_APPROACH_NEAR_VH = 1;

export function resolveZoneApproachBand(
  distancePx: number,
  viewportSpan: number,
  previous: SceneScrollZoneApproach
): SceneScrollZoneApproach {
  if (distancePx <= 0) return 'inside';
  if (previous === 'far') {
    return distancePx <= SCENE_SCROLL_APPROACH_NEAR_VH * viewportSpan ? 'near' : 'far';
  }
  return distancePx > SCENE_SCROLL_APPROACH_FAR_VH * viewportSpan ? 'far' : 'near';
}

export interface SceneScrollTimelineState {
  zoneId: string;
  sceneIndex: number;
  progressPx: number;
  totalBudgetPx: number;
  active: boolean;
  direction: 'forward' | 'backward' | null;
  sequence: ResolvedSceneScrollSequence;
  approach: SceneScrollZoneApproach;
}

// Zone registration API. Stable for the lifetime of the scroll root: every
// member is a useCallback with no per-frame dependencies, so the context value
// built from this never needs to change identity (no per-frame consumer churn).
export interface SceneScrollRuntimeContextValue {
  registerZone: (
    zoneId: string,
    config: {
      sceneIndex: number;
      trigger: 'center-lock';
    }
  ) => void;
  unregisterZone: (zoneId: string, sceneIndex: number) => void;
  setZoneElement: (zoneId: string, sceneIndex: number, element: HTMLElement | null) => void;
  registerZoneAnimation: (
    zoneId: string,
    animation: SceneScrollAnimationRegistration
  ) => SceneScrollAnimationRegistration;
  unregisterZoneAnimation: (
    zoneId: string,
    animateId: string,
    owner: SceneScrollAnimationRegistration
  ) => void;
}

// Per-frame zone timeline snapshot. Lives in its own context so the reactive
// data path (progress) re-renders consumers without touching the stable
// registration API above.
export interface SceneScrollZoneTimelineSnapshot {
  version?: number;
  zoneStates: Record<string, SceneScrollTimelineState>;
}

export type SceneScrollTimelineStore = KeyedScrollExternalStore<
  Record<string, SceneScrollTimelineState>,
  string,
  SceneScrollTimelineState
>;

export interface SceneScrollZoneTimeline {
  version?: number;
  zoneStates?: Record<string, SceneScrollTimelineState>;
  store?: SceneScrollTimelineStore;
}

// Merged shape consumed by useAnimateScroll: the stable registration API plus
// the live timeline snapshot. Animate composes this from the two contexts.
export type SceneScrollZoneRuntime = SceneScrollRuntimeContextValue &
  SceneScrollZoneTimelineSnapshot & {
    /** Stable keyed store for continuous progress consumers. */
    store?: SceneScrollTimelineStore;
  };

export const SceneScrollRuntimeContext = createContext<SceneScrollRuntimeContextValue | null>(null);

export const SceneScrollTimelineContext = createContext<SceneScrollZoneTimeline | null>(null);

export const SceneScrollTakeoverContext = createContext<string | null>(null);

const EMPTY_SUBSCRIBE = (): (() => void) => () => undefined;

export function useSceneScrollZoneSelection<T>(
  zoneId: string | null,
  enabled: boolean,
  select: (state: SceneScrollTimelineState | null) => T
): T {
  const timeline = useContext(SceneScrollTimelineContext);
  const fallback = select(zoneId ? (timeline?.zoneStates?.[zoneId] ?? null) : null);
  const store = enabled && zoneId ? timeline?.store : undefined;
  const subscribe = useCallback(
    (listener: () => void) =>
      store && zoneId ? store.subscribeKey(zoneId, listener) : EMPTY_SUBSCRIBE(),
    [store, zoneId]
  );
  const getSnapshot = useCallback(
    () =>
      select(
        store && zoneId
          ? (store.getKeySnapshot(zoneId) ?? null)
          : zoneId
            ? (timeline?.zoneStates?.[zoneId] ?? null)
            : null
      ),
    [select, store, timeline?.zoneStates, zoneId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}

/**
 * Read only the discrete residency band. The keyed store still receives
 * continuous progress snapshots, but React compares this primitive selection
 * and skips consumer renders until the band actually changes.
 */
export function useSceneScrollZoneApproach(
  zoneId: string | null,
  enabled = true
): SceneScrollZoneApproach | null {
  const selectApproach = useCallback(
    (state: SceneScrollTimelineState | null): SceneScrollZoneApproach | null =>
      state?.approach ?? null,
    []
  );
  return useSceneScrollZoneSelection(zoneId, enabled, selectApproach);
}
