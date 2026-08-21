import type { ScrollTimelineState } from '../../types';
import type { ScrollInputDirection } from './directScrollHelpers';

/**
 * Continuous values for one scroll Scene. This channel is deliberately
 * separate from the React render snapshot: the native scroll controller is the
 * only writer, while Scene consumers subscribe imperatively (MotionValue or
 * direct DOM updates) and do not schedule a React render for every pixel.
 */
export interface ScrollSceneFrame {
  timelineState: ScrollTimelineState | null;
  /** Scene-level normalized progress used by legacy/no-timeline consumers. */
  progress: number;
  /** Continuous scroll-zone budget progress (kept out of the React snapshot lane). */
  zoneProgressPx: number | null;
  visualViewportOffset: number;
  isCurrent: boolean;
  isBackdropActive: boolean;
  isScrolling: boolean;
  scrollDirection: ScrollInputDirection | null;
}

export type ScrollSceneFrameList = readonly (ScrollSceneFrame | undefined)[];

export interface ScrollSceneFrameStore {
  getSnapshot: () => ScrollSceneFrameList;
  setSnapshot: (next: ScrollSceneFrameList) => void;
  setKeySnapshot: (sceneIndex: number, next: ScrollSceneFrame | undefined) => void;
  clearFrom: (sceneCount: number) => void;
  getKeySnapshot: (sceneIndex: number) => ScrollSceneFrame | undefined;
  subscribeKey: (sceneIndex: number, listener: () => void) => () => void;
}

export function createScrollSceneFrameStore(): ScrollSceneFrameStore {
  let frames: Array<ScrollSceneFrame | undefined> = [];
  const keyedListeners = new Map<number, Set<() => void>>();
  const notify = (sceneIndex: number): void => {
    keyedListeners.get(sceneIndex)?.forEach((listener) => listener());
  };

  return {
    getSnapshot: (): ScrollSceneFrameList => frames,
    setSnapshot: (next: ScrollSceneFrameList): void => {
      const previous = frames;
      frames = Array.from(next);
      const maxLength = Math.max(previous.length, frames.length);
      for (let sceneIndex = 0; sceneIndex < maxLength; sceneIndex += 1) {
        if (!Object.is(previous[sceneIndex], frames[sceneIndex])) notify(sceneIndex);
      }
    },
    setKeySnapshot: (sceneIndex: number, next: ScrollSceneFrame | undefined): void => {
      if (Object.is(frames[sceneIndex], next)) return;
      frames[sceneIndex] = next;
      notify(sceneIndex);
    },
    clearFrom: (sceneCount: number): void => {
      if (frames.length <= sceneCount) return;
      const previousLength = frames.length;
      frames.length = sceneCount;
      for (let sceneIndex = sceneCount; sceneIndex < previousLength; sceneIndex += 1) {
        notify(sceneIndex);
      }
    },
    getKeySnapshot: (sceneIndex: number): ScrollSceneFrame | undefined => frames[sceneIndex],
    subscribeKey: (sceneIndex: number, listener: () => void): (() => void) => {
      const listeners = keyedListeners.get(sceneIndex) ?? new Set<() => void>();
      listeners.add(listener);
      keyedListeners.set(sceneIndex, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) keyedListeners.delete(sceneIndex);
      };
    },
  };
}
