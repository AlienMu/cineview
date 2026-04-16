/**
 * Fade 系列动画
 * 淡入淡出效果
 */

import type { Variant } from 'framer-motion';

export const fadeAnimations = {
  fade: {
    initial: { opacity: 0 } as Variant,
    animate: { opacity: 1 } as Variant,
    exit: { opacity: 0 } as Variant,
  },
  'fade-in': {
    initial: { opacity: 0 } as Variant,
    animate: { opacity: 1 } as Variant,
    exit: { opacity: 1 } as Variant,
  },
  'fade-out': {
    initial: { opacity: 1 } as Variant,
    animate: { opacity: 1 } as Variant,
    exit: { opacity: 0 } as Variant,
  },
};
