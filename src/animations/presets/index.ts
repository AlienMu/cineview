/**
 * 预设动画库索引
 * 支持按需加载
 */

import type { Variant } from 'framer-motion';
import { devWarn, devError } from '../../utils/devLog';

export interface PresetAnimation {
  initial: Variant;
  animate: Variant;
  exit: Variant;
}

export type PresetAnimationName =
  | 'fade'
  | 'fade-in'
  | 'fade-out'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'scale-up'
  | 'scale-down'
  | 'rotate'
  | 'rotate-in'
  | 'rotate-out'
  | 'spin'
  | 'flip'
  | 'flip-x'
  | 'flip-y'
  | 'bounce'
  | 'bounce-in'
  | 'bounce-out'
  | 'blink'
  | 'flash'
  | 'pulse'
  | 'shake'
  | 'shake-x'
  | 'shake-y'
  | 'vibrate'
  | 'jello'
  | 'blur-in'
  | 'blur-out'
  | 'focus-in'
  | 'elastic'
  | 'rubber-band'
  | 'wobble'
  | 'swing'
  | 'heartbeat'
  | 'tada'
  | 'wave'
  | 'roll-in'
  | 'roll-out'
  | 'hinge'
  | 'jack-in-the-box';

// 动画分类映射
const animationCategoryMap: Record<string, string> = {
  fade: 'fade',
  'fade-in': 'fade',
  'fade-out': 'fade',
  'slide-up': 'slide',
  'slide-down': 'slide',
  'slide-left': 'slide',
  'slide-right': 'slide',
  'zoom-in': 'zoom',
  'zoom-out': 'zoom',
  'scale-up': 'zoom',
  'scale-down': 'zoom',
  rotate: 'rotate',
  'rotate-in': 'rotate',
  'rotate-out': 'rotate',
  spin: 'rotate',
  flip: 'flip',
  'flip-x': 'flip',
  'flip-y': 'flip',
  bounce: 'bounce',
  'bounce-in': 'bounce',
  'bounce-out': 'bounce',
  blink: 'blink',
  flash: 'blink',
  pulse: 'blink',
  shake: 'shake',
  'shake-x': 'shake',
  'shake-y': 'shake',
  vibrate: 'shake',
  jello: 'shake',
  'blur-in': 'blur',
  'blur-out': 'blur',
  'focus-in': 'blur',
  elastic: 'elastic',
  'rubber-band': 'elastic',
  wobble: 'elastic',
  swing: 'elastic',
  heartbeat: 'special',
  tada: 'special',
  wave: 'special',
  'roll-in': 'special',
  'roll-out': 'special',
  hinge: 'special',
  'jack-in-the-box': 'special',
};

// 动画缓存
const animationCache = new Map<string, Record<string, PresetAnimation>>();

/**
 * 按需加载动画模块
 */
export const loadAnimationModule = async (
  category: string
): Promise<Record<string, PresetAnimation>> => {
  // 检查缓存
  if (animationCache.has(category)) {
    return animationCache.get(category)!;
  }

  // 动态导入
  let module: Record<string, PresetAnimation>;

  switch (category) {
    case 'fade':
      module = (await import('./fade')).fadeAnimations;
      break;
    case 'slide':
      module = (await import('./slide')).slideAnimations;
      break;
    case 'zoom':
      module = (await import('./zoom')).zoomAnimations;
      break;
    case 'rotate':
      module = (await import('./rotate')).rotateAnimations;
      break;
    case 'flip':
      module = (await import('./flip')).flipAnimations;
      break;
    case 'bounce':
      module = (await import('./bounce')).bounceAnimations;
      break;
    case 'blink':
      module = (await import('./blink')).blinkAnimations;
      break;
    case 'shake':
      module = (await import('./shake')).shakeAnimations;
      break;
    case 'blur':
      module = (await import('./blur')).blurAnimations;
      break;
    case 'elastic':
      module = (await import('./elastic')).elasticAnimations;
      break;
    case 'special':
      module = (await import('./special')).specialAnimations;
      break;
    default:
      throw new Error(`Unknown animation category: ${category}`);
  }

  // 缓存模块
  animationCache.set(category, module);
  return module;
};

/**
 * 获取预设动画
 */
export const getPresetAnimation = async (
  name: PresetAnimationName
): Promise<PresetAnimation | null> => {
  const category = animationCategoryMap[name];

  if (!category) {
    devWarn(`Unknown preset animation: ${name}`);
    return null;
  }

  try {
    const module = await loadAnimationModule(category);
    return module[name] || null;
  } catch (error) {
    devError(`Failed to load animation "${name}":`, error);
    return null;
  }
};

/**
 * 预加载动画分类
 */
export const preloadAnimationCategory = async (category: string): Promise<void> => {
  try {
    await loadAnimationModule(category);
  } catch (error) {
    devError(`Failed to preload animation category "${category}":`, error);
  }
};

/**
 * 预加载所有动画
 */
export const preloadAllAnimations = async (): Promise<void> => {
  const categories = [
    'fade',
    'slide',
    'zoom',
    'rotate',
    'flip',
    'bounce',
    'blink',
    'shake',
    'blur',
    'elastic',
    'special',
  ];

  await Promise.all(categories.map((category) => preloadAnimationCategory(category)));
};

/**
 * 清除动画缓存
 */
export const clearAnimationCache = (): void => {
  animationCache.clear();
};
