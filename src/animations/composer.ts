/**
 * Animation Composer
 * Handles composed animations with sequential and parallel execution
 */

import { parseAnimation } from './animationParser';
import { isPresetLoadError } from './presets';
import { devError } from '../utils/devLog';
import type { ComposedAnimation, CustomAnimation, ParsedAnimationVariant } from '../types';
import type { Variant } from 'framer-motion';

/**
 * Validate composed animation configuration
 */
export const validateComposedAnimation = (animation: ComposedAnimation): boolean => {
  if (!animation || typeof animation !== 'object') {
    return false;
  }

  if (!animation.mode || !['sequential', 'parallel'].includes(animation.mode)) {
    return false;
  }

  if (!Array.isArray(animation.animations) || animation.animations.length === 0) {
    return false;
  }

  return true;
};

/**
 * Merge multiple Variant objects (for initial/exit: static frames without timing orchestration)
 */
const mergeVariants = (variants: Variant[]): Variant => {
  const merged: Variant = {};

  variants.forEach((variant) => {
    Object.assign(merged, variant);
  });

  return merged;
};

// In sequential composition, if a child animation has no explicit transition.duration,
// use this duration (seconds) to calculate the next step's delay. Framer-motion's
// implicit duration depends on spring/default tween and cannot be read during composition,
// so we use 1s as a documented assumption; explicit durations (including 0) always use real values.
const DEFAULT_SEQUENTIAL_STEP_DURATION_S = 1;

/** Parsed child animation with original index: delays[] must correspond to author's written position, regardless of skipped invalid items. */
interface IndexedParsedAnimation {
  variant: ParsedAnimationVariant;
  sourceIndex: number;
}

/** An orchestration step: animate values (without transition key) + transition for this step. */
interface TimedVariantStep {
  values: Record<string, unknown>;
  transition: Record<string, unknown>;
}

const parseIndexedAnimations = async (
  animations: Array<string | CustomAnimation>
): Promise<IndexedParsedAnimation[]> => {
  const parsedAnimations: IndexedParsedAnimation[] = [];

  for (let i = 0; i < animations.length; i++) {
    const parsed = await parseAnimation(animations[i]);
    if (parsed) {
      parsedAnimations.push({ variant: parsed, sourceIndex: i });
    }
  }

  return parsedAnimations;
};

/** Extract animate values and transition (values don't retain the transition key). */
const splitAnimateVariant = (variant: ParsedAnimationVariant): TimedVariantStep => {
  const { transition, ...values } = variant.animate as Record<string, unknown>;
  return { values, transition: (transition as Record<string, unknown>) || {} };
};

/**
 * Merge multiple steps into a single animate variant, with transition using framer-motion's
 * per-value form (`transition: { opacity: {...}, y: {...} }`), so each property carries
 * the delay/duration from its own child animation. Plain Object.assign would treat `transition`
 * as a regular key with last-wins behavior → accumulated delays from all but the last item
 * are lost, breaking orchestration. Properties with the same name use last-wins, and their
 * transition follows the last writer, consistent with value semantics.
 * (drag/scroll scrub paths lerp values and ignore transition; this shape serves time-driven paths.)
 */
const mergeTimedVariants = (steps: TimedVariantStep[]): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  const perValueTransition: Record<string, unknown> = {};

  steps.forEach(({ values, transition }) => {
    Object.entries(values).forEach(([key, value]) => {
      merged[key] = value;
      perValueTransition[key] = transition;
    });
  });

  merged.transition = perValueTransition;
  return merged;
};

/**
 * Compose sequential animation
 */
const composeSequentialAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations = await parseIndexedAnimations(animations);

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in sequential composition');
  }

  const initial = parsedAnimations[0].variant.initial;
  const exit = parsedAnimations[parsedAnimations.length - 1].variant.exit;

  // Create animation sequence: each step's delay = sum of (duration + customDelay) of preceding steps + this step's customDelay
  let totalDelay = 0;
  const steps: TimedVariantStep[] = parsedAnimations.map(({ variant, sourceIndex }) => {
    const customDelay = delays[sourceIndex] || 0;
    const { values, transition } = splitAnimateVariant(variant);
    const stepTransition = {
      ...transition,
      delay: totalDelay + customDelay / 1000,
    };

    const duration =
      typeof transition.duration === 'number'
        ? transition.duration
        : DEFAULT_SEQUENTIAL_STEP_DURATION_S;
    totalDelay += duration + customDelay / 1000;

    return { values, transition: stepTransition };
  });

  return {
    initial,
    animate: mergeTimedVariants(steps),
    exit,
  };
};

/**
 * Compose parallel animation
 */
const composeParallelAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations = await parseIndexedAnimations(animations);

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in parallel composition');
  }

  const initialVariants = parsedAnimations.map(({ variant }) => variant.initial as Variant);
  const steps: TimedVariantStep[] = parsedAnimations.map(({ variant, sourceIndex }) => {
    const customDelay = delays[sourceIndex] || 0;
    const { values, transition } = splitAnimateVariant(variant);

    return {
      values,
      transition: {
        ...transition,
        delay: customDelay / 1000,
      },
    };
  });
  const exitVariants = parsedAnimations.map(({ variant }) => variant.exit as Variant);

  return {
    initial: mergeVariants(initialVariants) as Record<string, unknown>,
    animate: mergeTimedVariants(steps),
    exit: mergeVariants(exitVariants) as Record<string, unknown>,
  };
};

/**
 * Compose animation
 */
export const composeAnimation = async (
  animation: ComposedAnimation
): Promise<ParsedAnimationVariant | null> => {
  if (!validateComposedAnimation(animation)) {
    devError('Invalid composed animation configuration:', animation);
    return null;
  }

  try {
    const { mode, animations, delays = [] } = animation;

    if (mode === 'sequential') {
      return await composeSequentialAnimation(animations, delays);
    } else if (mode === 'parallel') {
      return await composeParallelAnimation(animations, delays);
    }

    return null;
  } catch (error) {
    if (isPresetLoadError(error)) {
      throw error;
    }
    devError('Failed to compose animation:', error);
    return null;
  }
};

/**
 * Parse animation (supports preset, custom, and composed)
 */
export const parseAnimationWithComposition = async (
  animation: string | CustomAnimation | ComposedAnimation
): Promise<ParsedAnimationVariant | null> => {
  if (typeof animation === 'object' && 'mode' in animation && 'animations' in animation) {
    return await composeAnimation(animation as ComposedAnimation);
  }

  return await parseAnimation(animation as string | CustomAnimation);
};
