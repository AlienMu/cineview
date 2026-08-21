import { act, render } from '@testing-library/react';
import { Scene } from '../Scene/Scene';
import {
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  areScrollSceneRenderSnapshotsEqual,
  type ScrollSceneRenderSnapshot,
  type ScrollSceneSnapshotStore,
} from './ScrollSceneSlot';
import { ScrollSceneStack } from './ScrollSceneStack';
import { createScrollSceneFrameStore, type ScrollSceneFrame } from './scrollSceneFrameStore';
import type { SceneScrollTimelineState } from '../Scene/sceneScrollRuntime';
import type { SceneAuthoringCompatProps } from './directScrollHelpers';

function timelineState(sceneProgress: number) {
  return {
    phase: 'hold' as const,
    enterProgress: 1,
    exitProgress: 0,
    sceneProgress,
    rangeStart: 0,
    rangeEnd: 1000,
    rangeLength: 1000,
    enterLength: 0,
    exitLength: 0,
  };
}

const zoneSequence = { budgets: {}, totalDurationMs: 1000, totalBudgetPx: 1000 };

function zoneState(progressPx: number): SceneScrollTimelineState {
  return {
    zoneId: 'zone-0',
    sceneIndex: 0,
    progressPx,
    totalBudgetPx: 1000,
    active: progressPx > 0 && progressPx < 1000,
    direction: 'forward',
    approach: 'inside',
    sequence: zoneSequence,
  };
}

describe('ScrollSceneStack subscriptions', () => {
  it('leaves the stack unsubscribed and lets each scene subscribe by index', () => {
    const snapshots: ScrollSceneRenderSnapshot[] = [
      { ...EMPTY_SCROLL_SCENE_SNAPSHOT, sceneCount: 2 },
      { ...EMPTY_SCROLL_SCENE_SNAPSHOT, sceneCount: 2 },
    ];
    const store: ScrollSceneSnapshotStore = {
      getSnapshot: () => snapshots,
      setSnapshot: jest.fn(),
      getKeySnapshot: (sceneIndex) => snapshots[sceneIndex],
      subscribeKey: jest.fn(() => () => undefined),
    };

    render(
      <ScrollSceneStack
        childrenArray={[<Scene key="a">A</Scene>, <Scene key="b">B</Scene>]}
        store={store}
        setWrapperRef={jest.fn()}
      />
    );

    expect(store.subscribeKey).toHaveBeenCalledTimes(2);
    expect(store.subscribeKey).toHaveBeenNthCalledWith(1, 0, expect.any(Function));
    expect(store.subscribeKey).toHaveBeenNthCalledWith(2, 1, expect.any(Function));
  });

  it('does not rerender an active Scene for a continuous scroll frame', () => {
    let sceneRenders = 0;
    const CountingScene = Object.assign(
      function CountingScene({ children }: React.PropsWithChildren): JSX.Element {
        sceneRenders += 1;
        return <section>{children}</section>;
      },
      { cineViewScene: true as const }
    );

    const snapshot: ScrollSceneRenderSnapshot = {
      ...EMPTY_SCROLL_SCENE_SNAPSHOT,
      sceneCount: 1,
      isCurrent: true,
      viewportWidth: 100,
      viewportHeight: 100,
      sceneLayout: {
        sceneStart: 0,
        sceneEnd: 1000,
        visualSpan: 1000,
        flowSpan: 1000,
        timelineDistancePx: 1000,
        centerLockOffset: 450,
        segmentStart: 0,
        segmentEnd: 1000,
        enterLength: 0,
        exitLength: 0,
        stackMode: 'replace',
      },
      sceneTimelineState: timelineState(0.1),
      visualViewportOffset: 100,
    };
    let current = [snapshot];
    const listeners = new Set<() => void>();
    const store: ScrollSceneSnapshotStore = {
      getSnapshot: () => current,
      setSnapshot: (next) => {
        const nextSnapshot = (next as ScrollSceneRenderSnapshot[])[0];
        if (areScrollSceneRenderSnapshotsEqual(current[0], nextSnapshot)) return;
        current = [nextSnapshot];
        listeners.forEach((listener) => listener());
      },
      getKeySnapshot: (sceneIndex) => current[sceneIndex],
      subscribeKey: (_sceneIndex, listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };

    render(
      <ScrollSceneStack
        childrenArray={[<CountingScene key="active">probe</CountingScene>]}
        store={store}
        setWrapperRef={jest.fn()}
      />
    );
    const rendersAtRest = sceneRenders;
    expect(rendersAtRest).toBeGreaterThan(0);

    act(() => {
      store.setSnapshot([
        {
          ...snapshot,
          sceneTimelineState: timelineState(0.2),
          visualViewportOffset: 200,
        },
      ]);
    });

    expect(sceneRenders).toBe(rendersAtRest);
  });

  it('updates takeover debug attributes from the frame lane without rerendering the Scene', () => {
    let sceneRenders = 0;
    const CountingScene = Object.assign(
      function CountingScene({
        children,
      }: React.PropsWithChildren<SceneAuthoringCompatProps>): JSX.Element {
        sceneRenders += 1;
        return <section>{children}</section>;
      },
      { cineViewScene: true as const }
    );
    const child = (
      <CountingScene key="active" scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}>
        probe
      </CountingScene>
    );
    const initialSnapshot: ScrollSceneRenderSnapshot = {
      ...EMPTY_SCROLL_SCENE_SNAPSHOT,
      sceneCount: 1,
      isCurrent: true,
      viewportWidth: 100,
      viewportHeight: 100,
      sceneLayout: {
        sceneStart: 0,
        sceneEnd: 1000,
        visualSpan: 1000,
        flowSpan: 1000,
        timelineDistancePx: 1000,
        centerLockOffset: 450,
        segmentStart: 0,
        segmentEnd: 1000,
        enterLength: 0,
        exitLength: 0,
        stackMode: 'replace',
      },
      sceneZoneState: zoneState(10),
      sceneTimelineState: timelineState(0.1),
      visualViewportOffset: 100,
      exposeTakeoverDebugData: true,
    };
    let current = [initialSnapshot];
    const listeners = new Set<() => void>();
    const store: ScrollSceneSnapshotStore = {
      getSnapshot: () => current,
      setSnapshot: (next) => {
        const nextSnapshot = (next as ScrollSceneRenderSnapshot[])[0];
        if (areScrollSceneRenderSnapshotsEqual(current[0], nextSnapshot)) return;
        current = [nextSnapshot];
        listeners.forEach((listener) => listener());
      },
      getKeySnapshot: (sceneIndex) => current[sceneIndex],
      subscribeKey: (_sceneIndex, listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const frameStore = createScrollSceneFrameStore();
    const unsubscribeSpy = jest.fn();
    const subscribeKey = frameStore.subscribeKey.bind(frameStore);
    jest.spyOn(frameStore, 'subscribeKey').mockImplementation((sceneIndex, listener) => {
      const unsubscribe = subscribeKey(sceneIndex, listener);
      return () => {
        unsubscribeSpy();
        unsubscribe();
      };
    });
    const initialFrame = {
      timelineState: timelineState(0.11),
      progress: 0.11,
      visualViewportOffset: 110,
      isCurrent: true,
      isBackdropActive: false,
      isScrolling: true,
      scrollDirection: 'forward' as const,
      zoneProgressPx: 11,
    } as ScrollSceneFrame;
    frameStore.setKeySnapshot(0, initialFrame);

    const view = render(
      <ScrollSceneStack
        childrenArray={[child]}
        store={store}
        frameStore={frameStore}
        setWrapperRef={jest.fn()}
      />
    );
    const shell = view.container.querySelector('[data-cineview-takeover-shell="0"]') as HTMLElement;
    const rendersAtRest = sceneRenders;
    expect(shell).toHaveAttribute('data-cineview-takeover-progress-px', '11');
    expect(shell).toHaveAttribute('data-cineview-takeover-viewport-offset', '110');

    act(() => {
      store.setSnapshot([
        {
          ...initialSnapshot,
          sceneZoneState: zoneState(20),
          sceneTimelineState: timelineState(0.2),
          visualViewportOffset: 200,
        },
      ]);
      frameStore.setKeySnapshot(0, {
        ...initialFrame,
        timelineState: timelineState(0.2),
        progress: 0.2,
        visualViewportOffset: 200,
        zoneProgressPx: 20,
      });
    });

    expect(shell).toHaveAttribute('data-cineview-takeover-progress-px', '20');
    expect(shell).toHaveAttribute('data-cineview-takeover-viewport-offset', '200');
    expect(sceneRenders).toBe(rendersAtRest);

    // A discrete snapshot update may re-render the Slot while its continuous
    // frame lane is already ahead. The debug attributes must remain owned by
    // the frame lane rather than being overwritten by this stale render value.
    act(() => {
      store.setSnapshot([
        {
          ...initialSnapshot,
          isScrolling: true,
          sceneZoneState: zoneState(15),
          sceneTimelineState: timelineState(0.15),
          visualViewportOffset: 150,
        },
      ]);
    });
    expect(shell).toHaveAttribute('data-cineview-takeover-progress-px', '20');
    expect(shell).toHaveAttribute('data-cineview-takeover-viewport-offset', '200');

    act(() => {
      store.setSnapshot([{ ...initialSnapshot, exposeTakeoverDebugData: false }]);
    });
    expect(shell).not.toHaveAttribute('data-cineview-takeover-progress-px');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-viewport-offset');
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe to frames or expose debug attributes when debug is disabled', () => {
    const CountingScene = Object.assign(
      function CountingScene({
        children,
      }: React.PropsWithChildren<SceneAuthoringCompatProps>): JSX.Element {
        return <section>{children}</section>;
      },
      { cineViewScene: true as const }
    );
    const frameStore = createScrollSceneFrameStore();
    const subscribeSpy = jest.spyOn(frameStore, 'subscribeKey');
    const snapshot: ScrollSceneRenderSnapshot = {
      ...EMPTY_SCROLL_SCENE_SNAPSHOT,
      sceneCount: 1,
      sceneLayout: {
        sceneStart: 0,
        sceneEnd: 1000,
        visualSpan: 1000,
        flowSpan: 1000,
        timelineDistancePx: 1000,
        centerLockOffset: 450,
        segmentStart: 0,
        segmentEnd: 1000,
        enterLength: 0,
        exitLength: 0,
        stackMode: 'replace',
      },
      exposeTakeoverDebugData: false,
    };
    const store: ScrollSceneSnapshotStore = {
      getSnapshot: () => [snapshot],
      setSnapshot: jest.fn(),
      getKeySnapshot: () => snapshot,
      subscribeKey: jest.fn(() => () => undefined),
    };
    const { container } = render(
      <ScrollSceneStack
        childrenArray={[
          <CountingScene key="active" scroll={{ zoneId: 'zone-0', trigger: 'center-lock' }}>
            probe
          </CountingScene>,
        ]}
        store={store}
        frameStore={frameStore}
        setWrapperRef={jest.fn()}
      />
    );
    const shell = container.querySelector('[data-cineview-takeover-shell="0"]') as HTMLElement;
    expect(subscribeSpy).not.toHaveBeenCalled();
    expect(shell).not.toHaveAttribute('data-cineview-takeover-progress-px');
    expect(shell).not.toHaveAttribute('data-cineview-takeover-viewport-offset');
  });
});
