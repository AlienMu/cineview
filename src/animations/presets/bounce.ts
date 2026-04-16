/**
 * Bounce 系列动画
 * 弹跳效果
 */

import type { Variant } from 'framer-motion';

export const bounceAnimations = {
  bounce: {
    initial: { y: -100, opacity: 0 } as Variant,
    animate: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        bounce: 0.5,
        duration: 0.8,
      },
    } as Variant,
    exit: { y: 100, opacity: 0 } as Variant,
  },
  'bounce-in': {
    initial: { scale: 0, opacity: 0 } as Variant,
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        bounce: 0.6,
        duration: 0.8,
      },
    } as Variant,
    exit: { scale: 1, opacity: 1 } as Variant,
  },
  'bounce-out': {
    initial: { scale: 1, opacity: 1 } as Variant,
    animate: { scale: 1, opacity: 1 } as Variant,
    exit: {
      scale: 0,
      opacity: 0,
      transition: {
        type: 'spring',
        bounce: 0.6,
        duration: 0.6,
      },
    } as Variant,
  },
};
