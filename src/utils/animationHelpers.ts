/**
 * Animation Helper Utilities
 * Shared utilities for animation parsing and interpolation
 */

import { parseAnimationWithComposition } from '../animations/composer';
import { isPresetLoadError } from '../animations/presets';
import type {
  CineViewErrorCode,
  ParsedAnimationVariant,
  CustomAnimation,
  ComposedAnimation,
} from '../types';
import type { PresetAnimation } from '../animations/presets';

export interface AnimationParseFailure {
  code: Extract<CineViewErrorCode, 'INVALID_ANIMATION' | 'ANIMATION_ASSET_LOAD_FAILED'>;
  message: string;
  context: Record<string, unknown>;
}

/**
 * Parse animation with error handling
 */
export async function parseAnimationSafely(
  animation: string | CustomAnimation | ComposedAnimation | undefined,
  componentId: string,
  animationType: 'enter' | 'exit' | 'loop',
  onFailure?: (failure: AnimationParseFailure) => void
): Promise<ParsedAnimationVariant | PresetAnimation | null> {
  if (!animation) return null;

  try {
    const parsed = await parseAnimationWithComposition(animation);
    if (parsed) return parsed;

    const message = `Failed to parse ${animationType} animation for "${componentId}".`;
    onFailure?.({
      code: 'INVALID_ANIMATION',
      message,
      context: { componentId, animationType, animation },
    });
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `[CineView Error] ${message}\n\n` +
          `Problem: The ${animationType}Animation configuration is invalid or malformed.\n` +
          `Fix: Ensure your animation is one of:\n` +
          `  1. A valid preset animation name (e.g., 'fade-in', 'slide-up')\n` +
          `  2. A custom animation with valid initial/animate/exit variant fields\n` +
          `  3. A composed animation with valid structure`
      );
    }
  } catch (error) {
    const failure: AnimationParseFailure = isPresetLoadError(error)
      ? {
          code: error.code,
          message: error.message,
          context: {
            componentId,
            animationType,
            animation,
            category: error.category,
            presetName: error.presetName,
          },
        }
      : {
          code: 'INVALID_ANIMATION',
          message: `Error parsing ${animationType} animation for "${componentId}".`,
          context: { componentId, animationType, animation },
        };
    onFailure?.(failure);
    if (process.env.NODE_ENV === 'development') {
      console.error(`[CineView Error] ${failure.message}`, error);
    }
  }

  return null;
}

/**
 * Multi-token strings (space-separated, non-transform functions like transformOrigin '50% 100%')
 * cannot use parseFloat single-value interpolation — that would collapse to a single value like '50%'
 * and change semantics. Transform function strings (containing '(') still use the existing
 * function-parameter interpolation branch.
 */
function isMultiTokenString(value: unknown): boolean {
  return typeof value === 'string' && !value.includes('(') && value.trim().includes(' ');
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

  // Merge all keys (union of start and end)
  const allKeys = new Set([...Object.keys(start), ...Object.keys(end)]);

  allKeys.forEach((key) => {
    if (key === 'transition') return;

    const startVal = start[key];
    const endVal = end[key];

    // If end doesn't have this key, use start's value
    if (endVal === undefined) {
      result[key] = startVal;
      return;
    }

    // Equal endpoints: no interpolation needed. This also prevents parseFloat collapse
    // for multi-token strings (e.g., transformOrigin '50% 100%' collapsing to '50%').
    if (startVal === endVal) {
      result[key] = endVal;
      return;
    }

    // If start doesn't have this key, set default value based on type
    const effectiveStartVal =
      startVal !== undefined
        ? startVal
        : key === 'opacity'
          ? 1
          : typeof endVal === 'number'
            ? 0
            : '0';

    // Unequal multi-token strings cannot use single-value interpolation either:
    // degrade to 0.5 threshold switching to avoid format/semantic collapse like '50% 0%' → '50%'.
    if (isMultiTokenString(effectiveStartVal) || isMultiTokenString(endVal)) {
      result[key] = progress > 0.5 ? endVal : effectiveStartVal;
      return;
    }

    // Handle number types
    if (typeof endVal === 'number' && typeof effectiveStartVal === 'number') {
      result[key] = effectiveStartVal + (endVal - effectiveStartVal) * progress;
      return;
    }

    // Handle number-to-string conversion (e.g., y: 0 to y: '100%')
    if (typeof effectiveStartVal === 'number' && typeof endVal === 'string') {
      if (endVal.includes('px')) {
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${effectiveStartVal + (endNum - effectiveStartVal) * progress}px`;
        return;
      }
      if (endVal.includes('%')) {
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${effectiveStartVal + (endNum - effectiveStartVal) * progress}%`;
        return;
      }
      if (endVal.includes('deg')) {
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${effectiveStartVal + (endNum - effectiveStartVal) * progress}deg`;
        return;
      }
    }

    // Handle string-to-number conversion (e.g., y: '100%' to y: 0)
    if (typeof effectiveStartVal === 'string' && typeof endVal === 'number') {
      if (effectiveStartVal.includes('px')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        result[key] = `${startNum + (endVal - startNum) * progress}px`;
        return;
      }
      if (effectiveStartVal.includes('%')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        result[key] = `${startNum + (endVal - startNum) * progress}%`;
        return;
      }
      if (effectiveStartVal.includes('deg')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        result[key] = `${startNum + (endVal - startNum) * progress}deg`;
        return;
      }
    }

    // Handle string types
    if (typeof endVal === 'string' && typeof effectiveStartVal === 'string') {
      // Handle px units
      if (endVal.includes('px') || effectiveStartVal.includes('px')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}px`;
        return;
      }

      // Handle % units
      if (endVal.includes('%') || effectiveStartVal.includes('%')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}%`;
        return;
      }

      // Handle deg units (rotation)
      if (endVal.includes('deg') || effectiveStartVal.includes('deg')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}deg`;
        return;
      }

      // Handle transform functions (e.g., translateY(100%), scale(1.5), etc.)
      if (
        (endVal.includes('(') && endVal.includes(')')) ||
        (effectiveStartVal.includes('(') && effectiveStartVal.includes(')'))
      ) {
        const startMatch = String(effectiveStartVal).match(/([a-zA-Z]+)\(([^)]+)\)/);
        const endMatch = endVal.match(/([a-zA-Z]+)\(([^)]+)\)/);

        if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
          const funcName = startMatch[1];
          const startValue = startMatch[2];
          const endValue = endMatch[2];

          // Handle numeric values. Transform parameters reaching here must be unitless
          // (strings with px/%/deg are already intercepted and returned by unit branches above),
          // so this only produces unitless output.
          if (!isNaN(parseFloat(startValue)) && !isNaN(parseFloat(endValue))) {
            const startNum = parseFloat(startValue);
            const endNum = parseFloat(endValue);
            const interpolated = startNum + (endNum - startNum) * progress;
            result[key] = `${funcName}(${interpolated})`;
            return;
          }
        }
      }
    }

    // Default: use threshold switching
    result[key] = progress > 0.5 ? endVal : effectiveStartVal;
  });

  return result;
}
