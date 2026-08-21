import {
  createScene5LifecycleState,
  reduceScene5Lifecycle,
  freezeScene5Element,
  scene5TabIndex,
  SCENE5_SPLIT_COLLAPSE_AT,
  SCENE5_SPLIT_SCRUB_START,
  type Scene5LifecycleEvent,
} from '../../../site/src/components/scene5Lifecycle';

function transition(
  state: ReturnType<typeof createScene5LifecycleState>,
  event: Scene5LifecycleEvent
) {
  return reduceScene5Lifecycle(state, event);
}

describe('Scene5 lifecycle seam', () => {
  it('keeps a pending offscreen freeze alive when a late finished message arrives', () => {
    let state = createScene5LifecycleState();

    state = transition(state, { type: 'finished', progress: 1 }).state;
    expect(state.closing).toBe(true);

    const hidden = transition(state, { type: 'visibility', visible: false, stageActive: true });
    state = hidden.state;
    expect(state.freezePending).toBe(true);
    expect(hidden.effects).toEqual([
      { type: 'cancel-sequence' },
      { type: 'start-freeze', generation: state.generation },
    ]);

    const lateFinished = transition(state, { type: 'finished', progress: 1 });
    expect(lateFinished.state).toEqual(state);
    expect(lateFinished.effects).toEqual([]);
    expect(lateFinished.state.freezePending).toBe(true);

    const staleComplete = transition(state, {
      type: 'freeze-complete',
      generation: state.generation - 1,
    });
    expect(staleComplete.state).toEqual(state);

    const complete = transition(state, { type: 'freeze-complete', generation: state.generation });
    expect(complete.state.closing).toBe(false);
    expect(complete.state.freezePending).toBe(false);
    expect(complete.state.visibility).toBe('offscreen');
  });

  it('freezes the computed transform before unfinished opacity sequencing', () => {
    const element = document.createElement('p');
    element.style.animation = 'scene5-closing-rise 0.7s both';
    freezeScene5Element(element, () => ({
      transform: 'matrix(1, 0, 0, 1, 0, 6.25)',
      visibility: 'visible',
      opacity: '0.5',
    }));

    expect(element.style.animation).toBe('none');
    expect(element.style.transform).toBe('matrix(1, 0, 0, 1, 0, 6.25)');
    expect(element.style.visibility).toBe('visible');
    // 2026-08-19: opacity is frozen into the manual-opacity channel (not inline)
    // so the CSS `opacity: var(--scene5-manual-opacity)` declaration stays owner.
    expect(element.style.getPropertyValue('--scene5-manual-opacity')).toBe('0.5');
    expect(element.style.opacity).toBe('');
  });

  it('copies live computed transform and visibility before cancelling the animation', () => {
    const element = document.createElement('p');
    element.style.animation = 'scene5-closing-rise 0.7s both';
    let transformReadWithAnimation: string | undefined;
    let visibilityReadWithAnimation: string | undefined;
    let opacityReadWithAnimation: string | undefined;

    freezeScene5Element(element, () => ({
      get transform() {
        transformReadWithAnimation = element.style.animation;
        return 'matrix(1, 0, 0, 1, 0, 6.25)';
      },
      get visibility() {
        visibilityReadWithAnimation = element.style.animation;
        return 'visible';
      },
      get opacity() {
        opacityReadWithAnimation = element.style.animation;
        return '0.5';
      },
    }));

    expect(transformReadWithAnimation).toBe('scene5-closing-rise 0.7s both');
    expect(visibilityReadWithAnimation).toBe('scene5-closing-rise 0.7s both');
    expect(opacityReadWithAnimation).toBe('scene5-closing-rise 0.7s both');
  });

  it('removes collapsed closing links from sequential focus while preserving the latch', () => {
    let state = createScene5LifecycleState();
    state = transition(state, { type: 'finished', progress: 1 }).state;
    state = transition(state, { type: 'progress', value: SCENE5_SPLIT_COLLAPSE_AT - 0.001 }).state;

    expect(state.closing).toBe(true);
    expect(state.split).toBe(false);
    expect(scene5TabIndex(state.split)).toBe(-1);
    expect(scene5TabIndex(true)).toBeUndefined();
  });

  it('does not collapse while the closing scrub is at or above its zero-opacity start', () => {
    expect(SCENE5_SPLIT_COLLAPSE_AT).toBe(SCENE5_SPLIT_SCRUB_START);
    let state = transition(createScene5LifecycleState(), { type: 'finished', progress: 1 }).state;
    state = transition(state, { type: 'progress', value: SCENE5_SPLIT_SCRUB_START }).state;
    expect(state.split).toBe(true);
    state = transition(state, { type: 'progress', value: SCENE5_SPLIT_SCRUB_START - 0.001 }).state;
    expect(state.split).toBe(false);
  });

  it('keeps the split layout at the exact scrub start when finished arrives first', () => {
    const finished = transition(createScene5LifecycleState(), {
      type: 'finished',
      progress: SCENE5_SPLIT_COLLAPSE_AT,
    });

    expect(finished.state.closing).toBe(true);
    expect(finished.state.split).toBe(true);
  });

  it('ignores duplicate unfinished messages while the same exit sequence is pending', () => {
    let state = transition(createScene5LifecycleState(), { type: 'finished', progress: 1 }).state;
    const firstExit = transition(state, { type: 'unfinished' });
    state = firstExit.state;

    expect(state.exitPending).toBe(true);
    const duplicateExit = transition(state, { type: 'unfinished' });

    expect(duplicateExit.state).toEqual(state);
    expect(duplicateExit.effects).toEqual([]);
  });

  it('reopens with a new replay generation instead of skipping the four beats', () => {
    let state = createScene5LifecycleState();
    state = transition(state, { type: 'finished', progress: 1 }).state;
    const firstReplay = state.replayKey;
    state = transition(state, { type: 'progress', value: SCENE5_SPLIT_COLLAPSE_AT - 0.001 }).state;
    const collapsedReplay = state.replayKey;

    const reopened = transition(state, { type: 'progress', value: 0.95 });
    state = reopened.state;

    expect(collapsedReplay).toBe(firstReplay);
    expect(state.split).toBe(true);
    expect(state.closing).toBe(true);
    expect(state.replayKey).toBe(firstReplay + 1);
    expect(reopened.effects).toEqual([
      { type: 'cancel-sequence' },
      { type: 'replay-closing', generation: state.generation },
    ]);
  });
});
