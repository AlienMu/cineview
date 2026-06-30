import type { AnimateRenderState } from '../../types';

/**
 * render-prop 状态归一化(纯函数,导出供测试)。
 *
 * scroll 与 drag 两侧用不同的相位词汇:
 *   - scroll: `GatePhase`('idle'|'entering'|'entered'|'exiting'|'exited'),已是 5 态,直接透传。
 *   - drag:  `DragVisualState.mode`('rest'|'outgoing'|'enter'|'hidden')+ `localProgress`(0..1),
 *            须归一化到统一的 `AnimateRenderState.phase` 词汇。
 *
 * 两侧的 `enterProgress` 都收敛为 0..1(0=初始帧,1=完全进入)。
 */

export type ScrollGatePhase = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';
export type DragVisualMode = 'rest' | 'outgoing' | 'enter' | 'hidden';

const PROGRESS_SETTLED = 1 - 1e-3;

/** drag 侧 mode + localProgress → 统一 phase 词汇。 */
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

/** scroll 侧:`visualMotion` 约定 0=初始、1=进入、-1=退出;enterProgress 取正段。 */
export function resolveScrollEnterProgress(signedVisual: number): number {
  if (signedVisual <= 0) {
    return 0;
  }
  return signedVisual >= 1 ? 1 : signedVisual;
}

/** scroll 侧组装完整 render state。 */
export function resolveScrollRenderState(
  phase: ScrollGatePhase,
  signedVisual: number
): AnimateRenderState {
  return {
    enterProgress: resolveScrollEnterProgress(signedVisual),
    phase,
  };
}

/** drag 侧组装完整 render state。localProgress 已是无符号 0..1。 */
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

/** 无动画早退分支:恒为初始态(进度 0、phase idle),仍支持函数 children。 */
export const IDLE_RENDER_STATE: AnimateRenderState = { enterProgress: 0, phase: 'idle' };
