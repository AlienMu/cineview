import { DEFAULT_ANIMATION_DURATION } from '../../types';
import type { AnimateProps, AnimationType } from '../../types';

type WidenAnimationRequirements<T> = T extends unknown
  ? Omit<T, 'enterAnimation' | 'loopAnimation'> & {
      enterAnimation?: AnimationType;
      loopAnimation?: AnimationType;
    }
  : never;

/**
 * Runtime implementation shape. The public union requires enter or loop,
 * while this internal view remains defensive against JavaScript/`as any`
 * callers so invalid configurations can fail open and report INVALID_ANIMATION.
 */
export type AnimateInternalProps = WidenAnimationRequirements<AnimateProps>;

export interface NormalizedAnimateTimeline {
  // Who drives this element's animation timeline. Default 'scene': drag mode uses
  // the Scene element track, while scroll mode binds to an inherited zone and
  // otherwise falls back to visibility. 'clock' forces the independent
  // visibility/arrival clock in either mode. Animate.tsx resolves the concrete
  // runtime lane from mode + inherited zoneId.
  driver: 'scene' | 'clock';
  delay: number;
  after?: string;
  zoneId?: string;
  phase?: {
    start?: number;
    end?: number;
  };
}

// The timeline after Animate.tsx has resolved driver + mode + zoneId down to a
// concrete lane. useAnimateScroll consumes this shape.
export type ResolvedAnimateTimeline = Omit<NormalizedAnimateTimeline, 'driver'> & {
  lane: 'scroll' | 'visibility';
};

export interface NormalizedAnimateVisibility {
  replay: boolean;
  // Raw per-Animate design-px overrides (undefined = inherit the CineView-level
  // scroll-branch `enterMargin` / `exitMargin`, default 50). The global fallback
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
      driver: timeline?.driver ?? 'scene',
      delay: timeline?.delay ?? 0,
      after: timeline?.after,
      zoneId: timeline?.zoneId,
      phase: {
        start: timeline?.phase?.start,
        end: timeline?.phase?.end,
      },
    },
    visibility: {
      replay: visibility?.replay ?? true,
      enterMargin: visibility?.enterMargin,
      exitMargin: visibility?.exitMargin,
    },
  };
}
