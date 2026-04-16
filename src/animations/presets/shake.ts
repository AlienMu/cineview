/**
 * Shake/Vibrate/Jello 系列动画
 * 抖动、震动、果冻效果
 */

import type { Variant } from 'framer-motion';

export const shakeAnimations = {
  shake: {
    initial: { x: 0 } as Variant,
    animate: {
      x: [0, -10, 10, -10, 10, 0],
      transition: {
        duration: 0.6,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
    exit: { x: 0, opacity: 0 } as Variant,
  },
  'shake-x': {
    initial: { x: 0 } as Variant,
    animate: {
      x: [0, -15, 15, -15, 15, 0],
      transition: {
        duration: 0.8,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
    exit: { x: 0, opacity: 0 } as Variant,
  },
  'shake-y': {
    initial: { y: 0 } as Variant,
    animate: {
      y: [0, -15, 15, -15, 15, 0],
      transition: {
        duration: 0.8,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
    exit: { y: 0, opacity: 0 } as Variant,
  },
  vibrate: {
    initial: { x: 0, y: 0 } as Variant,
    animate: {
      x: [0, -2, 2, -2, 2, 0],
      y: [0, -2, 2, -2, 2, 0],
      transition: {
        duration: 0.4,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
    exit: { x: 0, y: 0, opacity: 0 } as Variant,
  },
  jello: {
    initial: { skewX: 0, skewY: 0 } as Variant,
    animate: {
      skewX: [0, -12.5, 6.25, -3.125, 1.5625, 0],
      skewY: [0, -12.5, 6.25, -3.125, 1.5625, 0],
      transition: {
        duration: 1,
        times: [0, 0.222, 0.444, 0.666, 0.888, 1],
      },
    } as Variant,
    exit: { skewX: 0, skewY: 0, opacity: 0 } as Variant,
  },
};
