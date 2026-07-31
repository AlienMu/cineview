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
});
