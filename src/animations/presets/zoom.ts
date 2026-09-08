/**
 * Zoom/Scale animation presets
 * Scaling effects
 */

import type { Variant } from 'framer-motion';

export const zoomAnimations = {
  'zoom-in': {
    initial: { scale: 0, opacity: 0 } as Variant,
    animate: { scale: 1, opacity: 1 } as Variant,
    exit: { scale: 0, opacity: 0 } as Variant,
  },
  'zoom-out': {
    initial: { scale: 1.5, opacity: 0 } as Variant,
    animate: { scale: 1, opacity: 1 } as Variant,
    exit: { scale: 1.5, opacity: 0 } as Variant,
  },
  'scale-up': {
    initial: { scale: 0.5, opacity: 0 } as Variant,
    animate: { scale: 1, opacity: 1 } as Variant,
    exit: { scale: 1.5, opacity: 0 } as Variant,
  },
  'scale-down': {
    initial: { scale: 1.5, opacity: 0 } as Variant,
    animate: { scale: 1, opacity: 1 } as Variant,
    exit: { scale: 0.5, opacity: 0 } as Variant,
  },
};
