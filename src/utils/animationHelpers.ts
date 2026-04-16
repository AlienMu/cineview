/**
 * Animation Helper Utilities
 * Shared utilities for animation parsing and interpolation
 */

import { parseAnimationWithComposition } from '../animations/composer';
import type { ParsedAnimationVariant, CustomAnimation, ComposedAnimation } from '../types';
import type { PresetAnimation } from '../animations/presets';

/**
 * Parse animation with error handling
 */
export async function parseAnimationSafely(
  animation: string | CustomAnimation | ComposedAnimation | undefined,
  componentId: string,
  animationType: 'enter' | 'exit' | 'infinite'
): Promise<ParsedAnimationVariant | PresetAnimation | null> {
  if (!animation) return null;

  try {
    const parsed = await parseAnimationWithComposition(animation);
    if (parsed) {
      return parsed;
    } else if (process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Failed to parse ${animationType} animation for "${componentId}".\n\n` +
          `Problem: The ${animationType}Animation configuration is invalid or malformed.\n` +
          `Fix: Ensure your animation is one of:\n` +
          `  1. A valid preset animation name (e.g., 'fade-in', 'slide-up')\n` +
          `  2. A custom animation with valid keyframes and options\n` +
          `  3. A composed animation with valid structure`
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] Error parsing ${animationType} animation for "${componentId}":`,
        error
      );
    }
  }

  return null;
}

/**
 * Interpolate between two animation variants based on progress
 */
export function interpolateVariant(
  start: Record<string, unknown>,
  end: Record<string, unknown>,
  progress: number
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  Object.keys(end).forEach((key) => {
    if (key === 'transition') return;

    const startVal = start[key] ?? (key === 'opacity' ? 1 : 0);
    const endVal = end[key];

    if (typeof endVal === 'number' && typeof startVal === 'number') {
      result[key] = startVal + (endVal - startVal) * progress;
    } else if (typeof endVal === 'string' && endVal.includes('px')) {
      const startNum = parseFloat(String(startVal)) || 0;
      const endNum = parseFloat(endVal) || 0;
      result[key] = `${startNum + (endNum - startNum) * progress}px`;
    } else {
      result[key] = progress > 0.5 ? endVal : startVal;
    }
  });

  return result;
}
