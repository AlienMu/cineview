/**
 * Animation Composer
 * 组合动画处理器，支持顺序和并行执行
 */

import { parseAnimation } from './animationParser';
import { isPresetLoadError } from './presets';
import { devError } from '../utils/devLog';
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
 * 合并多个 Variant 对象（用于 initial / exit：不携带时间编排的静态帧）
 */
const mergeVariants = (variants: Variant[]): Variant => {
  const merged: Variant = {};

  variants.forEach((variant) => {
    Object.assign(merged, variant);
  });

  return merged;
};

// 顺序编排中,子动画若未声明 transition.duration,按此时长(秒)累计下一步的起始
// delay。framer-motion 的隐式时长由弹簧/默认 tween 决定,编排期无法读出,故取 1s
// 作为文档化假设;显式声明的 duration(含 0)一律用真实值。
const DEFAULT_SEQUENTIAL_STEP_DURATION_S = 1;

/** 解析后带原始下标的子动画:delays[] 必须按作者书写位置对应,与无效项被跳过无关。 */
interface IndexedParsedAnimation {
  variant: ParsedAnimationVariant;
  sourceIndex: number;
}

/** 一个编排步骤:animate 的值(不含 transition 键)+ 该步骤自己的 transition。 */
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

/** 拆出 animate 的值与 transition(值里不保留 transition 键)。 */
const splitAnimateVariant = (variant: ParsedAnimationVariant): TimedVariantStep => {
  const { transition, ...values } = variant.animate as Record<string, unknown>;
  return { values, transition: (transition as Record<string, unknown>) || {} };
};

/**
 * 把多个步骤合并成单个 animate variant,transition 采用 framer-motion 的
 * per-value 形式(`transition: { opacity: {...}, y: {...} }`),让每个属性携带
 * 自己所属子动画的 delay/duration。普通 Object.assign 合并会让 `transition`
 * 作为普通键 last-wins → 除最后一项外逐步累计的 delay 全部丢失,编排失效。
 * 同名属性 last-wins,其 transition 也随之取最后写入者,与值语义一致。
 * (drag/scroll scrub 路径按值 lerp、忽略 transition;本形状服务时间驱动路径。)
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
 * 处理顺序执行的组合动画
 */
const composeSequentialAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations = await parseIndexedAnimations(animations);

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in sequential composition');
  }

  // 构建顺序动画
  const initial = parsedAnimations[0].variant.initial;
  const exit = parsedAnimations[parsedAnimations.length - 1].variant.exit;

  // 创建动画序列:每步的 delay = 前序步骤(duration + customDelay)之和 + 本步 customDelay
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
 * 处理并行执行的组合动画
 */
const composeParallelAnimation = async (
  animations: Array<string | CustomAnimation>,
  delays: number[] = []
): Promise<ParsedAnimationVariant> => {
  const parsedAnimations = await parseIndexedAnimations(animations);

  if (parsedAnimations.length === 0) {
    throw new Error('No valid animations in parallel composition');
  }

  // 合并所有动画的 initial、animate、exit
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
 * 组合动画
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
