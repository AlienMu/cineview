/**
 * Flip animation presets
 * Rotation effects on X and Y axes
 */

import type { Variant } from 'framer-motion';

export const flipAnimations = {
  flip: {
    initial: { rotateY: -180, opacity: 0 } as Variant,
    animate: { rotateY: 0, opacity: 1 } as Variant,
    exit: { rotateY: 180, opacity: 0 } as Variant,
  },
  'flip-x': {
    initial: { rotateX: -180, opacity: 0 } as Variant,
    animate: { rotateX: 0, opacity: 1 } as Variant,
    exit: { rotateX: 180, opacity: 0 } as Variant,
  },
  'flip-y': {
    initial: { rotateY: -180, opacity: 0 } as Variant,
    animate: { rotateY: 0, opacity: 1 } as Variant,
    exit: { rotateY: 180, opacity: 0 } as Variant,
  },
};
