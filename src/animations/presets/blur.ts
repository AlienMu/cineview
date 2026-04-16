/**
 * Blur/Focus 系列动画
 * 模糊、聚焦效果
 */

import type { Variant } from 'framer-motion';

export const blurAnimations = {
  'blur-in': {
    initial: { filter: 'blur(10px)', opacity: 0 } as Variant,
    animate: { filter: 'blur(0px)', opacity: 1 } as Variant,
    exit: { filter: 'blur(0px)', opacity: 1 } as Variant,
  },
  'blur-out': {
    initial: { filter: 'blur(0px)', opacity: 1 } as Variant,
    animate: { filter: 'blur(0px)', opacity: 1 } as Variant,
    exit: { filter: 'blur(10px)', opacity: 0 } as Variant,
  },
  'focus-in': {
    initial: { filter: 'blur(20px)', scale: 0.8, opacity: 0 } as Variant,
    animate: { filter: 'blur(0px)', scale: 1, opacity: 1 } as Variant,
    exit: { filter: 'blur(0px)', scale: 1, opacity: 1 } as Variant,
  },
};
