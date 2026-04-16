/**
 * Animation Parser
 * 解析预设动画、自定义动画，并转换为 Framer Motion 格式
 */

import { getPresetAnimation, type PresetAnimationName } from './presets';
import type { CustomAnimation, ParsedAnimationVariant } from '../types';
import type { Variant } from 'framer-motion';

/**
 * 验证自定义动画配置
 */
export const validateCustomAnimation = (animation: CustomAnimation): boolean => {
  if (!animation || typeof animation !== 'object') {
    return false;
  }

  // 检查必需的 keyframes 字段
  if (!animation.keyframes || typeof animation.keyframes !== 'object') {
    return false;
  }

  // 检查 keyframes 至少有一个属性
  if (Object.keys(animation.keyframes).length === 0) {
    return false;
  }

  // 验证 duration（如果存在）
  if (animation.duration !== undefined && typeof animation.duration !== 'number') {
    return false;
  }

  // 验证 easing（如果存在）
  if (animation.easing !== undefined && typeof animation.easing !== 'string') {
    return false;
  }

  return true;
};

/**
 * 将 Web Animations API 格式转换为 Framer Motion Variant
 */
export const convertWebAnimationToVariant = (animation: CustomAnimation): Variant => {
  const { keyframes, duration = 1000, easing = 'ease', delay = 0 } = animation;

  // 转换 easing 名称
  const easingMap: Record<string, string> = {
    linear: 'linear',
    ease: 'easeInOut',
    'ease-in': 'easeIn',
    'ease-out': 'easeOut',
    'ease-in-out': 'easeInOut',
  };

  const framerEasing = easingMap[easing] || easing;

  // 构建 Framer Motion variant
  const variant: Record<string, unknown> = {
    ...keyframes,
    transition: {
      duration: duration / 1000, // 转换为秒
      ease: framerEasing,
      delay: delay / 1000,
    },
  };

  return variant as Variant;
};

/**
 * 解析预设动画名称
 */
export const parsePresetAnimation = async (
  name: string
): Promise<ParsedAnimationVariant | null> => {
  try {
    const presetAnim = await getPresetAnimation(name as PresetAnimationName);
    // getPresetAnimation 返回的是 PresetAnimation 对象（包含 initial, animate, exit）
    // 需要转换为 ParsedAnimationVariant
    return presetAnim as unknown as ParsedAnimationVariant;
  } catch (error) {
    console.error(`Failed to parse preset animation "${name}":`, error);
    return null;
  }
};

/**
 * 解析自定义动画
 */
export const parseCustomAnimation = (animation: CustomAnimation): ParsedAnimationVariant | null => {
  if (!validateCustomAnimation(animation)) {
    console.error('Invalid custom animation configuration:', animation);
    return null;
  }

  try {
    const variant = convertWebAnimationToVariant(animation);

    return {
      initial: { opacity: 0 },
      animate: variant as Record<string, unknown>,
      exit: { opacity: 0 },
    };
  } catch (error) {
    console.error('Failed to parse custom animation:', error);
    return null;
  }
};

/**
 * 解析动画（支持预设和自定义）
 */
export const parseAnimation = async (
  animation: string | CustomAnimation
): Promise<ParsedAnimationVariant | null> => {
  // 如果是字符串，解析为预设动画
  if (typeof animation === 'string') {
    return await parsePresetAnimation(animation);
  }

  // 如果是对象，解析为自定义动画
  if (typeof animation === 'object') {
    return parseCustomAnimation(animation);
  }

  console.warn('Invalid animation format:', animation);
  return null;
};

/**
 * 创建默认动画（当解析失败时使用）
 */
export const createDefaultAnimation = (): ParsedAnimationVariant => {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };
};
