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
  animationType: 'enter' | 'exit' | 'infinite',
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
 * 多值字符串(空格分隔且非 transform 函数,如 transformOrigin '50% 100%')无法用
 * parseFloat 单值插值——那会坍缩成 '50%' 之类的单值并改变语义。transform 函数串
 * (含 '(')仍走原有的函数参数插值分支。
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

    // 相等端点原样返回:根本无需插值。这同时挡住多值字符串在下方数值分支里的
    // parseFloat 坍缩(如 transformOrigin '50% 100%' 被坍缩成 '50%')。
    if (startVal === endVal) {
      result[key] = endVal;
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

    // 端点不等的多值字符串同样无法单值插值:退化为 0.5 阈值切换,
    // 避免 '50% 0%' → '50%' 这类格式/语义坍缩。
    if (isMultiTokenString(effectiveStartVal) || isMultiTokenString(endVal)) {
      result[key] = progress > 0.5 ? endVal : effectiveStartVal;
      return;
    }

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

          // 处理数字值。能走到这里的 transform 参数必为无单位（含 px/%/deg
          // 的字符串已被上方单位分支拦截并 return），所以这里只产出无单位形式。
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

    // 默认：使用阈值切换
    result[key] = progress > 0.5 ? endVal : effectiveStartVal;
  });

  return result;
}
