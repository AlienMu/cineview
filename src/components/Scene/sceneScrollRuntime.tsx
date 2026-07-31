import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import type {
  ResolvedSceneScrollSequence,
  SceneScrollAnimationRegistration,
} from './sceneScrollBudget';
import type { KeyedScrollExternalStore } from '../CineView/scrollExternalStore';

export interface SceneScrollTimelineState {
  zoneId: string;
  sceneIndex: number;
  progressPx: number;
  totalBudgetPx: number;
  active: boolean;
  direction: 'forward' | 'backward' | null;
  sequence: ResolvedSceneScrollSequence;
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
  SceneScrollZoneTimelineSnapshot;

export const SceneScrollRuntimeContext = createContext<SceneScrollRuntimeContextValue | null>(null);

export const SceneScrollTimelineContext = createContext<SceneScrollZoneTimeline | null>(null);

export const SceneScrollTakeoverContext = createContext<string | null>(null);

const EMPTY_SUBSCRIBE = (): (() => void) => () => undefined;

export function useSceneScrollZoneTimeline(
  zoneId: string | null,
  enabled = true
): SceneScrollTimelineState | null {
  const timeline = useContext(SceneScrollTimelineContext);
  const fallback = zoneId ? (timeline?.zoneStates?.[zoneId] ?? null) : null;
  const store = enabled && zoneId ? timeline?.store : undefined;
  const subscribe = useCallback(
    (listener: () => void) =>
      store && zoneId ? store.subscribeKey(zoneId, listener) : EMPTY_SUBSCRIBE(),
    [store, zoneId]
  );
  const getSnapshot = useCallback(
    () => (store && zoneId ? (store.getKeySnapshot(zoneId) ?? null) : fallback),
    [fallback, store, zoneId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
