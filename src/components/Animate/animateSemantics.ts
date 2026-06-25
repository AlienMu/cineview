import { DEFAULT_ANIMATION_DURATION } from '../../types';
import type { AnimateProps } from '../../types';

export interface AnimateLegacyCompatProps {
  enterDuration?: number;
  exitDuration?: number;
  delay?: number;
  waitFor?: string;
  scrollDriven?: boolean;
  scrollPhaseStart?: number;
  scrollPhaseEnd?: number;
}

export type AnimateInternalProps = AnimateProps & AnimateLegacyCompatProps;

export interface NormalizedAnimateTimeline {
  driver: 'auto' | 'scene' | 'scroll' | 'visibility';
  delay: number;
  waitFor?: string;
  zoneId?: string;
  phase?: {
    start?: number;
    end?: number;
  };
}

export interface NormalizedAnimateVisibility {
  replayOnReenter: boolean;
  enterWhen: 'fully-visible-bottom';
  exitWhen: 'leaving-top';
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
  scrollDriven,
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
  | 'scrollDriven'
  | 'scrollPhaseStart'
  | 'scrollPhaseEnd'
>): NormalizedAnimateSemantics {
  const normalizedDriver =
    timeline?.driver ??
    (scrollDriven === undefined ? 'auto' : scrollDriven ? 'scroll' : 'visibility');

  return {
    duration: {
      enter: duration?.enter ?? enterDuration ?? DEFAULT_ANIMATION_DURATION,
      exit: duration?.exit ?? exitDuration ?? DEFAULT_ANIMATION_DURATION,
    },
    timeline: {
      driver: normalizedDriver,
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
      enterWhen: visibility?.enterWhen ?? 'fully-visible-bottom',
      exitWhen: visibility?.exitWhen ?? 'leaving-top',
    },
  };
}
