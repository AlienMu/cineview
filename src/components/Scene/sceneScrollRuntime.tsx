import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import type {
  ResolvedSceneScrollSequence,
  SceneScrollAnimationRegistration,
} from './sceneScrollBudget';
import type { ScrollExternalStore } from '../CineView/scrollExternalStore';

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
  unregisterZone: (zoneId: string) => void;
  setZoneElement: (zoneId: string, element: HTMLElement | null) => void;
  registerZoneAnimation: (zoneId: string, animation: SceneScrollAnimationRegistration) => void;
  unregisterZoneAnimation: (zoneId: string, animateId: string) => void;
}

// Per-frame zone timeline snapshot. Lives in its own context so the reactive
// data path (progress) re-renders consumers without touching the stable
// registration API above.
export interface SceneScrollZoneTimelineSnapshot {
  version: number;
  zoneStates: Record<string, SceneScrollTimelineState>;
}

export interface SceneScrollZoneTimeline {
  version?: number;
  zoneStates?: Record<string, SceneScrollTimelineState>;
  store?: ScrollExternalStore<SceneScrollZoneTimelineSnapshot>;
}

// Merged shape consumed by useAnimateScroll: the stable registration API plus
// the live timeline snapshot. Animate composes this from the two contexts.
export type SceneScrollZoneRuntime = SceneScrollRuntimeContextValue &
  SceneScrollZoneTimelineSnapshot;

export const SceneScrollRuntimeContext = createContext<SceneScrollRuntimeContextValue | null>(null);

export const SceneScrollTimelineContext = createContext<SceneScrollZoneTimeline | null>(null);

export const SceneScrollTakeoverContext = createContext<string | null>(null);

const EMPTY_SUBSCRIBE = (): (() => void) => () => undefined;

export function useSceneScrollTimeline(enabled = true): SceneScrollZoneTimelineSnapshot {
  const timeline = useContext(SceneScrollTimelineContext);
  const fallback = useMemo<SceneScrollZoneTimelineSnapshot>(
    () => ({
      version: timeline?.version ?? 0,
      zoneStates: timeline?.zoneStates ?? {},
    }),
    [timeline]
  );
  const fallbackGetter = useCallback(() => fallback, [fallback]);
  const store = enabled ? timeline?.store : undefined;
  const subscribe = store?.subscribe ?? EMPTY_SUBSCRIBE;
  const getSnapshot = store?.getSnapshot ?? fallbackGetter;

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
