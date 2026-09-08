import type { AnimateRenderState } from '../../types';

/**
 * Render-prop state normalization (pure functions, exported for testing).
 *
 * Scroll and drag use different phase vocabularies:
 *   - scroll: `GatePhase`('idle'|'waiting'|'entering'|'entered'|'exiting'|'exited'), passed through directly.
 *   - drag:  `DragVisualState.mode`('rest'|'outgoing'|'enter'|'hidden') + `localProgress`(0..1),
 *            normalized to unified `AnimateRenderState.phase` vocabulary.
 *
 * Both sides converge `enterProgress` to 0..1 (0=initial frame, 1=fully entered).
 */

export type ScrollGatePhase = 'idle' | 'waiting' | 'entering' | 'entered' | 'exiting' | 'exited';
export type DragVisualMode = 'rest' | 'outgoing' | 'enter' | 'hidden';

const PROGRESS_SETTLED = 1 - 1e-3;

/** Drag side: mode + localProgress → unified phase vocabulary. */
export function normalizeDragPhase(
  mode: DragVisualMode,
  localProgress: number
): AnimateRenderState['phase'] {
  switch (mode) {
    case 'hidden':
      return 'idle';
    case 'outgoing':
      return 'exiting';
    case 'rest':
      return 'entered';
    case 'enter':
      return localProgress >= PROGRESS_SETTLED ? 'entered' : 'entering';
    default:
      return 'idle';
  }
}

/** Scroll side: `visualMotion` convention 0=initial, 1=enter, -1=exit; enterProgress takes positive segment. */
export function resolveScrollEnterProgress(signedVisual: number): number {
  if (signedVisual <= 0) {
    return 0;
  }
  return signedVisual >= 1 ? 1 : signedVisual;
}

/** Scroll side: assemble complete render state. */
export function resolveScrollRenderState(
  phase: ScrollGatePhase,
  signedVisual: number
): AnimateRenderState {
  return {
    enterProgress: resolveScrollEnterProgress(signedVisual),
    phase,
  };
}

/** Drag side: assemble complete render state. localProgress is already unsigned 0..1. */
export function resolveDragRenderState(
  mode: DragVisualMode,
  localProgress: number
): AnimateRenderState {
  const clamped = localProgress <= 0 ? 0 : localProgress >= 1 ? 1 : localProgress;
  return {
    enterProgress: clamped,
    phase: normalizeDragPhase(mode, clamped),
  };
}

/** No-animation early-exit branch: always initial state (progress 0, phase idle), still supports function children. */
export const IDLE_RENDER_STATE: AnimateRenderState = { enterProgress: 0, phase: 'idle' };
