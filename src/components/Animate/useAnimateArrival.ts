import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { animate, type MotionValue, useMotionValue } from 'framer-motion';
import type { AnimatePhase, ParsedAnimationVariant } from '../../types';
import type { SceneContextType } from './Animate';
import {
  getDefaultValue,
  getVariantValue,
  lerpTransformValue,
  parseNumericValue,
  type AnimatableProperty,
  type VariantRecord,
} from './animateInterpolation';
import { useAnimatedPropertyLanes } from './useAnimatedPropertyLanes';

interface UseAnimateArrivalParams {
  enabled: boolean;
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  hasAuthoredEnterAnimation: boolean;
  parseReady: boolean;
  delay: number;
  enterDuration: number;
  /** Manual enter trigger (see `AnimateProps.enterRef`). `delay` is this lane's
   *  fallback switch: with a delay authored the pass still self-starts after it,
   *  with none the element holds at its initial frame until the consumer calls.
   *  (`after` is ignored on this lane by design, so it is not a fallback here.) */
  enterRef?: MutableRefObject<(() => void) | null>;
}

interface UseAnimateArrivalReturn {
  style: Record<string, MotionValue<number> | MotionValue<string> | MotionValue<number | string>>;
  visualMotion: MotionValue<number>;
  phaseMotion: MotionValue<AnimatePhase>;
  shouldRunInfinite: boolean;
  /** Existing content revealed by the first-screen timeout must not tween stagger children. */
  staticReveal: boolean;
}

interface ArrivalPlaybackConfig {
  delay: number;
  enterDuration: number;
  hasAuthoredEnterAnimation: boolean;
  parseReady: boolean;
  enterVariant: ParsedAnimationVariant | null;
  /** True when enterRef was passed without a delay fallback: hold at initial. */
  autoEnterSuppressed: boolean;
}

interface ArrivalVariantRecords {
  initial: VariantRecord;
  animate: VariantRecord;
}

function resolveArrivalPropertyValue(
  progress: number,
  variants: ArrivalVariantRecords,
  property: AnimatableProperty
): number | string {
  return lerpTransformValue(
    getVariantValue(variants.initial, property, getDefaultValue(property, 'initial')),
    getVariantValue(variants.animate, property, getDefaultValue(property, 'animate')),
    progress
  );
}

/**
 * Parses both endpoints first, then lerps numerically. This differs from the
 * lane factory's default `parse ∘ mixed-resolve` composition: with an
 * unparseable endpoint string (e.g. opacity: 'visible') this keeps tweening
 * toward the fallback for the whole pass, instead of holding at the initial
 * frame and snapping on the final one. Passed as the numeric resolver so the
 * factory reproduces the driver's former local helper exactly.
 */
function resolveArrivalNumericPropertyValue(
  progress: number,
  variants: ArrivalVariantRecords,
  property: AnimatableProperty
): number {
  const fallback = parseNumericValue(getDefaultValue(property, 'animate'), 0);
  const initial = parseNumericValue(
    getVariantValue(variants.initial, property, getDefaultValue(property, 'initial')),
    fallback
  );
  const target = parseNumericValue(
    getVariantValue(variants.animate, property, getDefaultValue(property, 'animate')),
    fallback
  );
  return initial + (target - initial) * progress;
}

/**
 * * Real-time post-arrival driver for drag + timeline driver 'clock'.
 *
 * It never reads drag progress and never registers with the Scene element track.
 * The sole start signal is Scene.activationToken. A Scene departure resets the
 * element; returning mints a new token and therefore replays exactly once.
 */
export function useAnimateArrival({
  enabled,
  sceneContext,
  enterVariant,
  hasAuthoredEnterAnimation,
  parseReady,
  delay,
  enterDuration,
  enterRef,
}: UseAnimateArrivalParams): UseAnimateArrivalReturn {
  const variantsRef = useRef<ArrivalVariantRecords>({
    initial: {},
    animate: {},
  });
  const autoEnterSuppressed = Boolean(enterRef) && delay <= 0;
  const latestConfigRef = useRef<ArrivalPlaybackConfig>({
    delay,
    enterDuration,
    hasAuthoredEnterAnimation,
    parseReady,
    enterVariant,
    autoEnterSuppressed,
  });
  latestConfigRef.current = {
    delay,
    enterDuration,
    hasAuthoredEnterAnimation,
    parseReady,
    enterVariant,
    autoEnterSuppressed,
  };

  const visualMotion = useMotionValue(hasAuthoredEnterAnimation ? 0 : 1);
  const phaseMotion = useMotionValue<AnimatePhase>(hasAuthoredEnterAnimation ? 'idle' : 'entered');
  const [shouldRunInfinite, setShouldRunInfinite] = useState(false);
  const [staticReveal, setStaticReveal] = useState(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePlaybackTokenRef = useRef(0);
  const pendingTokenRef = useRef(0);
  // Manual control bookkeeping. `pendingManualStartRef` holds the current token's
  // own startEnter closure so enterRef can run exactly that pass (same frozen
  // variants, same ownership guard); `manualRequestedRef` covers the reverse race
  // where the consumer calls before the Scene has minted its activation token.
  const pendingManualStartRef = useRef<(() => void) | null>(null);
  const manualRequestedRef = useRef(false);
  const mountedBeforeActivationRef = useRef((sceneContext?.activationToken ?? 0) === 0);
  const sceneContextRef = useRef(sceneContext);
  sceneContextRef.current = sceneContext;

  const stopPlayback = useCallback((): void => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (delayTimerRef.current !== null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
  }, []);

  const resetToInitial = useCallback((): void => {
    const config = latestConfigRef.current;
    stopPlayback();
    activePlaybackTokenRef.current = 0;
    pendingTokenRef.current = 0;
    pendingManualStartRef.current = null;
    manualRequestedRef.current = false;
    setShouldRunInfinite(false);
    setStaticReveal(false);
    visualMotion.set(config.hasAuthoredEnterAnimation ? 0 : 1);
    phaseMotion.set(config.hasAuthoredEnterAnimation ? 'idle' : 'entered');
  }, [phaseMotion, stopPlayback, visualMotion]);

  const startToken = useCallback(
    (token: number, activationKind: SceneContextType['activationKind']): void => {
      const context = sceneContextRef.current;
      const config = latestConfigRef.current;
      if (!context?.isActive || (context.activationToken ?? 0) !== token || token <= 0) return;
      if (config.hasAuthoredEnterAnimation && !config.parseReady) {
        pendingTokenRef.current = token;
        return;
      }
      if (activePlaybackTokenRef.current === token) return;

      pendingTokenRef.current = 0;
      activePlaybackTokenRef.current = token;
      stopPlayback();
      pendingManualStartRef.current = null;
      setShouldRunInfinite(false);
      // Freeze this activation's parsed visual. Later prop/parse generations update
      // latestConfigRef for the next token but cannot mutate an in-flight pass.
      variantsRef.current = {
        initial: (config.enterVariant?.initial as VariantRecord) ?? {},
        animate: (config.enterVariant?.animate as VariantRecord) ?? {},
      };

      const staticForExistingMount =
        activationKind === 'static' && mountedBeforeActivationRef.current;
      setStaticReveal(staticForExistingMount);

      const stillOwnsToken = (): boolean => {
        const live = sceneContextRef.current;
        return Boolean(live?.isActive && (live.activationToken ?? 0) === token);
      };
      const startInfinite = (): void => {
        if (stillOwnsToken()) setShouldRunInfinite(true);
      };
      const scheduleInfinite = (): void => {
        const safeDelay = Math.max(config.delay, 0);
        if (safeDelay <= 0) {
          startInfinite();
          return;
        }
        delayTimerRef.current = setTimeout(() => {
          delayTimerRef.current = null;
          startInfinite();
        }, safeDelay);
      };

      const hasPlayableEnter = config.hasAuthoredEnterAnimation && config.enterVariant !== null;
      if (!hasPlayableEnter || staticForExistingMount) {
        visualMotion.set(1);
        phaseMotion.set('entered');
        scheduleInfinite();
        return;
      }

      visualMotion.set(0);
      phaseMotion.set('waiting');
      const startEnter = (): void => {
        delayTimerRef.current = null;
        if (!stillOwnsToken()) return;
        phaseMotion.set('entering');
        const safeDuration = Math.max(config.enterDuration, 0);
        if (safeDuration <= 0) {
          visualMotion.set(1);
          phaseMotion.set('entered');
          setShouldRunInfinite(true);
          return;
        }
        controlsRef.current = animate(visualMotion, 1, {
          duration: safeDuration / 1000,
          ease: 'easeInOut',
          onComplete: () => {
            controlsRef.current = null;
            if (!stillOwnsToken()) return;
            visualMotion.set(1);
            phaseMotion.set('entered');
            setShouldRunInfinite(true);
          },
        });
      };

      const safeDelay = Math.max(config.delay, 0);
      // Consumer-owned enter with no delay fallback: park at the initial frame and
      // publish this pass's own starter. Nothing runs until enterRef fires — unless
      // the consumer already called it before this token was minted, in which case
      // honour that request now rather than dropping it.
      if (config.autoEnterSuppressed) {
        pendingManualStartRef.current = startEnter;
        if (manualRequestedRef.current) {
          manualRequestedRef.current = false;
          pendingManualStartRef.current = null;
          startEnter();
        }
        return;
      }

      if (safeDelay > 0) {
        delayTimerRef.current = setTimeout(startEnter, safeDelay);
      } else {
        startEnter();
      }
    },
    [phaseMotion, stopPlayback, visualMotion]
  );

  const playbackKey = enabled && sceneContext?.isActive ? (sceneContext.activationToken ?? 0) : 0;
  const activationKind = sceneContext?.activationKind ?? null;

  // Only formal Scene arrival/departure changes own this lifecycle. Ordinary drag
  // progress updates and animation-prop rerenders do not stop or restart a pass.
  useEffect(() => {
    if (playbackKey <= 0) {
      resetToInitial();
      return;
    }
    startToken(playbackKey, activationKind);
  }, [activationKind, playbackKey, resetToInitial, startToken]);

  // Async parsing may settle after the Scene's token was minted. Consume the
  // pending token once, but never restart an already-running token on prop changes.
  useEffect(() => {
    const pendingToken = pendingTokenRef.current;
    if (pendingToken <= 0 || !parseReady) return;
    startToken(pendingToken, sceneContextRef.current?.activationKind ?? null);
  }, [enterVariant, parseReady, startToken]);

  useEffect(
    () => (): void => {
      stopPlayback();
      // React StrictMode replays effects without discarding refs. Release the
      // token claim so the replacement effect generation can re-arm the pass.
      activePlaybackTokenRef.current = 0;
      pendingTokenRef.current = 0;
    },
    [stopPlayback]
  );

  // Manual enter. Dropping the pending delay timer and starting the frozen pass
  // immediately is the whole contract: "interrupt" means play now, not re-wait.
  const triggerManualEnter = useCallback((): void => {
    const start = pendingManualStartRef.current;
    if (!start) {
      // No live pass to drive yet (Scene has not activated, or the pass already
      // self-started). Remember the request so the next token honours it.
      manualRequestedRef.current = true;
      return;
    }
    pendingManualStartRef.current = null;
    manualRequestedRef.current = false;
    if (delayTimerRef.current !== null) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }
    start();
  }, []);

  useEffect(() => {
    if (!enterRef || !enabled) return;
    enterRef.current = triggerManualEnter;
    return (): void => {
      if (enterRef.current === triggerManualEnter) enterRef.current = null;
    };
  }, [enabled, enterRef, triggerManualEnter]);

  const lanes = useAnimatedPropertyLanes(
    visualMotion,
    variantsRef,
    resolveArrivalPropertyValue,
    resolveArrivalNumericPropertyValue
  );

  return {
    style: lanes.style,
    visualMotion,
    phaseMotion,
    shouldRunInfinite,
    staticReveal,
  };
}
