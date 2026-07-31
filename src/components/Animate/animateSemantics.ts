import { DEFAULT_ANIMATION_DURATION } from '../../types';
import type { AnimateProps, AnimationType } from '../../types';

type WidenAnimationRequirements<T> = T extends unknown
  ? Omit<T, 'enterAnimation' | 'infiniteAnimation'> & {
      enterAnimation?: AnimationType;
      infiniteAnimation?: AnimationType;
    }
  : never;

/**
 * Runtime implementation shape. The public union requires enter or infinite,
 * while this internal view remains defensive against JavaScript/`as any`
 * callers so invalid configurations can fail open and report INVALID_ANIMATION.
 */
export type AnimateInternalProps = WidenAnimationRequirements<AnimateProps>;

export interface NormalizedAnimateTimeline {
  // Whether this element participates in its enclosing Scene's timeline. Default
  // true: drag mode uses the Scene element track, while scroll mode binds to an
  // inherited zone and otherwise falls back to visibility. false forces the
  // independent visibility/arrival driver in either mode. Animate.tsx resolves
  // the concrete runtime driver from mode + inherited zoneId.
  sceneControlled: boolean;
  delay: number;
  waitFor?: string;
  zoneId?: string;
  phase?: {
    start?: number;
    end?: number;
  };
}

// The timeline after Animate.tsx has resolved sceneControlled + mode + zoneId
// down to a concrete driver. useAnimateScroll consumes this shape.
export type ResolvedAnimateTimeline = Omit<NormalizedAnimateTimeline, 'sceneControlled'> & {
  driver: 'scroll' | 'visibility';
};

export interface NormalizedAnimateVisibility {
  replayOnReenter: boolean;
  // Raw per-Animate design-px overrides (undefined = inherit the CineView-level
  // `modes.scroll.enterMargin` / `exitMargin`, default 50). The global fallback
  // and the single-ruler scale → physical-px conversion are resolved in useAnimateScroll,
  // which has the CineViewContext; keeping this layer pure of context.
  enterMargin?: number;
  exitMargin?: number;
}

export interface NormalizedAnimateSemantics {
  duration: {
    enter: number;
    exit: number;
  };
  timeline: NormalizedAnimateTimeline;
  visibility: NormalizedAnimateVisibility;
}

export function normalizeAnimateSemantics({
  duration,
  timeline,
  visibility,
}: Pick<AnimateInternalProps, 'duration' | 'timeline' | 'visibility'>): NormalizedAnimateSemantics {
  return {
    duration: {
      enter: duration?.enter ?? DEFAULT_ANIMATION_DURATION,
      exit: duration?.exit ?? DEFAULT_ANIMATION_DURATION,
    },
    timeline: {
      sceneControlled: timeline?.sceneControlled ?? true,
      delay: timeline?.delay ?? 0,
      waitFor: timeline?.waitFor,
      zoneId: timeline?.zoneId,
      phase: {
        start: timeline?.phase?.start,
        end: timeline?.phase?.end,
      },
    },
    visibility: {
      replayOnReenter: visibility?.replayOnReenter ?? true,
      enterMargin: visibility?.enterMargin,
      exitMargin: visibility?.exitMargin,
    },
  };
}
