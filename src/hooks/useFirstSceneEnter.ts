import { useCallback, useEffect, useRef, useState } from 'react';
import type { CineViewErrorCode } from '../types';

/**
 * Global first-screen cold-start gate. Mode-agnostic: owns the two decoupled
 * booleans that govern when the first mounted scene is allowed to play its
 * one-shot enter pass, plus the priority-asset / timeout / preventDefault /
 * static-reveal coordination that used to live inline in CineView.
 *
 * Two-boolean model (intentionally NOT a 3-state enum — see project memory):
 * - `firstSceneEnterActive` — the WINDOW flag. While true, the first scene is
 *   held at / playing its enter pass instead of snapping to rest. In drag mode
 *   `useAnimateDrag` reads it; in scroll mode it is inert (the scroll visibility
 *   path gates on `firstSceneEnterReady` only), but kept so the lifecycle is
 *   identical across modes.
 * - `firstSceneEnterReady` — the START trigger. Turns true once first-screen
 *   priority assets settle (or are forced ready). `(active=true, ready=false)`
 *   means "held at initial, not yet entering" (pre-load and the preventDefault
 *   path); `(active=false, ready=true)` is the completed-extendable state.
 *
 * This hook owns the GATING SIGNAL only — it never runs the enter tween itself.
 * Each mode's element track / visibility state machine consumes `ready` and
 * plays its own animation; drag clears the window via `handleComplete` when its
 * element track reaches T. Scroll leaves the (inert) window as-is.
 */
export interface UseFirstSceneEnterParams {
  /** Whether the cold-start mechanism is engaged at all (false → reveal statically). */
  enabled: boolean;
  /** Whether a first scene exists to drive. */
  hasFirstScene: boolean;
  /** First-screen priority assets are ready (preloadState.priorityComplete). */
  priorityComplete: boolean;
  /** Fallback timeout before emitting FIRST_SCENE_TIMEOUT and revealing statically. */
  timeoutMs: number;
  /**
   * When true, an external owner has preempted the cold start (e.g. the user
   * grabbed the first scene mid-enter in drag mode). Clears both flags so the
   * gesture fully owns the track. Scroll passes false.
   */
  preemptSignal?: boolean;
  /**
   * Routes a recoverable FIRST_SCENE_TIMEOUT to the consumer. Returns true if
   * the consumer handled it (preventDefault) — in which case the scene is left
   * at its initial visual for consumer-driven recovery instead of static reveal.
   */
  emitRecoverableError: (
    code: CineViewErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) => boolean;
  /** Lazily read preload counts for the timeout error context. */
  getPreloadCounts: () => { loadedCount: number; totalCount: number };
}

export type FirstSceneActivationKind = 'ready' | 'static';

export interface UseFirstSceneEnterResult {
  firstSceneEnterActive: boolean;
  firstSceneEnterReady: boolean;
  /**
   * Monotonic one-shot signal for the first Scene's formal activation. Asset
   * readiness and the default timeout fallback activate; a handled timeout or
   * pointer preemption does not.
   */
  firstSceneActivationToken: number;
  firstSceneActivationKind: FirstSceneActivationKind | null;
  /** Clears the window once the first scene's enter pass reaches its terminal. */
  handleComplete: () => void;
}

export function useFirstSceneEnter({
  enabled,
  hasFirstScene,
  priorityComplete,
  timeoutMs,
  preemptSignal = false,
  emitRecoverableError,
  getPreloadCounts,
}: UseFirstSceneEnterParams): UseFirstSceneEnterResult {
  const [firstSceneEnterActive, setFirstSceneEnterActive] = useState<boolean>(() => enabled);
  const [firstSceneEnterReady, setFirstSceneEnterReady] = useState<boolean>(false);
  const [firstSceneActivationToken, setFirstSceneActivationToken] = useState(0);
  const [firstSceneActivationKind, setFirstSceneActivationKind] =
    useState<FirstSceneActivationKind | null>(null);
  const ranRef = useRef(false);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedTimeoutMs = Math.max(0, timeoutMs);

  // Stable refs so the cold-start effect does not re-run on identity churn of
  // the callbacks (which would spawn a spurious second timer / enter pass).
  const emitErrorRef = useRef(emitRecoverableError);
  emitErrorRef.current = emitRecoverableError;
  const getCountsRef = useRef(getPreloadCounts);
  getCountsRef.current = getPreloadCounts;

  // Cold-start driver. Runs once: when first-screen priority assets settle, flip
  // the ready trigger so the active scene's own driver plays 0->T. If assets do
  // not settle within timeoutMs, emit a recoverable error; unless the consumer
  // calls preventDefault, fall back to a static reveal (clear the window).
  useEffect(() => {
    if (!enabled) return;
    if (ranRef.current) return;
    if (!hasFirstScene) return;

    const activateFirstScene = (kind: FirstSceneActivationKind): void => {
      setFirstSceneActivationKind(kind);
      setFirstSceneActivationToken((current) => current + 1);
    };

    const startEnter = (): void => {
      // The effect cleanup always clears a pending timer before this body
      // re-runs, and the timer callback no-ops once ranRef is set — so no
      // explicit clearTimeout is needed here.
      ranRef.current = true;
      setFirstSceneEnterReady(true);
      activateFirstScene('ready');
    };

    const settleStatically = (): void => {
      ranRef.current = true;
      setFirstSceneEnterReady(false);
      setFirstSceneEnterActive(false);
      activateFirstScene('static');
    };

    if (priorityComplete) {
      startEnter();
      return;
    }

    if (timeoutTimerRef.current === null) {
      timeoutTimerRef.current = setTimeout(() => {
        timeoutTimerRef.current = null;
        // ranRef is always false here: effect cleanup clears the timer before
        // any code path that sets ranRef can run, so this guard is unreachable.
        // Left as a no-op-safe call — ranRef check removed per dead-code rule.
        ranRef.current = true;
        const counts = getCountsRef.current();
        const handled = emitErrorRef.current(
          'FIRST_SCENE_TIMEOUT',
          `First scene priority assets did not load within ${resolvedTimeoutMs}ms.`,
          {
            sceneIndex: 0,
            timeoutMs: resolvedTimeoutMs,
            loadedCount: counts.loadedCount,
            totalCount: counts.totalCount,
          }
        );
        if (!handled) {
          settleStatically();
        }
      }, resolvedTimeoutMs);
    }

    return (): void => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
  }, [enabled, hasFirstScene, priorityComplete, resolvedTimeoutMs]);

  // External preempt (drag grab): the gesture takes ownership of the track, so
  // stop gating. Clears both flags and the pending timeout.
  useEffect(() => {
    if (!preemptSignal) return;
    ranRef.current = true;
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
    setFirstSceneEnterReady(false);
    setFirstSceneEnterActive(false);
  }, [preemptSignal]);

  const handleComplete = useCallback(() => {
    setFirstSceneEnterActive(false);
  }, []);

  return {
    firstSceneEnterActive,
    firstSceneEnterReady,
    firstSceneActivationToken,
    firstSceneActivationKind,
    handleComplete,
  };
}
