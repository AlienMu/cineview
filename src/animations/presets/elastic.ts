/**
 * Elastic animation presets
 * Spring, rubber-band, and swing effects
 */

import type { Variant } from 'framer-motion';

export const elasticAnimations = {
  elastic: {
    initial: { scale: 0, opacity: 0 } as Variant,
    animate: {
      scale: 1,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 10,
      },
    } as Variant,
    exit: { scale: 0, opacity: 0 } as Variant,
  },
  'rubber-band': {
    initial: { scale: 1 } as Variant,
    animate: {
      scale: [1, 1.25, 0.75, 1.15, 0.95, 1],
      transition: {
        duration: 1,
        times: [0, 0.3, 0.4, 0.5, 0.65, 1],
      },
    } as Variant,
    exit: { scale: 0, opacity: 0 } as Variant,
  },
  wobble: {
    initial: { x: 0, rotate: 0 } as Variant,
    animate: {
      x: [0, -25, 20, -15, 10, -5, 0],
      rotate: [0, -5, 3, -3, 2, -1, 0],
      transition: {
        duration: 1,
        times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
      },
    } as Variant,
    exit: { x: 0, rotate: 0, opacity: 0 } as Variant,
  },
  swing: {
    initial: { rotate: 0, transformOrigin: 'top center' } as Variant,
    animate: {
      rotate: [0, 15, -10, 5, -5, 0],
      transformOrigin: 'top center',
      transition: {
        duration: 1,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
    exit: { rotate: 0, opacity: 0 } as Variant,
  },
};
