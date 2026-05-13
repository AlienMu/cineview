import { createContext } from 'react';
import type { ResolvedScrollSequence, ScrollZoneAnimationRegistration } from './scrollZoneBudget';

export interface ScrollZoneTimelineState {
  zoneId: string;
  sceneIndex: number;
  progressPx: number;
  totalBudgetPx: number;
  active: boolean;
  direction: 'forward' | 'backward' | null;
  sequence: ResolvedScrollSequence;
}

export interface ScrollZoneRuntimeContextValue {
  version: number;
  zoneStates: Record<string, ScrollZoneTimelineState>;
  registerZone: (
    zoneId: string,
    config: {
      sceneIndex: number;
      trigger: 'center-lock';
      budget: 'auto' | number;
      replayOnReenter: boolean;
    }
  ) => void;
  unregisterZone: (zoneId: string) => void;
  setZoneElement: (zoneId: string, element: HTMLElement | null) => void;
  registerZoneAnimation: (zoneId: string, animation: ScrollZoneAnimationRegistration) => void;
  unregisterZoneAnimation: (zoneId: string, animateId: string) => void;
}

export const ScrollZoneRuntimeContext = createContext<ScrollZoneRuntimeContextValue | null>(null);

export const ScrollZoneContext = createContext<string | null>(null);
