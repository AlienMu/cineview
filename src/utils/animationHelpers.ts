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
          `  2. A custom animation with valid initial/animate/exit variant fields\n` +
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

  // 合并所有键（start 和 end 的并集）
  const allKeys = new Set([...Object.keys(start), ...Object.keys(end)]);

  allKeys.forEach((key) => {
    if (key === 'transition') return;

    const startVal = start[key];
    const endVal = end[key];

    // 如果 end 没有这个键，使用 start 的值
    if (endVal === undefined) {
      result[key] = startVal;
      return;
    }

    // 如果 start 没有这个键，根据类型设置默认值
    const effectiveStartVal =
      startVal !== undefined
        ? startVal
        : key === 'opacity'
          ? 1
          : typeof endVal === 'number'
            ? 0
            : '0';

    // 处理数字类型
    if (typeof endVal === 'number' && typeof effectiveStartVal === 'number') {
      result[key] = effectiveStartVal + (endVal - effectiveStartVal) * progress;
      return;
    }

    // 处理数字到字符串的转换（例如 y: 0 到 y: '100%'）
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

    // 处理字符串到数字的转换（例如 y: '100%' 到 y: 0）
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

    // 处理字符串类型
    if (typeof endVal === 'string' && typeof effectiveStartVal === 'string') {
      // 处理 px 单位
      if (endVal.includes('px') || effectiveStartVal.includes('px')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}px`;
        return;
      }

      // 处理 % 单位
      if (endVal.includes('%') || effectiveStartVal.includes('%')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}%`;
        return;
      }

      // 处理 deg 单位（旋转）
      if (endVal.includes('deg') || effectiveStartVal.includes('deg')) {
        const startNum = parseFloat(effectiveStartVal) || 0;
        const endNum = parseFloat(endVal) || 0;
        result[key] = `${startNum + (endNum - startNum) * progress}deg`;
        return;
      }

      // 处理 transform 函数（如 translateY(100%), scale(1.5) 等）
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

          // 处理数字值
          if (!isNaN(parseFloat(startValue)) && !isNaN(parseFloat(endValue))) {
            const startNum = parseFloat(startValue);
            const endNum = parseFloat(endValue);
            const interpolated = startNum + (endNum - startNum) * progress;

            // 保留单位
            if (endValue.includes('px') || startValue.includes('px')) {
              result[key] = `${funcName}(${interpolated}px)`;
            } else if (endValue.includes('%') || startValue.includes('%')) {
              result[key] = `${funcName}(${interpolated}%)`;
            } else if (endValue.includes('deg') || startValue.includes('deg')) {
              result[key] = `${funcName}(${interpolated}deg)`;
            } else {
              result[key] = `${funcName}(${interpolated})`;
            }
            return;
          }
        }
      }
    }

    // 默认：使用阈值切换
    result[key] = progress > 0.5 ? endVal : effectiveStartVal;
  });

  return result;
}
