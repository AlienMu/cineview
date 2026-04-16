/**
 * Animation Composer
 * 组合动画处理器，支持顺序和并行执行
 */

import { parseAnimation } from './animationParser';
import type { ComposedAnimation, CustomAnimation, ParsedAnimationVariant } from '../types';
import type { Variant } from 'framer-motion';

/**
 * 验证组合动画配置
 */
export const validateComposedAnimation = (animation: ComposedAnimation): boolean => {
  if (!animation || typeof animation !== 'object') {
    return false;
  }

  // 检查 mode
  if (!animation.mode || !['sequential', 'parallel'].includes(animation.mode)) {
    return false;
  }

  // 检查 animations 数组
  if (!Array.isArray(animation.animations) || animation.animations.length === 0) {
    return false;
  }

  return true;
};

/**
 * 合并多个 Variant 对象
 */
const mergeVariants = (variants: Variant[]): Variant => {
  const merged: Variant = {};

  variants.forEach((variant) => {
    Object.assign(merged, variant);
  });

  return merged;
};

/**
 * 处理顺序执行的组合动画
 */
const composeSequentialAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations: ParsedAnimationVariant[] = [];
  let totalDelay = 0;

  // 解析所有动画
  for (let i = 0; i < animations.length; i++) {
    const animation = animations[i];
    const parsed = await parseAnimation(animation);

    if (parsed) {
      parsedAnimations.push(parsed);
    }
  }

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in sequential composition');
  }

  // 构建顺序动画
  const initial = parsedAnimations[0].initial;
  const exit = parsedAnimations[parsedAnimations.length - 1].exit;

  // 创建动画序列
  const animateVariants: Variant[] = [];

  parsedAnimations.forEach((anim, index) => {
    const customDelay = delays[index] || 0;
    const animateObj = anim.animate as Record<string, unknown>;
    const transition = (animateObj.transition as Record<string, unknown>) || {};

    const variant = {
      ...animateObj,
      transition: {
        ...transition,
        delay: totalDelay + customDelay / 1000,
      },
    };

    animateVariants.push(variant);

    // 累加延迟（假设每个动画默认 1 秒）
    const duration = (transition.duration as number) || 1;
    totalDelay += duration + customDelay / 1000;
  });

  // 合并所有动画变体
  const animate = mergeVariants(animateVariants);

  return {
    initial,
    animate: animate as Record<string, unknown>,
    exit,
  };
};

/**
 * 处理并行执行的组合动画
 */
const composeParallelAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations: ParsedAnimationVariant[] = [];

  // 解析所有动画
  for (let i = 0; i < animations.length; i++) {
    const animation = animations[i];
    const parsed = await parseAnimation(animation);

    if (parsed) {
      parsedAnimations.push(parsed);
    }
  }

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in parallel composition');
  }

  // 合并所有动画的 initial、animate、exit
  const initialVariants = parsedAnimations.map((anim) => anim.initial as Variant);
  const animateVariants = parsedAnimations.map((anim, index) => {
    const customDelay = delays[index] || 0;
    const animateObj = anim.animate as Record<string, unknown>;
    const transition = (animateObj.transition as Record<string, unknown>) || {};

    return {
      ...animateObj,
      transition: {
        ...transition,
        delay: customDelay / 1000,
      },
    };
  });
  const exitVariants = parsedAnimations.map((anim) => anim.exit as Variant);

  return {
    initial: mergeVariants(initialVariants) as Record<string, unknown>,
    animate: mergeVariants(animateVariants) as Record<string, unknown>,
    exit: mergeVariants(exitVariants) as Record<string, unknown>,
  };
};

/**
 * 组合动画
 */
export const composeAnimation = async (
  animation: ComposedAnimation
): Promise<ParsedAnimationVariant | null> => {
  if (!validateComposedAnimation(animation)) {
    console.error('Invalid composed animation configuration:', animation);
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
    console.error('Failed to compose animation:', error);
    return null;
  }
};

/**
 * 解析动画（支持预设、自定义、组合）
 */
export const parseAnimationWithComposition = async (
  animation: string | CustomAnimation | ComposedAnimation
): Promise<ParsedAnimationVariant | null> => {
  // 检查是否为组合动画
  if (typeof animation === 'object' && 'mode' in animation && 'animations' in animation) {
    return await composeAnimation(animation as ComposedAnimation);
  }

  // 否则使用普通解析
  return await parseAnimation(animation as string | CustomAnimation);
};
