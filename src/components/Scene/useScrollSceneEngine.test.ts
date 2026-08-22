import { act, renderHook } from '@testing-library/react';
import type { AnimationControls } from 'framer-motion';
import type { ScrollTimelineState } from '../../types';
import { createScrollSceneFrameStore } from '../runtime/scrollSceneFrameStore';
import { useScrollSceneEngine } from './useScrollSceneEngine';

function timeline(enterProgress: number): ScrollTimelineState {
  return {
    phase: 'enter',
    enterProgress,
    exitProgress: 0,
    sceneProgress: enterProgress,
    rangeStart: 0,
    rangeEnd: 1000,
    rangeLength: 1000,
    enterLength: 100,
    exitLength: 0,
  };
}

describe('useScrollSceneEngine frame lane', () => {
  it('updates visual controls per frame but publishes SceneState only at phase changes', () => {
    const controls = { set: jest.fn() } as unknown as AnimationControls;
    const setSceneState = jest.fn();
    const frameStore = createScrollSceneFrameStore();
    frameStore.setSnapshot([
      {
        timelineState: timeline(0.1),
        progress: 0.1,
        zoneProgressPx: null,
        visualViewportOffset: 10,
        isCurrent: false,
        isBackdropActive: false,
        isScrolling: true,
        scrollDirection: 'forward',
      },
    ]);

    renderHook(() =>
      useScrollSceneEngine({
        slideMode: 'scroll',
        isActive: false,
        sceneOffset: 1,
        sceneStackMode: 'replace',
        controls,
        enterVariant: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
        } as never,
        exitVariant: null,
        globalIsScrolling: true,
        globalScrollProgress: 0,
        globalScrollDirection: 'forward',
        globalScrollTransitionSnapshot: null,
        globalScrollBackdropActive: false,
        globalScrollTimelineState: timeline(0.1),
        scrollFrameStore: frameStore,
        scrollFrameSceneIndex: 0,
        setSceneState,
      })
    );

    const stateCallsAfterMount = setSceneState.mock.calls.length;
    expect(stateCallsAfterMount).toBe(1);

    act(() => {
      frameStore.setSnapshot([
        {
          timelineState: timeline(0.2),
          progress: 0.2,
          zoneProgressPx: null,
          visualViewportOffset: 20,
          isCurrent: false,
          isBackdropActive: false,
          isScrolling: true,
          scrollDirection: 'forward',
        },
      ]);
    });

    expect(controls.set).toHaveBeenCalledTimes(2);
    expect(setSceneState).toHaveBeenCalledTimes(stateCallsAfterMount);
  });
});
