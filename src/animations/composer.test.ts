import {
  validateComposedAnimation,
  composeAnimation,
  parseAnimationWithComposition,
} from './composer';
import type { ComposedAnimation, CustomAnimation, PresetAnimation } from '../types';

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
