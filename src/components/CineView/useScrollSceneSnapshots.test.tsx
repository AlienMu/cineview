import React from 'react';
import { act, renderHook } from '@testing-library/react';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import { createKeyedScrollExternalStore } from './scrollExternalStore';
import type { SceneAuthoringCompatProps, SceneLayoutInfo } from './directScrollHelpers';
import { useScrollSceneSnapshots } from './useScrollSceneSnapshots';

function createLayout(sceneIndex: number): SceneLayoutInfo {
  const sceneStart = sceneIndex * 100;
  return {
    sceneStart,
    sceneEnd: sceneStart + 100,
    visualSpan: 100,
    flowSpan: 100,
    timelineDistancePx: 0,
    centerLockOffset: sceneStart,
    segmentStart: sceneStart,
    segmentEnd: sceneStart,
    enterLength: 0,
    exitLength: 0,
    stackMode: 'replace',
  };
}

function createZoneState(
  zoneId: string,
  sceneIndex: number,
  progressPx: number
): SceneScrollTimelineState {
  return {
    zoneId,
    sceneIndex,
    progressPx,
    totalBudgetPx: 100,
    active: progressPx > 0 && progressPx < 100,
    direction: progressPx > 0 ? 'forward' : null,
    approach: 'near',
    sequence: { budgets: {}, totalDurationMs: 100, totalBudgetPx: 100 },
  };
}

function createTakeoverScene(
  sceneId: string,
  width: number | string,
  height: number | string
): React.ReactElement<SceneAuthoringCompatProps> {
  const scene = React.createElement('section', {
    key: sceneId,
  }) as React.ReactElement<SceneAuthoringCompatProps>;
  return React.cloneElement(scene, {
    sceneId,
    layout: { width, height },
    scroll: { zoneId: sceneId, trigger: 'center-lock' },
    children: null,
  });
}

describe('useScrollSceneSnapshots', () => {
  it('reads only dirty scenes during a 1000-scene scroll frame', () => {
    const authoredScenes = Array.from({ length: 1000 }, (_, sceneIndex) =>
      React.createElement('section', { key: sceneIndex })
    ) as React.ReactElement<SceneAuthoringCompatProps>[];
    let sceneReads = 0;
    const scenes = new Proxy(authoredScenes, {
      get(target, property, receiver) {
        if (typeof property === 'string' && /^\d+$/.test(property)) sceneReads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    const sceneLayoutsRef = {
      current: Array.from({ length: 1000 }, (_, index) => createLayout(index)),
    };
    const timelineStoreRef = {
      current: createKeyedScrollExternalStore<
        Record<string, SceneScrollTimelineState>,
        string,
        SceneScrollTimelineState
      >({}, (snapshot, zoneId) => snapshot[zoneId]),
    };
    const scrollOffsetRef = { current: 99_900 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };

    const { result } = renderHook(() =>
      useScrollSceneSnapshots({
        scenes,
        sceneLayoutsRef,
        timelineStoreRef,
        viewportSizeRef: { current: { width: 100, height: 100 } },
        activeSceneIndexRef: { current: 999 },
        scrollDirectionRef: { current: 'forward' },
        isScrollingStateRef: { current: true },
        direction: 'y',
        sceneSizing: 'content',
        firstSceneEnterActive: false,
        firstSceneEnterReady: true,
        exposeTakeoverDebugData: false,
        scrollOffsetRef,
        updateSceneRenderSnapshotsRef,
      })
    );
    const firstSceneListener = jest.fn();
    const lastSceneListener = jest.fn();
    const lastFrameListener = jest.fn();
    result.current.store.subscribeKey(0, firstSceneListener);
    result.current.store.subscribeKey(999, lastSceneListener);
    result.current.frameStore.subscribeKey(999, lastFrameListener);
    sceneReads = 0;

    act(() => {
      result.current.updateSceneRenderSnapshots(99_901);
    });

    expect(sceneReads).toBeLessThanOrEqual(3);
    expect(firstSceneListener).not.toHaveBeenCalled();
    expect(lastSceneListener).not.toHaveBeenCalled();
    expect(lastFrameListener).toHaveBeenCalledTimes(1);
  });

  it('publishes zone changes and removals, then catches an inactive scene up on activation', () => {
    const scenes = Array.from({ length: 4 }, (_, sceneIndex) =>
      React.createElement('section', { key: sceneIndex })
    ) as React.ReactElement<SceneAuthoringCompatProps>[];
    const sceneLayoutsRef = { current: scenes.map((_scene, index) => createLayout(index)) };
    const timelineStore = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({}, (snapshot, zoneId) => snapshot[zoneId]);
    const activeSceneIndexRef = { current: 0 };
    const scrollOffsetRef = { current: 0 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };
    const { result } = renderHook(() =>
      useScrollSceneSnapshots({
        scenes,
        sceneLayoutsRef,
        timelineStoreRef: { current: timelineStore },
        viewportSizeRef: { current: { width: 100, height: 100 } },
        activeSceneIndexRef,
        scrollDirectionRef: { current: 'forward' },
        isScrollingStateRef: { current: true },
        direction: 'y',
        sceneSizing: 'content',
        firstSceneEnterActive: false,
        firstSceneEnterReady: true,
        exposeTakeoverDebugData: false,
        scrollOffsetRef,
        updateSceneRenderSnapshotsRef,
      })
    );
    const sceneListener = jest.fn();
    const frameListener = jest.fn();
    result.current.store.subscribeKey(3, sceneListener);
    result.current.frameStore.subscribeKey(3, frameListener);
    const zoneState = createZoneState('zone-3', 3, 25);

    act(() => {
      timelineStore.setSnapshot({ 'zone-3': zoneState });
      result.current.updateSceneRenderSnapshots(0);
    });
    expect(result.current.store.getKeySnapshot(3)?.sceneZoneState).toBe(zoneState);
    expect(result.current.frameStore.getKeySnapshot(3)?.zoneProgressPx).toBe(25);
    expect(sceneListener).toHaveBeenCalledTimes(1);

    sceneListener.mockClear();
    frameListener.mockClear();
    const progressedZoneState = { ...zoneState, progressPx: 50 };
    act(() => {
      timelineStore.setSnapshot({ 'zone-3': progressedZoneState });
      result.current.updateSceneRenderSnapshots(0);
    });
    expect(result.current.frameStore.getKeySnapshot(3)?.zoneProgressPx).toBe(50);
    expect(frameListener).toHaveBeenCalledTimes(1);
    expect(sceneListener).not.toHaveBeenCalled();

    sceneListener.mockClear();
    act(() => {
      timelineStore.setSnapshot({});
      result.current.updateSceneRenderSnapshots(0);
    });
    expect(result.current.store.getKeySnapshot(3)?.sceneZoneState).toBeNull();
    expect(result.current.frameStore.getKeySnapshot(3)?.zoneProgressPx).toBeNull();
    expect(sceneListener).toHaveBeenCalledTimes(1);

    sceneListener.mockClear();
    activeSceneIndexRef.current = 3;
    scrollOffsetRef.current = 300;
    act(() => result.current.updateSceneRenderSnapshots(300));
    expect(result.current.store.getKeySnapshot(3)).toEqual(
      expect.objectContaining({ isCurrent: true, activeSceneIndex: 3, visualViewportOffset: 300 })
    );
    expect(sceneListener).toHaveBeenCalledTimes(1);
  });

  it('refreshes backdrop, first-scene gate, config, and layout owners without stale snapshots', () => {
    const scenes = Array.from({ length: 4 }, (_, sceneIndex) =>
      React.createElement('section', { key: sceneIndex })
    ) as React.ReactElement<SceneAuthoringCompatProps>[];
    const sceneLayoutsRef = { current: scenes.map((_scene, index) => createLayout(index)) };
    sceneLayoutsRef.current[3] = { ...sceneLayoutsRef.current[3], stackMode: 'cover' };
    const timelineStore = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({}, (snapshot, zoneId) => snapshot[zoneId]);
    const activeSceneIndexRef = { current: 0 };
    const scrollOffsetRef = { current: 0 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };
    const { result, rerender } = renderHook(
      ({ firstSceneEnterActive, firstSceneEnterReady, sceneSizing }) =>
        useScrollSceneSnapshots({
          scenes,
          sceneLayoutsRef,
          timelineStoreRef: { current: timelineStore },
          viewportSizeRef: { current: { width: 100, height: 100 } },
          activeSceneIndexRef,
          scrollDirectionRef: { current: 'forward' },
          isScrollingStateRef: { current: true },
          direction: 'y',
          sceneSizing,
          firstSceneEnterActive,
          firstSceneEnterReady,
          exposeTakeoverDebugData: false,
          scrollOffsetRef,
          updateSceneRenderSnapshotsRef,
        }),
      {
        initialProps: {
          firstSceneEnterActive: true,
          firstSceneEnterReady: false,
          sceneSizing: 'content' as 'content' | 'screen',
        },
      }
    );
    const firstSceneListener = jest.fn();
    const farSceneListener = jest.fn();
    result.current.store.subscribeKey(0, firstSceneListener);
    result.current.store.subscribeKey(1, farSceneListener);

    activeSceneIndexRef.current = 3;
    scrollOffsetRef.current = 300;
    act(() => result.current.updateSceneRenderSnapshots(300));
    expect(result.current.store.getKeySnapshot(2)?.isBackdropActive).toBe(true);

    firstSceneListener.mockClear();
    farSceneListener.mockClear();
    rerender({
      firstSceneEnterActive: false,
      firstSceneEnterReady: true,
      sceneSizing: 'content',
    });
    expect(result.current.store.getKeySnapshot(0)).toEqual(
      expect.objectContaining({ firstSceneEnterActive: false, firstSceneEnterReady: true })
    );
    expect(firstSceneListener).toHaveBeenCalledTimes(1);
    expect(farSceneListener).not.toHaveBeenCalled();

    rerender({
      firstSceneEnterActive: false,
      firstSceneEnterReady: true,
      sceneSizing: 'screen',
    });
    expect(result.current.store.getKeySnapshot(1)?.sceneSizing).toBe('screen');
    expect(farSceneListener).toHaveBeenCalledTimes(1);

    farSceneListener.mockClear();
    sceneLayoutsRef.current = sceneLayoutsRef.current.map((layout, index) =>
      index === 1 ? { ...layout, sceneEnd: layout.sceneEnd + 10 } : layout
    );
    act(() => result.current.updateSceneRenderSnapshots(300));
    expect(result.current.store.getKeySnapshot(1)?.sceneLayout).toBe(sceneLayoutsRef.current[1]);
    expect(farSceneListener).toHaveBeenCalledTimes(1);
  });

  it('fully refreshes reordered scenes without stale or unnecessary snapshot identities', () => {
    const initialScenes = [
      createTakeoverScene('scene-a', '100vw', '110vh'),
      createTakeoverScene('scene-b', '100vw', '120vh'),
      createTakeoverScene('scene-c', '100vw', '130vh'),
      createTakeoverScene('scene-d', '100vw', '140vh'),
      createTakeoverScene('scene-e', '100vw', '150vh'),
    ];
    const sceneLayoutsRef = {
      current: initialScenes.map((_scene, index) => createLayout(index)),
    };
    const timelineStoreRef = {
      current: createKeyedScrollExternalStore<
        Record<string, SceneScrollTimelineState>,
        string,
        SceneScrollTimelineState
      >({}, (snapshot, zoneId) => snapshot[zoneId]),
    };
    const scrollOffsetRef = { current: 0 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };
    const { result, rerender } = renderHook(
      ({ scenes }) =>
        useScrollSceneSnapshots({
          scenes,
          sceneLayoutsRef,
          timelineStoreRef,
          viewportSizeRef: { current: { width: 100, height: 100 } },
          activeSceneIndexRef: { current: 0 },
          scrollDirectionRef: { current: 'forward' },
          isScrollingStateRef: { current: true },
          direction: 'y',
          sceneSizing: 'content',
          firstSceneEnterActive: false,
          firstSceneEnterReady: true,
          exposeTakeoverDebugData: false,
          scrollOffsetRef,
          updateSceneRenderSnapshotsRef,
        }),
      { initialProps: { scenes: initialScenes } }
    );
    const initialSnapshots = result.current.store.getSnapshot();
    const farSceneListener = jest.fn();
    const publicationOrder: string[] = [];
    result.current.store.subscribeKey(4, () => {
      publicationOrder.push('render');
      farSceneListener();
    });
    const observedFrames: Array<ReturnType<typeof result.current.frameStore.getKeySnapshot>> = [];
    result.current.frameStore.subscribeKey(4, () => {
      publicationOrder.push('frame');
      observedFrames.push(result.current.frameStore.getKeySnapshot(4));
    });

    const reorderedScenes = [
      initialScenes[0],
      initialScenes[1],
      initialScenes[2],
      initialScenes[4],
      initialScenes[3],
    ];
    rerender({ scenes: reorderedScenes });

    const reorderedSnapshots = result.current.store.getSnapshot();
    expect(reorderedSnapshots.map((snapshot) => snapshot?.takeoverSceneSpan)).toEqual([
      110, 120, 130, 150, 140,
    ]);
    expect(reorderedSnapshots[0]).toBe(initialSnapshots[0]);
    expect(reorderedSnapshots[1]).toBe(initialSnapshots[1]);
    expect(reorderedSnapshots[2]).toBe(initialSnapshots[2]);
    expect(reorderedSnapshots[3]).not.toBe(initialSnapshots[3]);
    expect(reorderedSnapshots[4]).not.toBe(initialSnapshots[4]);
    expect(farSceneListener).toHaveBeenCalledTimes(1);
    expect(observedFrames).toHaveLength(1);
    expect(observedFrames).not.toContain(undefined);
    expect(publicationOrder).toEqual(['render', 'frame']);
  });

  it('truncates shortened scene snapshots and clears the dense zone-state tail', () => {
    const scenes = Array.from({ length: 4 }, (_, sceneIndex) =>
      React.createElement('section', { key: sceneIndex })
    ) as React.ReactElement<SceneAuthoringCompatProps>[];
    const sceneLayoutsRef = { current: scenes.map((_scene, index) => createLayout(index)) };
    const tailZoneState = createZoneState('tail-zone', 3, 25);
    const timelineStore = createKeyedScrollExternalStore<
      Record<string, SceneScrollTimelineState>,
      string,
      SceneScrollTimelineState
    >({ 'tail-zone': tailZoneState }, (snapshot, zoneId) => snapshot[zoneId]);
    const viewportSizeRef = { current: { width: 100, height: 100 } };
    const scrollOffsetRef = { current: 0 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };
    const { result, rerender } = renderHook(
      ({ currentScenes }) =>
        useScrollSceneSnapshots({
          scenes: currentScenes,
          sceneLayoutsRef,
          timelineStoreRef: { current: timelineStore },
          viewportSizeRef,
          activeSceneIndexRef: { current: 0 },
          scrollDirectionRef: { current: 'forward' },
          isScrollingStateRef: { current: true },
          direction: 'y',
          sceneSizing: 'content',
          firstSceneEnterActive: false,
          firstSceneEnterReady: true,
          exposeTakeoverDebugData: false,
          scrollOffsetRef,
          updateSceneRenderSnapshotsRef,
        }),
      { initialProps: { currentScenes: scenes } }
    );
    expect(result.current.store.getKeySnapshot(3)?.sceneZoneState).toBe(tailZoneState);

    act(() => {
      timelineStore.setSnapshot({});
      viewportSizeRef.current = { width: 101, height: 100 };
      result.current.updateSceneRenderSnapshots(0);
    });
    expect(result.current.store.getKeySnapshot(3)?.sceneZoneState).toBeNull();

    rerender({ currentScenes: scenes.slice(0, 2) });
    expect(result.current.store.getSnapshot()).toHaveLength(2);
    expect(result.current.store.getKeySnapshot(2)).toBeUndefined();
    expect(result.current.store.getKeySnapshot(3)).toBeUndefined();
  });

  it('fully refreshes every snapshot when the direction, viewport, debug, or config tuple changes', () => {
    const scenes = Array.from({ length: 5 }, (_, sceneIndex) =>
      createTakeoverScene(`scene-${sceneIndex}`, '50vw', '50vh')
    );
    const sceneLayoutsRef = { current: scenes.map((_scene, index) => createLayout(index)) };
    const timelineStoreRef = {
      current: createKeyedScrollExternalStore<
        Record<string, SceneScrollTimelineState>,
        string,
        SceneScrollTimelineState
      >({}, (snapshot, zoneId) => snapshot[zoneId]),
    };
    const viewportSizeRef = { current: { width: 100, height: 200 } };
    const scrollOffsetRef = { current: 0 };
    const updateSceneRenderSnapshotsRef = { current: (_nativeOffset: number) => undefined };
    const { result, rerender } = renderHook(
      ({ direction, sceneSizing, exposeTakeoverDebugData }) =>
        useScrollSceneSnapshots({
          scenes,
          sceneLayoutsRef,
          timelineStoreRef,
          viewportSizeRef,
          activeSceneIndexRef: { current: 0 },
          scrollDirectionRef: { current: 'forward' },
          isScrollingStateRef: { current: true },
          direction,
          sceneSizing,
          firstSceneEnterActive: false,
          firstSceneEnterReady: true,
          exposeTakeoverDebugData,
          scrollOffsetRef,
          updateSceneRenderSnapshotsRef,
        }),
      {
        initialProps: {
          direction: 'y' as 'x' | 'y',
          sceneSizing: 'content' as 'content' | 'screen',
          exposeTakeoverDebugData: false,
        },
      }
    );
    let previousSnapshots = result.current.store.getSnapshot();
    expect(previousSnapshots[4]?.takeoverSceneSpan).toBe(100);

    viewportSizeRef.current = { width: 120, height: 240 };
    act(() => result.current.updateSceneRenderSnapshots(0));
    let nextSnapshots = result.current.store.getSnapshot();
    nextSnapshots.forEach((snapshot, sceneIndex) => {
      expect(snapshot).not.toBe(previousSnapshots[sceneIndex]);
      expect(snapshot).toEqual(
        expect.objectContaining({ viewportWidth: 120, viewportHeight: 240 })
      );
    });
    expect(nextSnapshots[4]?.takeoverSceneSpan).toBe(120);
    previousSnapshots = nextSnapshots;

    rerender({
      direction: 'x',
      sceneSizing: 'content',
      exposeTakeoverDebugData: false,
    });
    nextSnapshots = result.current.store.getSnapshot();
    nextSnapshots.forEach((snapshot, sceneIndex) => {
      expect(snapshot).not.toBe(previousSnapshots[sceneIndex]);
      expect(snapshot?.direction).toBe('x');
    });
    expect(nextSnapshots[4]?.takeoverSceneSpan).toBe(60);
    previousSnapshots = nextSnapshots;

    rerender({
      direction: 'x',
      sceneSizing: 'content',
      exposeTakeoverDebugData: true,
    });
    nextSnapshots = result.current.store.getSnapshot();
    nextSnapshots.forEach((snapshot, sceneIndex) => {
      expect(snapshot).not.toBe(previousSnapshots[sceneIndex]);
      expect(snapshot?.exposeTakeoverDebugData).toBe(true);
    });
    previousSnapshots = nextSnapshots;

    rerender({
      direction: 'x',
      sceneSizing: 'screen',
      exposeTakeoverDebugData: true,
    });
    nextSnapshots = result.current.store.getSnapshot();
    nextSnapshots.forEach((snapshot, sceneIndex) => {
      expect(snapshot).not.toBe(previousSnapshots[sceneIndex]);
      expect(snapshot?.sceneSizing).toBe('screen');
    });
  });
});
