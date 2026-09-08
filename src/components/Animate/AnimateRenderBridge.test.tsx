/**
 * AnimateRenderBridge unit tests: render-prop bridge derives AnimateRenderState from MotionValue sources.
 * Covers initial state evaluation and change event updates for both scroll/drag bridges,
 * plus drag-side null-source IDLE fallback (initial + change branches).
 */
import { render } from '@testing-library/react';
import { act } from '@testing-library/react';
import { motionValue } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { ScrollRenderBridge, DragRenderBridge } from './AnimateRenderBridge';
import type { GatePhase } from './useAnimateScroll';
import type { DragVisualState } from './useAnimateDrag';
import type { AnimateRenderState } from '../../types';

function makeDragState(mode: DragVisualState['mode'], localProgress: number): DragVisualState {
  return {
    mode,
    direction: 'forward',
    transitionProgress: 0,
    sharedElapsedMs: 0,
    projectedSceneElapsedMs: 0,
    sharedTimelineDurationMs: 0,
    sceneTimelineDurationMs: 0,
    localProgress,
    sceneOffset: 0,
  } as DragVisualState;
}

describe('ScrollRenderBridge', () => {
  it('derives initial state and updates on signedVisual / phaseMotion change', () => {
    const signedVisual = motionValue(0);
    const phaseMotion = motionValue<GatePhase>('idle');
    let seen: AnimateRenderState | null = null;

    render(
      <ScrollRenderBridge
        signedVisual={signedVisual}
        phaseMotion={phaseMotion}
        render={(state) => {
          seen = state;
          return null;
        }}
      />
    );

    // Initial: signedVisual=0 (initial frame)
    expect(seen!.enterProgress).toBe(0);

    // signedVisual change → entering
    act(() => {
      signedVisual.set(1);
    });
    expect(seen!.enterProgress).toBe(1);

    // phaseMotion change also triggers recalculation (branch: phase subscription)
    act(() => {
      phaseMotion.set('entered');
    });
    expect(seen!.phase).toBe('entered');
  });
});

describe('DragRenderBridge', () => {
  it('null source initial state falls back to IDLE (initial branch)', () => {
    const visualState = motionValue<DragVisualState | null>(null);
    let seen: AnimateRenderState | null = null;

    render(
      <DragRenderBridge
        visualState={visualState}
        render={(state) => {
          seen = state;
          return null;
        }}
      />
    );

    // null → IDLE_RENDER_STATE
    expect(seen!.phase).toBe('idle');
    expect(seen!.enterProgress).toBe(0);
  });

  it('non-null source derives initial state, change to null falls back to IDLE (change branch)', () => {
    const visualState: MotionValue<DragVisualState | null> = motionValue<DragVisualState | null>(
      makeDragState('enter', 1)
    );
    let seen: AnimateRenderState | null = null;

    render(
      <DragRenderBridge
        visualState={visualState}
        render={(state) => {
          seen = state;
          return null;
        }}
      />
    );

    // Initial: enter + localProgress=1 → entered/1
    expect(seen!.enterProgress).toBe(1);

    // change to null → IDLE fallback (: IDLE branch in change event)
    act(() => {
      visualState.set(null);
    });
    expect(seen!.phase).toBe('idle');

    // change back to non-null → derive again
    act(() => {
      visualState.set(makeDragState('enter', 0));
    });
    expect(seen!.enterProgress).toBe(0);
  });
});
