import {
  validateCustomAnimation,
  convertWebAnimationToVariant,
  parsePresetAnimation,
  parseCustomAnimation,
  parseAnimation,
  createDefaultAnimation,
  normalizeParsedAnimationVariant,
} from './animationParser';
import type { CustomAnimation } from '../types';

// Mock getPresetAnimation
jest.mock('./presets', () => ({
  getPresetAnimation: jest.fn((name: string) => {
    if (name === 'fade') {
      return Promise.resolve({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    }
    if (name === 'invalid') {
      return Promise.reject(new Error('Invalid animation'));
    }
    return Promise.resolve({
      initial: { opacity: 0, transformOrigin: 'bottom center' },
      animate: { opacity: 1, transformOrigin: 'bottom center' },
      exit: { opacity: 0 },
    });
  }),
}));

describe('animationParser', () => {
  describe('validateCustomAnimation', () => {
    it('should validate correct custom animation', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1, transform: 'scale(1)' },
        duration: 1000,
        easing: 'ease-out',
      };

      expect(validateCustomAnimation(animation)).toBe(true);
    });

    it('should reject null or undefined animation', () => {
      expect(validateCustomAnimation(null as unknown as CustomAnimation)).toBe(false);
      expect(validateCustomAnimation(undefined as unknown as CustomAnimation)).toBe(false);
    });

    it('should reject animation without keyframes', () => {
      const animation = {
        duration: 1000,
      } as unknown as CustomAnimation;

      expect(validateCustomAnimation(animation)).toBe(false);
    });

    it('should reject animation with invalid keyframes type', () => {
      const animation = {
        keyframes: 'invalid',
        duration: 1000,
      } as unknown as CustomAnimation;

      expect(validateCustomAnimation(animation)).toBe(false);
    });

    it('should reject animation with empty keyframes', () => {
      const animation: CustomAnimation = {
        keyframes: {},
        duration: 1000,
      };

      expect(validateCustomAnimation(animation)).toBe(false);
    });

    it('should reject animation with invalid duration type', () => {
      const animation = {
        keyframes: { opacity: 1 },
        duration: 'invalid',
      } as unknown as CustomAnimation;

      expect(validateCustomAnimation(animation)).toBe(false);
    });

    it('should reject animation with invalid easing type', () => {
      const animation = {
        keyframes: { opacity: 1 },
        easing: 123,
      } as unknown as CustomAnimation;

      expect(validateCustomAnimation(animation)).toBe(false);
    });

    it('should accept animation without duration', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
      };

      expect(validateCustomAnimation(animation)).toBe(true);
    });

    it('should accept animation without easing', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        duration: 1000,
      };

      expect(validateCustomAnimation(animation)).toBe(true);
    });
  });

  describe('convertWebAnimationToVariant', () => {
    it('should convert animation with default values', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1, transform: 'scale(1)' },
      };

      const variant = convertWebAnimationToVariant(animation);

      expect(variant).toEqual({
        opacity: 1,
        transform: 'scale(1)',
        transition: {
          duration: 1,
          ease: 'easeInOut',
          delay: 0,
        },
      });
    });

    it('should convert animation with custom duration', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        duration: 2000,
      };

      const variant = convertWebAnimationToVariant(animation);

      // convertWebAnimationToVariant returns a Variant with keyframes and transition
      expect(variant).toHaveProperty('opacity', 1);
      expect(variant).toHaveProperty('transition');
      expect((variant as { transition: { duration: number } }).transition.duration).toBe(2);
    });

    it('should convert animation with custom easing', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        easing: 'ease-in',
      };

      const variant = convertWebAnimationToVariant(animation);

      // convertWebAnimationToVariant returns a Variant with keyframes and transition
      expect(variant).toHaveProperty('opacity', 1);
      expect(variant).toHaveProperty('transition');
      expect((variant as { transition: { ease: string } }).transition.ease).toBe('easeIn');
    });

    it('should convert animation with custom delay', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        delay: 500,
      };

      const variant = convertWebAnimationToVariant(animation);

      // convertWebAnimationToVariant returns a Variant with keyframes and transition
      expect(variant).toHaveProperty('opacity', 1);
      expect(variant).toHaveProperty('transition');
      expect((variant as { transition: { delay: number } }).transition.delay).toBe(0.5);
    });

    it('should map easing values correctly', () => {
      const easingMap = {
        linear: 'linear',
        ease: 'easeInOut',
        'ease-in': 'easeIn',
        'ease-out': 'easeOut',
        'ease-in-out': 'easeInOut',
      };

      Object.entries(easingMap).forEach(([input, expected]) => {
        const animation: CustomAnimation = {
          keyframes: { opacity: 1 },
          easing: input,
        };

        const variant = convertWebAnimationToVariant(animation);
        expect(variant).toHaveProperty('opacity', 1);
        expect(variant).toHaveProperty('transition');
        expect((variant as { transition: { ease: string } }).transition.ease).toBe(expected);
      });
    });

    it('should preserve unknown easing values', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      };

      const variant = convertWebAnimationToVariant(animation);

      // convertWebAnimationToVariant returns a Variant with keyframes and transition
      expect(variant).toHaveProperty('opacity', 1);
      expect(variant).toHaveProperty('transition');
      expect((variant as { transition: { ease: string } }).transition.ease).toBe(
        'cubic-bezier(0.4, 0, 0.2, 1)'
      );
    });

    it('should normalize transformOrigin keywords in custom animations', () => {
      const animation: CustomAnimation = {
        keyframes: { rotate: 12, transformOrigin: 'bottom center' },
      };

      const variant = convertWebAnimationToVariant(animation);

      expect(variant).toHaveProperty('transformOrigin', '50% 100%');
    });
  });

  describe('normalizeParsedAnimationVariant', () => {
    it('should normalize transformOrigin keywords across phases', () => {
      const result = normalizeParsedAnimationVariant({
        initial: { transformOrigin: 'top center' },
        animate: { transformOrigin: 'center bottom' },
        exit: { transformOrigin: 'top left' },
      });

      expect(result).toEqual({
        initial: { transformOrigin: '50% 0%' },
        animate: { transformOrigin: '50% 100%' },
        exit: { transformOrigin: '0% 0%' },
      });
    });
  });

  describe('parsePresetAnimation', () => {
    it('should parse valid preset animation', async () => {
      const result = await parsePresetAnimation('fade');

      expect(result).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });

    it('should return null for invalid preset animation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await parsePresetAnimation('invalid');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseCustomAnimation', () => {
    it('should parse valid custom animation', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1, transform: 'scale(1)' },
        duration: 1000,
        easing: 'ease-out',
      };

      const result = parseCustomAnimation(animation);

      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('animate');
      expect(result).toHaveProperty('exit');
      expect(result?.animate).toMatchObject({
        opacity: 1,
        transform: 'scale(1)',
      });
    });

    it('should normalize transformOrigin in parsed custom animations', () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1, transformOrigin: 'top center' },
      };

      const result = parseCustomAnimation(animation);

      expect(result?.animate).toMatchObject({
        opacity: 1,
        transformOrigin: '50% 0%',
      });
    });

    it('should return null for invalid custom animation', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const animation = {
        keyframes: {},
      } as CustomAnimation;

      const result = parseCustomAnimation(animation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle parsing errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const animation = null as unknown as CustomAnimation;

      const result = parseCustomAnimation(animation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseAnimation', () => {
    it('should parse preset animation from string', async () => {
      const result = await parseAnimation('fade');

      expect(result).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });

    it('should parse custom animation from object', async () => {
      const animation: CustomAnimation = {
        keyframes: { opacity: 1 },
        duration: 1000,
      };

      const result = await parseAnimation(animation);

      expect(result).toHaveProperty('initial');
      expect(result).toHaveProperty('animate');
      expect(result).toHaveProperty('exit');
    });

    it('should return null for invalid animation format', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await parseAnimation(123 as unknown as string);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('createDefaultAnimation', () => {
    it('should create default animation', () => {
      const result = createDefaultAnimation();

      expect(result).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });
  });
});
