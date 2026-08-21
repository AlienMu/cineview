import { useCallback, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type {
  SceneScrollRuntimeContextValue,
  SceneScrollTimelineState,
  SceneScrollTimelineStore,
} from '../Scene/sceneScrollRuntime';
import {
  areResolvedSceneScrollSequencesEqual,
  resolveSceneScrollAnimationBudgets,
  type SceneScrollAnimationRegistration,
} from '../Scene/sceneScrollBudget';
import { createKeyedScrollExternalStore } from './scrollExternalStore';

export interface ScrollZoneRegistration {
  sceneIndex: number;
  trigger: 'center-lock';
  element: HTMLElement | null;
}

export type ScrollZoneRegistryRef = MutableRefObject<Map<string, ScrollZoneRegistration>>;
export type ScrollZoneAnimationsRef = MutableRefObject<
  Map<string, Map<string, SceneScrollAnimationRegistration>>
>;
export type ScrollZoneStatesRef = MutableRefObject<Record<string, SceneScrollTimelineState>>;
export type ScrollTimelineStore = SceneScrollTimelineStore;

interface UseScrollZoneRegistryParams {
  scrollOffsetRef: MutableRefObject<number>;
  measureSceneLayoutsRef: MutableRefObject<(() => void) | null>;
  updateSceneRenderSnapshotsRef: MutableRefObject<(nativeOffset: number) => void>;
}

export interface ScrollZoneRegistryPort {
  zoneRegistryRef: ScrollZoneRegistryRef;
  zoneAnimationsRef: ScrollZoneAnimationsRef;
  zoneStatesRef: ScrollZoneStatesRef;
  timelineStoreRef: MutableRefObject<ScrollTimelineStore>;
  zoneRuntimeVersion: number;
  getZoneIdForScene: (sceneIndex: number) => string | null;
  getZoneDistance: (sceneIndex: number) => number;
  syncZoneState: (
    zoneId: string,
    updater: (current: SceneScrollTimelineState | undefined) => SceneScrollTimelineState | null
  ) => void;
  recomputeZoneSequence: (zoneId: string) => void;
  zoneRuntimeValue: SceneScrollRuntimeContextValue;
  zoneTimelineValue: { store: ScrollTimelineStore };
}

export function useScrollZoneRegistry({
  scrollOffsetRef,
  measureSceneLayoutsRef,
  updateSceneRenderSnapshotsRef,
}: UseScrollZoneRegistryParams): ScrollZoneRegistryPort {
  const zoneRegistryRef = useRef(new Map<string, ScrollZoneRegistration>());
  const zoneAnimationsRef = useRef(
    new Map<string, Map<string, SceneScrollAnimationRegistration>>()
  );
  const zoneStatesRef = useRef<Record<string, SceneScrollTimelineState>>({});
  const timelineStoreRef = useRef<ScrollTimelineStore>(
    createKeyedScrollExternalStore<
      ReturnType<ScrollTimelineStore['getSnapshot']>,
      string,
      SceneScrollTimelineState
    >({}, (snapshot, zoneId) => snapshot[zoneId])
  );
  const [zoneRuntimeVersion, setZoneRuntimeVersion] = useState(0);

  const getZoneIdForScene = useCallback((sceneIndex: number): string | null => {
    for (const [zoneId, meta] of zoneRegistryRef.current.entries()) {
      if (meta.sceneIndex === sceneIndex) {
        return zoneId;
      }
    }

    return null;
  }, []);

  const getZoneDistance = useCallback(
    (sceneIndex: number): number => {
      const zoneId = getZoneIdForScene(sceneIndex);
      return zoneId ? (zoneStatesRef.current[zoneId]?.totalBudgetPx ?? 0) : 0;
    },
    [getZoneIdForScene]
  );

  const syncZoneState = useCallback(
    (
      zoneId: string,
      updater: (current: SceneScrollTimelineState | undefined) => SceneScrollTimelineState | null
    ): void => {
      const currentStates = zoneStatesRef.current;
      const nextState = updater(currentStates[zoneId]);
      if (!nextState) {
        if (!(zoneId in currentStates)) {
          return;
        }

        const nextStates = { ...currentStates };
        delete nextStates[zoneId];
        zoneStatesRef.current = nextStates;
      } else {
        const previous = currentStates[zoneId];
        if (
          previous &&
          previous.sceneIndex === nextState.sceneIndex &&
          previous.progressPx === nextState.progressPx &&
          previous.totalBudgetPx === nextState.totalBudgetPx &&
          previous.active === nextState.active &&
          previous.direction === nextState.direction &&
          previous.approach === nextState.approach &&
          areResolvedSceneScrollSequencesEqual(previous.sequence, nextState.sequence)
        ) {
          return;
        }

        zoneStatesRef.current = { ...currentStates, [zoneId]: nextState };
      }

      timelineStoreRef.current.setSnapshot(zoneStatesRef.current);
      updateSceneRenderSnapshotsRef.current(scrollOffsetRef.current);
    },
    [scrollOffsetRef, updateSceneRenderSnapshotsRef]
  );

  const recomputeZoneSequence = useCallback(
    (zoneId: string): void => {
      const meta = zoneRegistryRef.current.get(zoneId);
      if (!meta) {
        syncZoneState(zoneId, () => null);
        return;
      }

      const registrations = zoneAnimationsRef.current.get(zoneId) ?? new Map();
      const sequence = resolveSceneScrollAnimationBudgets(registrations);
      syncZoneState(zoneId, (current) => ({
        zoneId,
        sceneIndex: meta.sceneIndex,
        progressPx: Math.min(sequence.totalBudgetPx, Math.max(current?.progressPx ?? 0, 0)),
        totalBudgetPx: sequence.totalBudgetPx,
        active: current?.active ?? false,
        direction: current?.direction ?? null,
        sequence,
        // 'near' = resident/loaded semantics: matches the pre-approach-band
        // behavior (media stays alive) until the first scroll sync quantizes it.
        approach: current?.approach ?? 'near',
      }));
      setZoneRuntimeVersion((version) => version + 1);
    },
    [syncZoneState]
  );

  // One-shot dev diagnostic per zoneId for defensive registrations that bypass
  // the scroll root's authored-scene preflight.
  const warnedDuplicateZoneIdsRef = useRef(new Set<string>());

  const registerZone = useCallback(
    (zoneId: string, config: { sceneIndex: number; trigger: 'center-lock' }): void => {
      const existing = zoneRegistryRef.current.get(zoneId);
      if (existing && existing.sceneIndex !== config.sceneIndex) {
        if (
          process.env.NODE_ENV !== 'production' &&
          !warnedDuplicateZoneIdsRef.current.has(zoneId)
        ) {
          warnedDuplicateZoneIdsRef.current.add(zoneId);
          console.warn(
            `[CineView] Duplicate scroll zone id "${zoneId}": scene ${config.sceneIndex} was rejected because scene ${existing.sceneIndex} already owns it. Give each Scene a unique sceneId or scroll.zoneId.`
          );
        }
        return;
      }

      if (existing) {
        recomputeZoneSequence(zoneId);
        return;
      }

      zoneRegistryRef.current.set(zoneId, {
        ...config,
        element: null,
      });
      recomputeZoneSequence(zoneId);
    },
    [recomputeZoneSequence]
  );

  const unregisterZone = useCallback(
    (zoneId: string, sceneIndex: number): void => {
      if (zoneRegistryRef.current.get(zoneId)?.sceneIndex !== sceneIndex) {
        return;
      }
      zoneRegistryRef.current.delete(zoneId);
      zoneAnimationsRef.current.delete(zoneId);
      syncZoneState(zoneId, () => null);
      setZoneRuntimeVersion((version) => version + 1);
    },
    [syncZoneState]
  );

  const setZoneElement = useCallback(
    (zoneId: string, sceneIndex: number, element: HTMLElement | null): void => {
      const meta = zoneRegistryRef.current.get(zoneId);
      if (!meta || meta.sceneIndex !== sceneIndex) return;
      meta.element = element;
      measureSceneLayoutsRef.current?.();
    },
    [measureSceneLayoutsRef]
  );

  const registerZoneAnimation = useCallback(
    (
      zoneId: string,
      animation: SceneScrollAnimationRegistration
    ): SceneScrollAnimationRegistration => {
      const existing = zoneAnimationsRef.current.get(zoneId) ?? new Map();
      existing.set(animation.animateId, animation);
      zoneAnimationsRef.current.set(zoneId, existing);
      recomputeZoneSequence(zoneId);
      return animation;
    },
    [recomputeZoneSequence]
  );

  const unregisterZoneAnimation = useCallback(
    (zoneId: string, animateId: string, owner: SceneScrollAnimationRegistration): void => {
      const existing = zoneAnimationsRef.current.get(zoneId);
      if (!existing || existing.get(animateId) !== owner) {
        return;
      }

      existing.delete(animateId);
      recomputeZoneSequence(zoneId);
    },
    [recomputeZoneSequence]
  );

  const zoneRuntimeValue = useMemo<SceneScrollRuntimeContextValue>(
    () => ({
      registerZone,
      unregisterZone,
      setZoneElement,
      registerZoneAnimation,
      unregisterZoneAnimation,
    }),
    [registerZone, unregisterZone, setZoneElement, registerZoneAnimation, unregisterZoneAnimation]
  );
  const zoneTimelineValue = useMemo(() => ({ store: timelineStoreRef.current }), []);

  return {
    zoneRegistryRef,
    zoneAnimationsRef,
    zoneStatesRef,
    timelineStoreRef,
    zoneRuntimeVersion,
    getZoneIdForScene,
    getZoneDistance,
    syncZoneState,
    recomputeZoneSequence,
    zoneRuntimeValue,
    zoneTimelineValue,
  };
}
