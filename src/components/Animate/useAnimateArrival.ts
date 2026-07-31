import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { animate, type MotionValue, useMotionValue, useTransform } from 'framer-motion';
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

interface UseAnimateArrivalParams {
  enabled: boolean;
  sceneContext: SceneContextType | null;
  enterVariant: ParsedAnimationVariant | null;
  hasAuthoredEnterAnimation: boolean;
  parseReady: boolean;
  delay: number;
  enterDuration: number;
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
}

function useMixedValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{ initial: VariantRecord; animate: VariantRecord }>,
  property: AnimatableProperty
): MotionValue<number | string> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
    return lerpTransformValue(
      getVariantValue(variants.initial, property, getDefaultValue(property, 'initial')),
      getVariantValue(variants.animate, property, getDefaultValue(property, 'animate')),
      progress
    );
  });
}

function useNumericValue(
  visualMotion: MotionValue<number>,
  variantsRef: MutableRefObject<{ initial: VariantRecord; animate: VariantRecord }>,
  property: AnimatableProperty
): MotionValue<number> {
  return useTransform(visualMotion, (progress) => {
    const variants = variantsRef.current;
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
  });
}

/**
 * Real-time post-arrival driver for drag + timeline.sceneControlled=false.
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
}: UseAnimateArrivalParams): UseAnimateArrivalReturn {
  const variantsRef = useRef({
    initial: {} as VariantRecord,
    animate: {} as VariantRecord,
  });
  const latestConfigRef = useRef<ArrivalPlaybackConfig>({
    delay,
    enterDuration,
    hasAuthoredEnterAnimation,
    parseReady,
    enterVariant,
  });
  latestConfigRef.current = {
    delay,
    enterDuration,
    hasAuthoredEnterAnimation,
    parseReady,
    enterVariant,
  };

  const visualMotion = useMotionValue(hasAuthoredEnterAnimation ? 0 : 1);
  const phaseMotion = useMotionValue<AnimatePhase>(hasAuthoredEnterAnimation ? 'idle' : 'entered');
  const [shouldRunInfinite, setShouldRunInfinite] = useState(false);
  const [staticReveal, setStaticReveal] = useState(false);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePlaybackTokenRef = useRef(0);
  const pendingTokenRef = useRef(0);
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
    () => () => {
      stopPlayback();
      // React StrictMode replays effects without discarding refs. Release the
      // token claim so the replacement effect generation can re-arm the pass.
      activePlaybackTokenRef.current = 0;
      pendingTokenRef.current = 0;
    },
    [stopPlayback]
  );

  const opacity = useNumericValue(visualMotion, variantsRef, 'opacity');
  const x = useMixedValue(visualMotion, variantsRef, 'x');
  const y = useMixedValue(visualMotion, variantsRef, 'y');
  const scale = useNumericValue(visualMotion, variantsRef, 'scale');
  const rotate = useMixedValue(visualMotion, variantsRef, 'rotate');
  const rotateX = useMixedValue(visualMotion, variantsRef, 'rotateX');
  const rotateY = useMixedValue(visualMotion, variantsRef, 'rotateY');
  const skewX = useMixedValue(visualMotion, variantsRef, 'skewX');
  const skewY = useMixedValue(visualMotion, variantsRef, 'skewY');
  const filter = useMixedValue(visualMotion, variantsRef, 'filter');

  return {
    style: { opacity, x, y, scale, rotate, rotateX, rotateY, skewX, skewY, filter },
    visualMotion,
    phaseMotion,
    shouldRunInfinite,
    staticReveal,
  };
}
