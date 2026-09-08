import {
  validateComposedAnimation,
  composeAnimation,
  parseAnimationWithComposition,
} from './composer';
import type { ComposedAnimation, CustomAnimation, PresetAnimation } from '../types';

// devError (used by the composer for failure diagnostics) only emits when
// NODE_ENV === 'development'. Force it so the console spies below observe them.
const originalNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

// Mock parseAnimation
jest.mock('./animationParser', () => ({
  parseAnimation: jest.fn((animation) => {
    if (typeof animation === 'string') {
      if (animation === 'fade') {
        return Promise.resolve({
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 1 } },
          exit: { opacity: 0 },
        });
      }
      if (animation === 'slide-up') {
        return Promise.resolve({
          initial: { y: 100, opacity: 0 },
          animate: { y: 0, opacity: 1, transition: { duration: 0.5 } },
          exit: { y: -100, opacity: 0 },
        });
      }
      if (animation === 'bare') {
        return Promise.resolve({
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        });
      }
      if (animation === 'instant') {
        return Promise.resolve({
          initial: { opacity: 0 },
          animate: { opacity: 1, transition: { duration: 0 } },
          exit: { opacity: 0 },
        });
      }
    }
    if (typeof animation === 'object' && 'animate' in animation) {
      return Promise.resolve({
        initial: animation.initial ?? {},
        animate: { ...animation.animate, transition: { duration: 1 } },
        exit: animation.exit ?? {},
      });
    }
    return Promise.resolve(null);
  }),
}));

describe('composer', () => {
  describe('validateComposedAnimation', () => {
    it('should validate correct composed animation', () => {
      const animation: ComposedAnimation = {
        mode: 'sequential',
        animations: ['fade', 'slide-up'],
      };

      expect(validateComposedAnimation(animation)).toBe(true);
    });

    it('should reject null or undefined animation', () => {
      expect(validateComposedAnimation(null as unknown as ComposedAnimation)).toBe(false);
      expect(validateComposedAnimation(undefined as unknown as ComposedAnimation)).toBe(false);
    });

    it('should reject animation without mode', () => {
      const animation = {
        animations: ['fade'],
      } as unknown as ComposedAnimation;

      expect(validateComposedAnimation(animation)).toBe(false);
    });

    it('should reject animation with invalid mode', () => {
      const animation = {
        mode: 'invalid',
        animations: ['fade'],
      } as unknown as ComposedAnimation;

      expect(validateComposedAnimation(animation)).toBe(false);
    });

    it('should reject animation without animations array', () => {
      const animation = {
        mode: 'sequential',
      } as unknown as ComposedAnimation;

      expect(validateComposedAnimation(animation)).toBe(false);
    });

    it('should reject animation with empty animations array', () => {
      const animation: ComposedAnimation = {
        mode: 'sequential',
        animations: [],
      };

      expect(validateComposedAnimation(animation)).toBe(false);
    });

    it('should accept parallel mode', () => {
      const animation: ComposedAnimation = {
        mode: 'parallel',
        animations: ['fade', 'slide-up'],
      };

      expect(validateComposedAnimation(animation)).toBe(true);
    });
  });

  describe('composeAnimation', () => {
    describe('sequential mode', () => {
      it('should compose sequential animations', async () => {
        const animation: ComposedAnimation = {
          mode: 'sequential',
          animations: ['fade', 'slide-up'],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('initial');
        expect(result).toHaveProperty('animate');
        expect(result).toHaveProperty('exit');
      });

      it('should apply custom delays in sequential mode', async () => {
        const animation: ComposedAnimation = {
          mode: 'sequential',
          animations: ['fade', 'slide-up'],
          delays: [0, 500],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('animate');
      });

      it('should handle single animation in sequential mode', async () => {
        const animation: ComposedAnimation = {
          mode: 'sequential',
          animations: ['fade'],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
      });

      it('should return null when no valid animations in sequential mode', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const animation: ComposedAnimation = {
          mode: 'sequential',
          animations: ['invalid1' as PresetAnimation, 'invalid2' as PresetAnimation],
        };

        const result = await composeAnimation(animation);

        expect(result).toBeNull();

        consoleSpy.mockRestore();
      });

      it('uses empty transition defaults for a bare animation', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['bare' as PresetAnimation],
        });

        expect(result?.animate).toEqual({ opacity: 1, transition: { opacity: { delay: 0 } } });
      });
    });

    describe('parallel mode', () => {
      it('should compose parallel animations', async () => {
        const animation: ComposedAnimation = {
          mode: 'parallel',
          animations: ['fade', 'slide-up'],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('initial');
        expect(result).toHaveProperty('animate');
        expect(result).toHaveProperty('exit');
      });

      it('should apply custom delays in parallel mode', async () => {
        const animation: ComposedAnimation = {
          mode: 'parallel',
          animations: ['fade', 'slide-up'],
          delays: [0, 200],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
        expect(result).toHaveProperty('animate');
      });

      it('should handle single animation in parallel mode', async () => {
        const animation: ComposedAnimation = {
          mode: 'parallel',
          animations: ['fade'],
        };

        const result = await composeAnimation(animation);

        expect(result).not.toBeNull();
      });

      it('should return null when no valid animations in parallel mode', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const animation: ComposedAnimation = {
          mode: 'parallel',
          animations: ['invalid1' as PresetAnimation, 'invalid2' as PresetAnimation],
        };

        const result = await composeAnimation(animation);

        expect(result).toBeNull();

        consoleSpy.mockRestore();
      });

      it('uses empty transition defaults for a bare animation', async () => {
        const result = await composeAnimation({
          mode: 'parallel',
          animations: ['bare' as PresetAnimation],
        });

        expect(result?.animate).toEqual({ opacity: 1, transition: { opacity: { delay: 0 } } });
      });
    });

    describe('per-value transition orchestration (E-E1)', () => {
      it('sequential: each property keeps its own step delay instead of last-wins', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['fade', { animate: { scale: 1.2 } } as CustomAnimation],
        });

        // fade's opacity starts at 0s, the second step's scale starts after fade ends (1s):
        // plain Object.assign merge would cause transition last-wins, losing opacity's delay 0.
        expect(result?.animate).toEqual({
          opacity: 1,
          scale: 1.2,
          transition: {
            opacity: { duration: 1, delay: 0 },
            scale: { duration: 1, delay: 1 },
          },
        });
      });

      it('sequential: a shared property takes the last writer value AND its transition', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['fade', 'slide-up'],
        });

        const animate = result?.animate as { transition: Record<string, unknown> };
        expect(animate.transition.opacity).toEqual({ duration: 0.5, delay: 1 });
        expect(animate.transition.y).toEqual({ duration: 0.5, delay: 1 });
      });

      it('parallel: per-value delays from delays[] survive the merge', async () => {
        const result = await composeAnimation({
          mode: 'parallel',
          animations: ['fade', { animate: { scale: 1.2 } } as CustomAnimation],
          delays: [0, 200],
        });

        expect(result?.animate).toEqual({
          opacity: 1,
          scale: 1.2,
          transition: {
            opacity: { duration: 1, delay: 0 },
            scale: { duration: 1, delay: 0.2 },
          },
        });
      });
    });

    describe('delays alignment when invalid animations are skipped (E-E2)', () => {
      it('keeps delays matched to authored positions, not compacted indices', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['not-a-real-animation' as PresetAnimation, 'fade'],
          delays: [999000, 500],
        });

        const animate = result?.animate as { transition: Record<string, unknown> };
        // fade is the 2nd item as authored → uses delays[1]=500ms; compacted index would wrongly take delays[0]=999s.
        expect(animate.transition.opacity).toEqual({ duration: 1, delay: 0.5 });
      });

      it('parallel: delays stay aligned across a skipped invalid entry', async () => {
        const result = await composeAnimation({
          mode: 'parallel',
          animations: ['not-a-real-animation' as PresetAnimation, 'fade'],
          delays: [999000, 200],
        });

        const animate = result?.animate as { transition: Record<string, unknown> };
        expect(animate.transition.opacity).toEqual({ duration: 1, delay: 0.2 });
      });
    });

    describe('sequential duration accumulation (E-E3)', () => {
      it('honours a real transition.duration of zero (not coerced to 1s)', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['instant' as PresetAnimation, { animate: { scale: 2 } } as CustomAnimation],
        });

        const animate = result?.animate as { transition: Record<string, unknown> };
        // instant's duration=0 → second step starts at 0s (old `|| 1` would treat 0 as 1 in accumulation).
        expect(animate.transition.scale).toEqual({ duration: 1, delay: 0 });
      });

      it('falls back to the documented 1s assumption for steps without a duration', async () => {
        const result = await composeAnimation({
          mode: 'sequential',
          animations: ['bare' as PresetAnimation, { animate: { scale: 2 } } as CustomAnimation],
        });

        const animate = result?.animate as { transition: Record<string, unknown> };
        expect(animate.transition.scale).toEqual({ duration: 1, delay: 1 });
      });
    });

    it('should return null for invalid composed animation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const animation = {
        mode: 'invalid',
        animations: [],
      } as unknown as ComposedAnimation;

      const result = await composeAnimation(animation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const animation: ComposedAnimation = {
        mode: 'sequential',
        animations: ['fade'],
      };

      // Mock parseAnimation to throw error
      const animationParser = await import('./animationParser');
      jest
        .spyOn(animationParser, 'parseAnimation')
        .mockImplementationOnce(() => Promise.reject(new Error('Test error')));

      const result = await composeAnimation(animation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseAnimationWithComposition', () => {
    it('should parse composed animation', async () => {
      const animation: ComposedAnimation = {
        mode: 'sequential',
        animations: ['fade', 'slide-up'],
      };

      const result = await parseAnimationWithComposition(animation);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('animate');
      expect(result).toHaveProperty('exit');
    });

    it('should parse preset animation string', async () => {
      const result = await parseAnimationWithComposition('fade');

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('animate');
      expect(result).toHaveProperty('exit');
    });

    it('should parse custom animation object', async () => {
      const animation: CustomAnimation = {
        animate: { opacity: 1, transform: 'scale(1)' },
      };

      const result = await parseAnimationWithComposition(animation);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('animate');
      expect(result).toHaveProperty('exit');
    });

    it('should handle mixed animation types', async () => {
      const animation: ComposedAnimation = {
        mode: 'parallel',
        animations: [
          'fade',
          {
            animate: { scale: 1.2 },
          } as CustomAnimation,
        ],
      };

      const result = await parseAnimationWithComposition(animation);

      expect(result).not.toBeNull();
    });
  });
});
