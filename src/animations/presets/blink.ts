/**
 * Blink/Flash/Pulse 系列动画
 * 闪烁、闪光、脉冲效果
 */

import type { Variant } from 'framer-motion';

export const blinkAnimations = {
  blink: {
    initial: { opacity: 1 } as Variant,
    animate: {
      opacity: [1, 0, 1, 0, 1],
      transition: {
        duration: 1,
        times: [0, 0.25, 0.5, 0.75, 1],
      },
    } as Variant,
    exit: { opacity: 0 } as Variant,
  },
  flash: {
    initial: { opacity: 0 } as Variant,
    animate: {
      opacity: [0, 1, 0, 1],
      transition: {
        duration: 0.8,
        times: [0, 0.25, 0.5, 1],
      },
    } as Variant,
    exit: { opacity: 0 } as Variant,
  },
  pulse: {
    initial: { scale: 1, opacity: 1 } as Variant,
    animate: {
      scale: [1, 1.05, 1],
      opacity: [1, 0.8, 1],
      transition: {
        duration: 1,
        times: [0, 0.5, 1],
      },
    } as Variant,
    exit: { scale: 1, opacity: 0 } as Variant,
  },
};
