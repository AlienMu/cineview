/**
 * render-prop 桥接:订阅 hook 暴露的 MotionValue 源,派生 AnimateRenderState 后调用函数
 * children。仅在 children 为函数时挂载,故非 render-prop 的 Animate 不承担订阅/重渲染成本。
 *
 * scroll 源:signedVisual(visualMotion,0=初始/1=进入/-1=退出)+ phaseMotion(GatePhase)。
 * drag 源:visualState(DragVisualState,mode + localProgress)。
 */
import { useState } from 'react';
import { MotionValue, useMotionValueEvent } from 'framer-motion';
import type { AnimateRenderState } from '../../types';
import type { GatePhase } from './useAnimateScroll';
import type { DragVisualState } from './useAnimateDrag';
import {
  resolveScrollRenderState,
  resolveDragRenderState,
  IDLE_RENDER_STATE,
} from './animateRenderState';

interface ScrollBridgeProps {
  signedVisual: MotionValue<number>;
  phaseMotion: MotionValue<GatePhase>;
  render: (state: AnimateRenderState) => React.ReactNode;
}

export function ScrollRenderBridge({
  signedVisual,
  phaseMotion,
  render,
}: ScrollBridgeProps): JSX.Element {
  const [state, setState] = useState<AnimateRenderState>(() =>
    resolveScrollRenderState(phaseMotion.get(), signedVisual.get())
  );

  useMotionValueEvent(signedVisual, 'change', (v) => {
    setState(resolveScrollRenderState(phaseMotion.get(), v));
  });
  useMotionValueEvent(phaseMotion, 'change', (p) => {
    setState(resolveScrollRenderState(p, signedVisual.get()));
  });

  return <>{render(state)}</>;
}

interface DragBridgeProps {
  visualState: MotionValue<DragVisualState | null>;
  render: (state: AnimateRenderState) => React.ReactNode;
}

export function DragRenderBridge({ visualState, render }: DragBridgeProps): JSX.Element {
  const [state, setState] = useState<AnimateRenderState>(() => {
    const vs = visualState.get();
    return vs ? resolveDragRenderState(vs.mode, vs.localProgress) : IDLE_RENDER_STATE;
  });

  useMotionValueEvent(visualState, 'change', (vs) => {
    setState(vs ? resolveDragRenderState(vs.mode, vs.localProgress) : IDLE_RENDER_STATE);
  });

  return <>{render(state)}</>;
}
