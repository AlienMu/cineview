import { createContext } from 'react';
import type {
  ResolvedSceneScrollSequence,
  SceneScrollAnimationRegistration,
} from './sceneScrollBudget';

export interface SceneScrollTimelineState {
  zoneId: string;
  sceneIndex: number;
  progressPx: number;
  totalBudgetPx: number;
  active: boolean;
  direction: 'forward' | 'backward' | null;
  sequence: ResolvedSceneScrollSequence;
}

export interface SceneScrollRuntimeContextValue {
  version: number;
  zoneStates: Record<string, SceneScrollTimelineState>;
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

export const SceneScrollRuntimeContext = createContext<SceneScrollRuntimeContextValue | null>(
  null
);

export const SceneScrollTimelineContext = createContext<{
  version: number;
  zoneStates: Record<string, SceneScrollTimelineState>;
} | null>(null);

export const SceneScrollTakeoverContext = createContext<string | null>(null);
