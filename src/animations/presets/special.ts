/**
 * Special 系列动画
 * 特殊效果：心跳、欢呼、波浪、滚动、铰链、盒子弹出
 */

import type { Variant } from 'framer-motion';

export const specialAnimations = {
  heartbeat: {
    initial: { scale: 1 } as Variant,
    animate: {
      scale: [1, 1.3, 1, 1.3, 1],
      transition: {
        duration: 1.3,
        times: [0, 0.14, 0.28, 0.42, 1],
      },
    } as Variant,
    exit: { scale: 0, opacity: 0 } as Variant,
  },
  tada: {
    initial: { scale: 1, rotate: 0 } as Variant,
    animate: {
      scale: [1, 0.9, 0.9, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1, 1],
      rotate: [0, -3, -3, 3, -3, 3, -3, 3, -3, 0],
      transition: {
        duration: 1,
        times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1],
      },
    } as Variant,
    exit: { scale: 0, rotate: 0, opacity: 0 } as Variant,
  },
  wave: {
    initial: { rotate: 0, transformOrigin: 'bottom center' } as Variant,
    animate: {
      rotate: [0, 14, -8, 14, -4, 10, 0],
      transformOrigin: 'bottom center',
      transition: {
        duration: 1,
        times: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
      },
    } as Variant,
    exit: { rotate: 0, opacity: 0 } as Variant,
  },
  'roll-in': {
    initial: { x: '-100%', rotate: -120, opacity: 0 } as Variant,
    animate: { x: 0, rotate: 0, opacity: 1 } as Variant,
    exit: { x: 0, rotate: 0, opacity: 1 } as Variant,
  },
  'roll-out': {
    initial: { x: 0, rotate: 0, opacity: 1 } as Variant,
    animate: { x: 0, rotate: 0, opacity: 1 } as Variant,
    exit: { x: '100%', rotate: 120, opacity: 0 } as Variant,
  },
  hinge: {
    initial: { rotate: 0, transformOrigin: 'top left' } as Variant,
    animate: { rotate: 0, transformOrigin: 'top left' } as Variant,
    exit: {
      rotate: [0, 80, 60, 80, 60, 60],
      y: [0, 0, 0, 0, 0, 700],
      opacity: [1, 1, 1, 1, 1, 0],
      transformOrigin: 'top left',
      transition: {
        duration: 2,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
      },
    } as Variant,
  },
  'jack-in-the-box': {
    initial: {
      scale: 0.1,
      rotate: 30,
      transformOrigin: 'center bottom',
      opacity: 0,
    } as Variant,
    animate: {
      scale: 1,
      rotate: 0,
      transformOrigin: 'center bottom',
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 500,
        damping: 15,
      },
    } as Variant,
    exit: { scale: 0, opacity: 0 } as Variant,
  },
};
