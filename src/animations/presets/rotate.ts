/**
 * Rotate/Spin animation presets
 * Rotation effects
 */

import type { Variant } from 'framer-motion';

export const rotateAnimations = {
  rotate: {
    initial: { rotate: -180, opacity: 0 } as Variant,
    animate: { rotate: 0, opacity: 1 } as Variant,
    exit: { rotate: 180, opacity: 0 } as Variant,
  },
  'rotate-in': {
    initial: { rotate: -180, scale: 0, opacity: 0 } as Variant,
    animate: { rotate: 0, scale: 1, opacity: 1 } as Variant,
    exit: { rotate: 0, scale: 1, opacity: 1 } as Variant,
  },
  'rotate-out': {
    initial: { rotate: 0, scale: 1, opacity: 1 } as Variant,
    animate: { rotate: 0, scale: 1, opacity: 1 } as Variant,
    exit: { rotate: 180, scale: 0, opacity: 0 } as Variant,
  },
  spin: {
    initial: { rotate: 0, opacity: 0 } as Variant,
    animate: { rotate: 360, opacity: 1 } as Variant,
    exit: { rotate: 720, opacity: 0 } as Variant,
  },
};
