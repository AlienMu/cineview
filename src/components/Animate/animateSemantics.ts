import { DEFAULT_ANIMATION_DURATION } from '../../types';
import type { AnimateProps } from '../../types';

export interface AnimateLegacyCompatProps {
  enterDuration?: number;
  exitDuration?: number;
  delay?: number;
  waitFor?: string;
  scrollPhaseStart?: number;
  scrollPhaseEnd?: number;
}

export type AnimateInternalProps = AnimateProps & AnimateLegacyCompatProps;

export interface NormalizedAnimateTimeline {
  // Whether this element's animation timeline is controlled by an enclosing
  // Scene's scroll takeover. Default true: inside a Scene.scroll zone it binds
  // to that zone's real-scroll budget; outside a zone (or in drag mode) it
  // gracefully falls back to visibility. false forces the standalone visibility
  // gate even inside a zone. The concrete scroll-vs-visibility resolution
  // happens in Animate.tsx (which knows the mode + inherited zoneId) and is
  // exposed as ResolvedAnimateTimeline.
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
  enterDuration,
  exitDuration,
  delay,
  waitFor,
  scrollPhaseStart,
  scrollPhaseEnd,
}: Pick<
  AnimateInternalProps,
  | 'duration'
  | 'timeline'
  | 'visibility'
  | 'enterDuration'
  | 'exitDuration'
  | 'delay'
  | 'waitFor'
  | 'scrollPhaseStart'
  | 'scrollPhaseEnd'
>): NormalizedAnimateSemantics {
  return {
    duration: {
      enter: duration?.enter ?? enterDuration ?? DEFAULT_ANIMATION_DURATION,
      exit: duration?.exit ?? exitDuration ?? DEFAULT_ANIMATION_DURATION,
    },
    timeline: {
      sceneControlled: timeline?.sceneControlled ?? true,
      delay: timeline?.delay ?? delay ?? 0,
      waitFor: timeline?.waitFor ?? waitFor,
      zoneId: timeline?.zoneId,
      phase: {
        start: timeline?.phase?.start ?? scrollPhaseStart,
        end: timeline?.phase?.end ?? scrollPhaseEnd,
      },
    },
    visibility: {
      replayOnReenter: visibility?.replayOnReenter ?? true,
      enterMargin: visibility?.enterMargin,
      exitMargin: visibility?.exitMargin,
    },
  };
}
