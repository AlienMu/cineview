import {
  areScrollSceneRenderSnapshotsEqual,
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  type ScrollSceneRenderSnapshot,
} from './ScrollSceneSlot';

function createSnapshot(
  overrides: Partial<ScrollSceneRenderSnapshot> = {}
): ScrollSceneRenderSnapshot {
  return {
    ...EMPTY_SCROLL_SCENE_SNAPSHOT,
    firstSceneEnterGateKnown: true,
    ...overrides,
  };
}

describe('ScrollSceneSlot snapshot equality', () => {
  it('invalidates the snapshot when first-scene gate publication becomes known', () => {
    const unknown = createSnapshot({ firstSceneEnterGateKnown: false });
    const known = createSnapshot({ firstSceneEnterGateKnown: true });

    expect(areScrollSceneRenderSnapshotsEqual(unknown, known)).toBe(false);
  });

  it('keeps otherwise identical first-scene gate snapshots referentially reusable', () => {
    const previous = createSnapshot({
      firstSceneEnterActive: true,
      firstSceneEnterReady: false,
    });
    const next = createSnapshot({
      firstSceneEnterActive: true,
      firstSceneEnterReady: false,
    });

    expect(areScrollSceneRenderSnapshotsEqual(previous, next)).toBe(true);
  });

  it('ignores continuous timeline and viewport changes in the React snapshot lane', () => {
    const previous = createSnapshot({
      isCurrent: true,
      visualViewportOffset: 100,
      sceneTimelineState: {
        phase: 'hold',
        enterProgress: 1,
        exitProgress: 0,
        sceneProgress: 0.1,
        rangeStart: 0,
        rangeEnd: 1000,
        rangeLength: 1000,
        enterLength: 0,
        exitLength: 0,
      },
    });
    const next = createSnapshot({
      ...previous,
      visualViewportOffset: 200,
      sceneTimelineState: {
        ...previous.sceneTimelineState!,
        sceneProgress: 0.2,
      },
    });

    expect(areScrollSceneRenderSnapshotsEqual(previous, next)).toBe(true);
  });

  it('still invalidates when the timeline phase changes', () => {
    const previous = createSnapshot({
      sceneTimelineState: {
        phase: 'enter',
        enterProgress: 0.9,
        exitProgress: 0,
        sceneProgress: 0.2,
        rangeStart: 0,
        rangeEnd: 1000,
        rangeLength: 1000,
        enterLength: 100,
        exitLength: 0,
      },
    });
    const next = createSnapshot({
      ...previous,
      sceneTimelineState: { ...previous.sceneTimelineState!, phase: 'hold' },
    });

    expect(areScrollSceneRenderSnapshotsEqual(previous, next)).toBe(false);
  });
});
