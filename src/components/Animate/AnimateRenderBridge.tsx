/**
 * Render-prop bridge: subscribes to MotionValue sources exposed by hooks, derives AnimateRenderState,
 * then calls the function children. Only mounts when children is a function, so non-render-prop Animate
 * instances incur no subscription or re-render cost.
 *
 * Scroll sources: signedVisual (visualMotion, 0=initial/1=entering/-1=exiting) + phaseMotion (GatePhase).
 * Drag source: visualState (DragVisualState, mode + localProgress).
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
}: ScrollBridgeProps): React.JSX.Element {
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

export function DragRenderBridge({ visualState, render }: DragBridgeProps): React.JSX.Element {
  const [state, setState] = useState<AnimateRenderState>(() => {
    const vs = visualState.get();
    return vs ? resolveDragRenderState(vs.mode, vs.localProgress) : IDLE_RENDER_STATE;
  });

  useMotionValueEvent(visualState, 'change', (vs) => {
    setState(vs ? resolveDragRenderState(vs.mode, vs.localProgress) : IDLE_RENDER_STATE);
  });

  return <>{render(state)}</>;
}
