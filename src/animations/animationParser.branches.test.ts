import {
  validateCustomAnimation,
  parseCustomAnimation,
  normalizeParsedAnimationVariant,
} from './animationParser';
import type { CustomAnimation, ParsedAnimationVariant } from '../types';

jest.mock('./presets', () => ({
  getPresetAnimation: jest.fn(() => Promise.resolve({})),
}));

// devWarn/devError only emit under NODE_ENV==='development'; these tests assert
// the dev diagnostics fire, so pin the env for the suite.
const originalNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

/**
 * Helper: run a transformOrigin string through the public normalizer and read
 * back the normalized initial.transformOrigin value.
 */
const normalizeOrigin = (value: string): unknown => {
  const result = normalizeParsedAnimationVariant({
    initial: { transformOrigin: value },
    animate: {},
    exit: {},
  } as ParsedAnimationVariant);
  return (result.initial as Record<string, unknown>).transformOrigin;
};

describe('animationParser branch coverage', () => {
  describe('normalizeTransformOriginValue single-token paths', () => {
    it('maps a lone X-axis keyword to "<x> 50%"', () => {
      // parts.length === 1, xToken present, yToken absent -> `${xToken} 50%`
      expect(normalizeOrigin('left')).toBe('0% 50%');
      expect(normalizeOrigin('right')).toBe('100% 50%');
    });

    it('maps a lone Y-axis keyword to "50% <y>"', () => {
      // parts.length === 1, yToken present, xToken absent -> `50% ${yToken}`
      expect(normalizeOrigin('top')).toBe('50% 0%');
      expect(normalizeOrigin('bottom')).toBe('50% 100%');
    });

    it('returns the original value for an unknown single token', () => {
      // parts.length === 1, neither xToken nor yToken -> return value
      expect(normalizeOrigin('banana')).toBe('banana');
    });
  });

  describe('normalizeTransformOriginValue two-token paths (outside combo map)', () => {
    it('resolves a two-token value when both axes are present', () => {
      // 'center center' is NOT in the combo map; parts.length === 2,
      // xToken (from first) && yToken (from first) -> `${xToken} ${yToken}`
      expect(normalizeOrigin('center center')).toBe('50% 50%');
    });

    it('uses the second token for the X axis when the first is not an X keyword', () => {
      // X_MAP[first] (undefined) ?? X_MAP[second] -> right side of ??
      // yToken stays undefined -> falls through to `return value`
      expect(normalizeOrigin('banana left')).toBe('banana left');
    });

    it('uses the second token for the Y axis when the first is not a Y keyword', () => {
      // Y_MAP[first] (undefined) ?? Y_MAP[second] -> right side of ??
      // xToken stays undefined -> falls through to `return value`
      expect(normalizeOrigin('banana top')).toBe('banana top');
    });

    it('returns the original value when two X-axis keywords leave Y unresolved', () => {
      // xToken present, yToken undefined -> final `return value`
      expect(normalizeOrigin('left right')).toBe('left right');
    });

    it('returns the original value when two Y-axis keywords leave X unresolved', () => {
      // yToken present (from first), xToken undefined -> final `return value`
      expect(normalizeOrigin('top bottom')).toBe('top bottom');
    });
  });

  describe('normalizeVariantValue nested array and object recursion', () => {
    it('recurses into array values and nested object values', () => {
      // Array value (e.g. keyframes) hits the Array.isArray branch (line 80);
      // nested object value (transition) hits the object branch (line 84).
      const result = normalizeParsedAnimationVariant({
        initial: {},
        animate: {
          x: [0, 50, 100],
          transition: { duration: 0.4, ease: 'easeInOut' },
          transformOrigin: 'top left',
        },
        exit: {},
      } as ParsedAnimationVariant);

      expect(result.animate).toEqual({
        x: [0, 50, 100],
        transition: { duration: 0.4, ease: 'easeInOut' },
        transformOrigin: '0% 0%',
      });
    });

    it('normalizes transformOrigin strings nested inside arrays', () => {
      // Array of strings under the transformOrigin key: each item recurses
      // through normalizeVariantValue with key preserved.
      const result = normalizeParsedAnimationVariant({
        initial: { transformOrigin: ['top left', 'bottom right'] },
        animate: {},
        exit: {},
      } as ParsedAnimationVariant);

      expect((result.initial as Record<string, unknown>).transformOrigin).toEqual([
        '0% 0%',
        '100% 100%',
      ]);
    });
  });

  describe('validateCustomAnimation empty record', () => {
    it('rejects an object with no entries', () => {
      // entries.length === 0 -> false (line 122)
      expect(validateCustomAnimation({} as CustomAnimation)).toBe(false);
    });
  });

  describe('parseCustomAnimation normalization failure', () => {
    it('returns null and logs when normalization throws', () => {
      // Build an animation that passes validateCustomAnimation (Object.keys sees
      // the enumerable getter) but throws during normalization when the getter
      // is read by Object.entries -> hits the try/catch at lines 184-185.
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const phase: Record<string, unknown> = {};
      Object.defineProperty(phase, 'opacity', {
        enumerable: true,
        get() {
          throw new Error('boom');
        },
      });

      const result = parseCustomAnimation({ animate: phase } as CustomAnimation);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[CineView]',
        'Failed to parse custom animation:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
