import { render } from '@testing-library/react';
import { Scene } from '../Scene/Scene';
import {
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  type ScrollSceneRenderSnapshot,
  type ScrollSceneSnapshotStore,
} from './ScrollSceneSlot';
import { ScrollSceneStack } from './ScrollSceneStack';

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
});
