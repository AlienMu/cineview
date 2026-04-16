/**
 * Slide 系列动画
 * 滑动效果
 */

import type { Variant } from 'framer-motion';

export const slideAnimations = {
  'slide-up': {
    initial: { y: '100%', opacity: 0 } as Variant,
    animate: { y: 0, opacity: 1 } as Variant,
    exit: { y: '-100%', opacity: 0 } as Variant,
  },
  'slide-down': {
    initial: { y: '-100%', opacity: 0 } as Variant,
    animate: { y: 0, opacity: 1 } as Variant,
    exit: { y: '100%', opacity: 0 } as Variant,
  },
  'slide-left': {
    initial: { x: '100%', opacity: 0 } as Variant,
    animate: { x: 0, opacity: 1 } as Variant,
    exit: { x: '-100%', opacity: 0 } as Variant,
  },
  'slide-right': {
    initial: { x: '-100%', opacity: 0 } as Variant,
    animate: { x: 0, opacity: 1 } as Variant,
    exit: { x: '100%', opacity: 0 } as Variant,
  },
};
