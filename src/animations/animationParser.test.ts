import {
  validateCustomAnimation,
  normalizeCustomAnimationVariant,
  convertWebAnimationToVariant,
  parsePresetAnimation,
  parseCustomAnimation,
  parseAnimation,
  createDefaultAnimation,
  normalizeParsedAnimationVariant,
} from './animationParser';
import type { CustomAnimation } from '../types';

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
    it('validates Framer Motion variant subset animations', () => {
      const animation: CustomAnimation = {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
        exit: { opacity: 0 },
      };

      expect(validateCustomAnimation(animation)).toBe(true);
    });

    it('accepts a single non-empty phase', () => {
      expect(validateCustomAnimation({ animate: { opacity: 1 } })).toBe(true);
    });

    it('rejects null or undefined animation', () => {
      expect(validateCustomAnimation(null as unknown as CustomAnimation)).toBe(false);
      expect(validateCustomAnimation(undefined as unknown as CustomAnimation)).toBe(false);
    });

    it('rejects unknown legacy keys', () => {
      expect(
        validateCustomAnimation({
          keyframes: { opacity: 1 },
        } as unknown as CustomAnimation)
      ).toBe(false);
    });

    it('rejects empty phase objects', () => {
      expect(validateCustomAnimation({ animate: {} })).toBe(false);
    });

    it('rejects non-object phase values', () => {
      expect(
        validateCustomAnimation({ animate: 'fade' as unknown as Record<string, unknown> })
      ).toBe(false);
    });
  });

  describe('normalizeCustomAnimationVariant', () => {
    it('normalizes custom variant phases', () => {
      const animation: CustomAnimation = {
        initial: { opacity: 0, transformOrigin: 'top center' },
        animate: { opacity: 1, transformOrigin: 'center bottom' },
        exit: { opacity: 0, transformOrigin: 'left center' },
      };

      expect(normalizeCustomAnimationVariant(animation)).toEqual({
        initial: { opacity: 0, transformOrigin: '50% 0%' },
        animate: { opacity: 1, transformOrigin: '50% 100%' },
        exit: { opacity: 0, transformOrigin: '0% 50%' },
      });
    });

    it('keeps omitted phases as empty variants', () => {
      expect(normalizeCustomAnimationVariant({ animate: { opacity: 1 } })).toEqual({
        initial: {},
        animate: { opacity: 1 },
        exit: {},
      });
    });

    it('keeps deprecated conversion export as an alias', () => {
      expect(convertWebAnimationToVariant({ animate: { opacity: 1 } })).toEqual({
        initial: {},
        animate: { opacity: 1 },
        exit: {},
      });
    });
  });

  describe('normalizeParsedAnimationVariant', () => {
    it('normalizes transformOrigin keywords across phases', () => {
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
    it('parses valid preset animation', async () => {
      const result = await parsePresetAnimation('fade');

      expect(result).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });

    it('returns null for invalid preset animation', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await parsePresetAnimation('invalid');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseCustomAnimation', () => {
    it('parses valid custom animation', () => {
      const animation: CustomAnimation = {
        initial: { opacity: 0 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0 },
      };

      const result = parseCustomAnimation(animation);

      expect(result).toEqual(animation);
    });

    it('normalizes transformOrigin in parsed custom animations', () => {
      const result = parseCustomAnimation({
        animate: { opacity: 1, transformOrigin: 'top center' },
      });

      expect(result?.animate).toMatchObject({
        opacity: 1,
        transformOrigin: '50% 0%',
      });
    });

    it('returns null for invalid custom animation', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = parseCustomAnimation({ animate: {} });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles parsing errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = parseCustomAnimation(null as unknown as CustomAnimation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('parseAnimation', () => {
    it('parses preset animation from string', async () => {
      const result = await parseAnimation('fade');

      expect(result).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });

    it('parses custom animation from object', async () => {
      const result = await parseAnimation({ animate: { opacity: 1 } });

      expect(result).toEqual({
        initial: {},
        animate: { opacity: 1 },
        exit: {},
      });
    });

    it('returns null for invalid animation format', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await parseAnimation(123 as unknown as string);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('createDefaultAnimation', () => {
    it('creates default animation', () => {
      expect(createDefaultAnimation()).toEqual({
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      });
    });
  });
});
