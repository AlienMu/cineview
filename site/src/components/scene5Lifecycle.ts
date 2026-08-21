/**
 * The closing scrub starts at zero opacity. Collapse may begin only after that
 * point, otherwise the flex layout moves while the closing copy is still visible.
 */
export const SCENE5_SPLIT_SCRUB_START = 0.85;
export const SCENE5_SPLIT_COLLAPSE_AT = SCENE5_SPLIT_SCRUB_START;
export const SCENE5_SPLIT_REOPEN_AT = 0.95;

export type Scene5Visibility = 'visible' | 'offscreen';

export interface Scene5LifecycleState {
  /** Intersection state is part of the lifecycle owner, not an incidental observer local. */
  visibility: Scene5Visibility;
  /** Invalidates callbacks from an older visibility/message/timer generation. */
  generation: number;
  freezePending: boolean;
  closing: boolean;
  split: boolean;
  exitPending: boolean;
  /** React key for the finite four-beat CSS entrance sequence. */
  replayKey: number;
}

export type Scene5LifecycleEvent =
  | { type: 'visibility'; visible: boolean; stageActive: boolean }
  | { type: 'finished'; progress: number }
  | { type: 'unfinished' }
  | { type: 'progress'; value: number }
  | { type: 'freeze-collapse'; generation: number }
  | { type: 'freeze-complete'; generation: number }
  | { type: 'exit-complete'; generation: number };

export type Scene5LifecycleEffect =
  | { type: 'cancel-sequence' }
  | { type: 'start-freeze'; generation: number }
  | { type: 'start-exit'; generation: number }
  | { type: 'replay-closing'; generation: number }
  | { type: 'freeze-reset' }
  | { type: 'exit-reset' };

export interface Scene5LifecycleTransition {
  state: Scene5LifecycleState;
  effects: readonly Scene5LifecycleEffect[];
}

export function createScene5LifecycleState(): Scene5LifecycleState {
  return {
    visibility: 'visible',
    generation: 0,
    freezePending: false,
    closing: false,
    split: false,
    exitPending: false,
    replayKey: 0,
  };
}

const unchanged = (state: Scene5LifecycleState): Scene5LifecycleTransition => ({
  state,
  effects: [],
});

/**
 * The finite Scene5 lifecycle owner. Continuous opacity remains an Animate/MotionValue concern;
 * this reducer only owns discrete residency, split/latch state, and finite sequence generations.
 */
export function reduceScene5Lifecycle(
  state: Scene5LifecycleState,
  event: Scene5LifecycleEvent
): Scene5LifecycleTransition {
  switch (event.type) {
    case 'visibility': {
      if (event.visible) {
        if (state.visibility === 'visible' && !state.freezePending) return unchanged(state);
        return {
          state: {
            ...state,
            visibility: 'visible',
            freezePending: false,
            exitPending: false,
            generation: state.generation + 1,
          },
          effects: [{ type: 'cancel-sequence' }],
        };
      }

      if (state.visibility === 'offscreen' && state.freezePending) return unchanged(state);
      const nextGeneration = state.generation + 1;
      if (!event.stageActive) {
        return {
          state: {
            ...state,
            visibility: 'offscreen',
            freezePending: false,
            exitPending: false,
            generation: nextGeneration,
          },
          effects: [{ type: 'cancel-sequence' }],
        };
      }
      return {
        state: {
          ...state,
          visibility: 'offscreen',
          freezePending: true,
          exitPending: false,
          generation: nextGeneration,
        },
        effects: [
          { type: 'cancel-sequence' },
          { type: 'start-freeze', generation: nextGeneration },
        ],
      };
    }

    case 'finished': {
      // A message emitted by an iframe that is already outside the scene cannot resurrect its
      // residency or cancel the cleanup that owns that offscreen generation.
      if (state.visibility === 'offscreen' || state.freezePending) return unchanged(state);

      const shouldSplit = event.progress >= SCENE5_SPLIT_COLLAPSE_AT;
      const needsReplay = !state.closing || state.exitPending || !state.split;
      if (!needsReplay && shouldSplit) return unchanged(state);

      const nextGeneration = state.generation + 1;
      return {
        state: {
          ...state,
          closing: true,
          split: shouldSplit,
          exitPending: false,
          generation: nextGeneration,
          replayKey: needsReplay ? state.replayKey + 1 : state.replayKey,
        },
        effects: [
          { type: 'cancel-sequence' },
          ...(needsReplay ? [{ type: 'replay-closing' as const, generation: nextGeneration }] : []),
        ],
      };
    }

    case 'unfinished': {
      if (!state.closing || state.visibility === 'offscreen' || state.freezePending) {
        return unchanged(state);
      }
      // A repeated message belongs to the already-running exit generation. Keep its timer and
      // generation intact so a noisy embed cannot postpone completion indefinitely.
      if (state.exitPending) return unchanged(state);
      const nextGeneration = state.generation + 1;
      return {
        state: {
          ...state,
          exitPending: true,
          generation: nextGeneration,
        },
        effects: [{ type: 'cancel-sequence' }, { type: 'start-exit', generation: nextGeneration }],
      };
    }

    case 'progress': {
      if (event.value < SCENE5_SPLIT_COLLAPSE_AT && state.split) {
        return { state: { ...state, split: false }, effects: [] };
      }
      if (
        event.value >= SCENE5_SPLIT_REOPEN_AT &&
        state.closing &&
        !state.split &&
        state.visibility === 'visible' &&
        !state.freezePending
      ) {
        const nextGeneration = state.generation + 1;
        return {
          state: {
            ...state,
            split: true,
            exitPending: false,
            generation: nextGeneration,
            replayKey: state.replayKey + 1,
          },
          effects: [
            { type: 'cancel-sequence' },
            { type: 'replay-closing', generation: nextGeneration },
          ],
        };
      }
      return unchanged(state);
    }

    case 'freeze-collapse': {
      if (!state.freezePending || event.generation !== state.generation || !state.split) {
        return unchanged(state);
      }
      return { state: { ...state, split: false }, effects: [] };
    }

    case 'freeze-complete': {
      if (!state.freezePending || event.generation !== state.generation) return unchanged(state);
      return {
        state: {
          ...createScene5LifecycleState(),
          visibility: 'offscreen',
          generation: state.generation + 1,
        },
        effects: [{ type: 'freeze-reset' }],
      };
    }

    case 'exit-complete': {
      if (!state.exitPending || event.generation !== state.generation) return unchanged(state);
      return {
        state: {
          ...state,
          closing: false,
          split: false,
          exitPending: false,
          generation: state.generation + 1,
        },
        effects: [{ type: 'exit-reset' }],
      };
    }
  }
}

type ComputedAnimationStyle = Pick<CSSStyleDeclaration, 'transform' | 'visibility' | 'opacity'>;
type ComputedStyleReader = (element: HTMLElement) => ComputedAnimationStyle;

/** Freeze a CSS entrance at its current visual frame before taking ownership of opacity. */
export function freezeScene5Element(
  element: HTMLElement,
  readComputedStyle: ComputedStyleReader = (target): ComputedAnimationStyle =>
    window.getComputedStyle(target)
): void {
  const computed = readComputedStyle(element);
  // CSSStyleDeclaration may be a live view. Copy every value before cancelling the animation;
  // otherwise the cancellation write can change what a later property read resolves to.
  const transform = computed.transform || 'none';
  const visibility = computed.visibility || 'visible';
  // 2026-08-19: keyframe now also animates opacity 0→1 (closing-rise/fade). The frozen
  // frame's opacity must be captured so cancelling a mid-flight entrance doesn't snap it
  // back to 1. Write it to the --scene5-manual-opacity channel (not inline opacity) so the
  // CSS `opacity: var(--scene5-manual-opacity, 1)` declaration stays the single owner and
  // the exit sequence can drive the same channel from this frozen value down to 0.
  const opacity = computed.opacity || '1';
  element.style.animation = 'none';
  element.style.transform = transform;
  element.style.visibility = visibility;
  element.style.setProperty('--scene5-manual-opacity', opacity);
}

/** Explicitly remove collapsed links from sequential focus while retaining the closing latch. */
export function scene5TabIndex(split: boolean): number | undefined {
  return split ? undefined : -1;
}
