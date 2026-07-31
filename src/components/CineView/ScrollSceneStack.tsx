import React from 'react';
import type { SceneAuthoringCompatProps } from './directScrollHelpers';
import { isSceneElement } from './directScrollHelpers';
import type { GroupedCallbacks } from './regroupCallbacks';
import { ScrollSceneSlot, type ScrollSceneSnapshotStore } from './ScrollSceneSlot';

interface ScrollSceneStackProps {
  childrenArray: React.ReactNode[];
  store: ScrollSceneSnapshotStore;
  setWrapperRef: (sceneIndex: number, node: HTMLDivElement | null) => void;
  scrollCallbacks?: GroupedCallbacks['scroll'];
}

export function ScrollSceneStack({
  childrenArray,
  store,
  setWrapperRef,
  scrollCallbacks,
}: ScrollSceneStackProps): JSX.Element {
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
            store={store}
            sceneIndex={currentSceneIndex}
            setWrapperRef={setWrapperRef}
            scrollCallbacks={scrollCallbacks}
          />
        );
      })}
    </>
  );
}
