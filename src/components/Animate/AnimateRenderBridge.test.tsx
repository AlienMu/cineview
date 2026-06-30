/**
 * AnimateRenderBridge 单测：render-prop 桥接把 MotionValue 源派生成 AnimateRenderState。
 * 覆盖 scroll / drag 两桥的初始态求值、change 事件更新，以及 drag 侧 null 源的
 * IDLE 兜底分支（初始 + change 两处）。
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
  it('派生初始态并在 signedVisual / phaseMotion change 时更新', () => {
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

    // 初始：signedVisual=0（初始帧）
    expect(seen!.enterProgress).toBe(0);

    // signedVisual change → 进入
    act(() => {
      signedVisual.set(1);
    });
    expect(seen!.enterProgress).toBe(1);

    // phaseMotion change 也触发重算（分支：phase 订阅）
    act(() => {
      phaseMotion.set('entered');
    });
    expect(seen!.phase).toBe('entered');
  });
});

describe('DragRenderBridge', () => {
  it('null 源初始态回退 IDLE（初始分支）', () => {
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

  it('非 null 源初始态派生，change 到 null 回退 IDLE（change 分支）', () => {
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

    // 初始：enter + localProgress=1 → entered/1
    expect(seen!.enterProgress).toBe(1);

    // change 到 null → IDLE 兜底（change 事件里的 : IDLE 分支）
    act(() => {
      visualState.set(null);
    });
    expect(seen!.phase).toBe('idle');

    // change 回非 null → 再次派生
    act(() => {
      visualState.set(makeDragState('enter', 0));
    });
    expect(seen!.enterProgress).toBe(0);
  });
});
