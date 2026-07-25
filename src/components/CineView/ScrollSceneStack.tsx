import React, { useSyncExternalStore } from 'react';
import type { SceneAuthoringCompatProps } from './directScrollHelpers';
import { isSceneElement } from './directScrollHelpers';
import type { GroupedCallbacks } from './regroupCallbacks';
import type { ScrollExternalStore } from './scrollExternalStore';
import {
  EMPTY_SCROLL_SCENE_SNAPSHOT,
  ScrollSceneSlot,
  type ScrollSceneRenderSnapshot,
} from './ScrollSceneSlot';

export type ScrollSceneSnapshotMap = ReadonlyMap<number, ScrollSceneRenderSnapshot>;

interface ScrollSceneStackProps {
  childrenArray: React.ReactNode[];
  store: ScrollExternalStore<ScrollSceneSnapshotMap>;
  setWrapperRef: (sceneIndex: number, node: HTMLDivElement | null) => void;
  scrollCallbacks?: GroupedCallbacks['scroll'];
}

export function ScrollSceneStack({
  childrenArray,
  store,
  setWrapperRef,
  scrollCallbacks,
}: ScrollSceneStackProps): JSX.Element {
  const snapshots = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  let sceneIndex = 0;

  return (
    <>
      {childrenArray.map((child, childIndex) => {
        if (!isSceneElement(child)) {
          return <React.Fragment key={`flow-${childIndex}`}>{child}</React.Fragment>;
        }

        const currentSceneIndex = sceneIndex++;
        return (
          <ScrollSceneSlot
            key={child.key ?? `scene-${currentSceneIndex}`}
            child={child as React.ReactElement<SceneAuthoringCompatProps>}
            snapshot={snapshots.get(currentSceneIndex) ?? EMPTY_SCROLL_SCENE_SNAPSHOT}
            sceneIndex={currentSceneIndex}
            setWrapperRef={setWrapperRef}
            scrollCallbacks={scrollCallbacks}
          />
        );
      })}
    </>
  );
}
