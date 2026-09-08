/**
 * Animation Parser
 * Parses preset and custom animations, converting them to Framer Motion format
 */

import { getPresetAnimation } from './presets';
import { devError, devWarn } from '../utils/devLog';
import type { CustomAnimation, ParsedAnimationVariant } from '../types';

const TRANSFORM_ORIGIN_X_MAP: Record<string, string> = {
  left: '0%',
  center: '50%',
  right: '100%',
};

const TRANSFORM_ORIGIN_Y_MAP: Record<string, string> = {
  top: '0%',
  center: '50%',
  bottom: '100%',
};

const TRANSFORM_ORIGIN_COMBO_MAP: Record<string, string> = {
  center: '50% 50%',
  'top center': '50% 0%',
  'center top': '50% 0%',
  'bottom center': '50% 100%',
  'center bottom': '50% 100%',
  'top left': '0% 0%',
  'left top': '0% 0%',
  'top right': '100% 0%',
  'right top': '100% 0%',
  'bottom left': '0% 100%',
  'left bottom': '0% 100%',
  'bottom right': '100% 100%',
  'right bottom': '100% 100%',
  'center left': '0% 50%',
  'left center': '0% 50%',
  'center right': '100% 50%',
  'right center': '100% 50%',
};

function normalizeTransformOriginValue(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const comboMatch = TRANSFORM_ORIGIN_COMBO_MAP[normalized];
  if (comboMatch) {
    return comboMatch;
  }

  const parts = normalized.split(' ');
  if (parts.length === 1) {
    const xToken = TRANSFORM_ORIGIN_X_MAP[parts[0]];
    const yToken = TRANSFORM_ORIGIN_Y_MAP[parts[0]];

    if (xToken && yToken) {
      return `${xToken} ${yToken}`;
    }
    if (xToken) {
      return `${xToken} 50%`;
    }
    if (yToken) {
      return `50% ${yToken}`;
    }
    return value;
  }

  if (parts.length === 2) {
    const [first, second] = parts;
    const xToken = TRANSFORM_ORIGIN_X_MAP[first] ?? TRANSFORM_ORIGIN_X_MAP[second];
    const yToken = TRANSFORM_ORIGIN_Y_MAP[first] ?? TRANSFORM_ORIGIN_Y_MAP[second];

    if (xToken && yToken) {
      return `${xToken} ${yToken}`;
    }
  }

  return value;
}

function normalizeVariantValue(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeVariantValue(key, item));
  }

  if (value && typeof value === 'object') {
    return normalizeVariantRecord(value as Record<string, unknown>);
  }

  if (key === 'transformOrigin' && typeof value === 'string') {
    return normalizeTransformOriginValue(value);
  }

  return value;
}

function normalizeVariantRecord(record: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  Object.entries(record).forEach(([key, value]) => {
    normalized[key] = normalizeVariantValue(key, value);
  });

  return normalized;
}

export function normalizeParsedAnimationVariant(
  variant: ParsedAnimationVariant
): ParsedAnimationVariant {
  return {
    initial: normalizeVariantRecord((variant.initial as Record<string, unknown>) || {}),
    animate: normalizeVariantRecord((variant.animate as Record<string, unknown>) || {}),
    exit: normalizeVariantRecord((variant.exit as Record<string, unknown>) || {}),
  };
}

export const validateCustomAnimation = (animation: CustomAnimation): boolean => {
  if (!animation || typeof animation !== 'object') {
    return false;
  }

  const allowedKeys = new Set(['initial', 'animate', 'exit']);
  const entries = Object.entries(animation);
  if (entries.length === 0) {
    return false;
  }

  if (entries.some(([key]) => !allowedKeys.has(key))) {
    return false;
  }

  return entries.some(([, value]) => {
    return (
      value !== undefined &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0
    );
  });
};

/**
 * Normalize a CustomAnimation into a Framer Motion variant subset.
 */
export const normalizeCustomAnimationVariant = (
  animation: CustomAnimation
): ParsedAnimationVariant => {
  return normalizeParsedAnimationVariant({
    initial: animation.initial ?? {},
    animate: animation.animate ?? {},
    exit: animation.exit ?? {},
  });
};

export const convertWebAnimationToVariant = normalizeCustomAnimationVariant;

/**
 * Parse preset animation by name
 */
export const parsePresetAnimation = async (name: string): Promise<ParsedAnimationVariant> => {
  const presetAnim = await getPresetAnimation(name);
  return normalizeParsedAnimationVariant(presetAnim as unknown as ParsedAnimationVariant);
};

/**
 * Parse custom animation
 */
export const parseCustomAnimation = (animation: CustomAnimation): ParsedAnimationVariant | null => {
  if (!validateCustomAnimation(animation)) {
    devError('Invalid custom animation configuration:', animation);
    return null;
  }

  try {
    return normalizeCustomAnimationVariant(animation);
  } catch (error) {
    devError('Failed to parse custom animation:', error);
    return null;
  }
};

/**
 * Parse animation (supports both preset and custom)
 */
export const parseAnimation = async (
  animation: string | CustomAnimation
): Promise<ParsedAnimationVariant | null> => {
  // If string, parse as preset animation
  if (typeof animation === 'string') {
    return await parsePresetAnimation(animation);
  }

  // If object, parse as custom animation
  if (typeof animation === 'object') {
    return parseCustomAnimation(animation);
  }

  devWarn('Invalid animation format:', animation);
  return null;
};

/**
 * Create default animation (fallback when parsing fails)
 */
export const createDefaultAnimation = (): ParsedAnimationVariant => {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
};
