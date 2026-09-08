/**
 * Branch coverage for animationHelpers — targets the type-conversion paths in
 * interpolateVariant (number↔string, deg, transform functions) and the
 * parseAnimationSafely error/success paths that the property suite does not
 * exercise.
 */

import { interpolateVariant, parseAnimationSafely } from './animationHelpers';
import { parseAnimationWithComposition } from '../animations/composer';

jest.mock('../animations/composer', () => ({
  parseAnimationWithComposition: jest.fn(),
}));

const mockParse = parseAnimationWithComposition as jest.MockedFunction<
  typeof parseAnimationWithComposition
>;

describe('interpolateVariant — type-conversion branches', () => {
  it('interpolates a number start to a % string end', () => {
    const result = interpolateVariant({ y: 0 }, { y: '100%' }, 0.5);
    expect(result.y).toBe('50%');
  });

  it('interpolates a number start to a px string end', () => {
    const result = interpolateVariant({ x: 0 }, { x: '40px' }, 0.25);
    expect(result.x).toBe('10px');
  });

  it('interpolates a number start to a deg string end', () => {
    const result = interpolateVariant({ rotate: 0 }, { rotate: '90deg' }, 0.5);
    expect(result.rotate).toBe('45deg');
  });

  it('interpolates a px string start to a number end', () => {
    const result = interpolateVariant({ x: '100px' }, { x: 0 }, 0.5);
    expect(result.x).toBe('50px');
  });

  it('interpolates a % string start to a number end', () => {
    const result = interpolateVariant({ y: '100%' }, { y: 0 }, 0.25);
    expect(result.y).toBe('75%');
  });

  it('interpolates a deg string start to a number end', () => {
    const result = interpolateVariant({ rotate: '90deg' }, { rotate: 0 }, 0.5);
    expect(result.rotate).toBe('45deg');
  });

  it('interpolates string→string px', () => {
    const result = interpolateVariant({ x: '0px' }, { x: '100px' }, 0.5);
    expect(result.x).toBe('50px');
  });

  it('interpolates string→string deg', () => {
    const result = interpolateVariant({ rotate: '0deg' }, { rotate: '180deg' }, 0.5);
    expect(result.rotate).toBe('90deg');
  });

  it('interpolates string→string %', () => {
    const result = interpolateVariant({ width: '0%' }, { width: '80%' }, 0.25);
    expect(result.width).toBe('20%');
  });

  it('interpolates a unitless transform function argument', () => {
    // Only the unitless transform-fn arg actually reaches the transform branch:
    // any px/%/deg string is caught by the earlier unit branches first (so the
    // px/%/deg-inside-transform sub-branches in the source are unreachable dead
    // code — not asserted here on purpose).
    const result = interpolateVariant({ transform: 'scale(1)' }, { transform: 'scale(2)' }, 0.5);
    expect(result.transform).toBe('scale(1.5)');
  });

  it('falls back to a 0.5 threshold switch when transform function names differ', () => {
    // Differing function names with no px/%/deg units reach the transform branch
    // and fail its funcName-match guard, falling through to the threshold switch.
    const below = interpolateVariant({ transform: 'scale(1)' }, { transform: 'rotate(2)' }, 0.25);
    expect(below.transform).toBe('scale(1)');

    const above = interpolateVariant({ transform: 'scale(1)' }, { transform: 'rotate(2)' }, 0.75);
    expect(above.transform).toBe('rotate(2)');
  });

  it('keeps the start value when the end omits a key', () => {
    const result = interpolateVariant({ opacity: 0.3, x: 5 }, { opacity: 1 }, 0.5);
    expect(result.x).toBe(5);
  });

  it('defaults a missing numeric start to 0 when converting to a px string end', () => {
    const result = interpolateVariant({}, { x: '100px' }, 0.5);
    expect(result.x).toBe('50px');
  });

  // string→string where only the START carries the unit (exercises the `||`
  // second operand of each unit branch, where endVal has no unit token).
  it('interpolates string→string px when only the start has the px token', () => {
    const result = interpolateVariant({ x: '0px' }, { x: '100' }, 0.5);
    expect(result.x).toBe('50px');
  });

  it('interpolates string→string % when only the start has the % token', () => {
    const result = interpolateVariant({ width: '0%' }, { width: '40' }, 0.5);
    expect(result.width).toBe('20%');
  });

  it('interpolates string→string deg when only the start has the deg token', () => {
    const result = interpolateVariant({ rotate: '0deg' }, { rotate: '90' }, 0.5);
    expect(result.rotate).toBe('45deg');
  });

  // number→string end that carries no recognized unit: none of the px/%/deg
  // number→string branches fire, so it falls through to the 0.5 threshold switch.
  it('falls back to the threshold switch for a number→unitless-string pair', () => {
    expect(interpolateVariant({ x: 0 }, { x: 'auto' }, 0.25).x).toBe(0);
    expect(interpolateVariant({ x: 0 }, { x: 'auto' }, 0.75).x).toBe('auto');
  });

  // parseFloat returns NaN for non-numeric unit strings, triggering the `|| 0`
  // fallback branches (lines 90, 95, 100, 109, 114, 119, 138, 146, 153).
  it('uses 0 as fallback when parseFloat yields NaN (number→non-numeric px end)', () => {
    const result = interpolateVariant({ x: 10 }, { x: 'abcpx' }, 0.5);
    expect(result.x).toBe('5px'); // 10 + (0 - 10) * 0.5 = 5
  });
  it('uses 0 as fallback when parseFloat yields NaN (number→non-numeric % end)', () => {
    const result = interpolateVariant({ y: 10 }, { y: 'abc%' }, 0.5);
    expect(result.y).toBe('5%'); // 10 + (0 - 10) * 0.5 = 5
  });
  it('uses 0 as fallback when parseFloat yields NaN (number→non-numeric deg end)', () => {
    const result = interpolateVariant({ r: 10 }, { r: 'abcdeg' }, 0.5);
    expect(result.r).toBe('5deg');
  });
  it('uses 0 as fallback when parseFloat yields NaN (non-numeric px start→number end)', () => {
    const result = interpolateVariant({ x: 'abcpx' }, { x: 10 }, 0.5);
    expect(result.x).toBe('5px'); // 0 + (10 - 0) * 0.5 = 5
  });
  it('uses 0 as fallback when parseFloat yields NaN (non-numeric % start→number end)', () => {
    const result = interpolateVariant({ y: 'abc%' }, { y: 10 }, 0.5);
    expect(result.y).toBe('5%');
  });
  it('uses 0 as fallback when parseFloat yields NaN (non-numeric deg start→number end)', () => {
    const result = interpolateVariant({ r: 'abcdeg' }, { r: 10 }, 0.5);
    expect(result.r).toBe('5deg');
  });
  it('uses 0 as fallback when parseFloat yields NaN (string→string px)', () => {
    const result = interpolateVariant({ x: 'abcpx' }, { x: 'defpx' }, 0.5);
    expect(result.x).toBe('0px');
  });
  it('uses 0 as fallback when parseFloat yields NaN (string→string %)', () => {
    const result = interpolateVariant({ y: 'abc%' }, { y: 'def%' }, 0.5);
    expect(result.y).toBe('0%');
  });
  it('uses 0 as fallback when parseFloat yields NaN (string→string deg)', () => {
    const result = interpolateVariant({ r: 'abcdeg' }, { r: 'defdeg' }, 0.5);
    expect(result.r).toBe('0deg');
  });

  it('skips the transition key entirely', () => {
    const result = interpolateVariant(
      { opacity: 0, transition: { duration: 1 } },
      { opacity: 1, transition: { duration: 2 } },
      0.5
    );
    expect(result.transition).toBeUndefined();
    expect(result.opacity).toBe(0.5);
  });

  it('defaults a missing opacity start to 1', () => {
    // start lacks opacity -> effectiveStartVal = 1; 1 + (0 - 1) * 0.5 = 0.5
    const result = interpolateVariant({}, { opacity: 0 }, 0.5);
    expect(result.opacity).toBe(0.5);
  });

  it('defaults a missing numeric (non-opacity) start to 0', () => {
    const result = interpolateVariant({}, { x: 10 }, 0.5);
    expect(result.x).toBe(5);
  });

  it("defaults a missing string-valued start to '0'", () => {
    // start lacks the key, end is a string -> effectiveStartVal = '0'
    const result = interpolateVariant({}, { width: '100px' }, 0.5);
    expect(result.width).toBe('50px');
  });
});

describe('interpolateVariant — multi-value string endpoints (E-E8)', () => {
  it('returns equal string endpoints verbatim instead of collapsing them via parseFloat', () => {
    // transformOrigin '50% 100%' with equal endpoints: old code hit the % branch,
    // took parseFloat → 50, output '50%' — collapsing a two-value property into
    // a single value. Equal endpoints must return unchanged.
    const result = interpolateVariant(
      { transformOrigin: '50% 100%' },
      { transformOrigin: '50% 100%' },
      0.5
    );
    expect(result.transformOrigin).toBe('50% 100%');
  });

  it('returns equal multi-value px endpoints unchanged', () => {
    expect(interpolateVariant({ x: '10px 20px' }, { x: '10px 20px' }, 0.3).x).toBe('10px 20px');
  });

  it('threshold-switches unequal multi-token unit strings instead of collapsing them', () => {
    // Unequal multi-value strings cannot be single-value interpolated: falls back
    // to 0.5 threshold switching rather than parseFloat collapse ('50% 0%' → '50%'
    // would alter transformOrigin semantics).
    const below = interpolateVariant(
      { transformOrigin: '50% 0%' },
      { transformOrigin: '50% 100%' },
      0.25
    );
    expect(below.transformOrigin).toBe('50% 0%');

    const above = interpolateVariant(
      { transformOrigin: '50% 0%' },
      { transformOrigin: '50% 100%' },
      0.75
    );
    expect(above.transformOrigin).toBe('50% 100%');
  });

  it('returns equal numeric endpoints via the early exit', () => {
    expect(interpolateVariant({ x: 5 }, { x: 5 }, 0.42).x).toBe(5);
  });
});

describe('parseAnimationSafely', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.clearAllMocks();
  });

  it('returns null for an undefined animation', async () => {
    expect(await parseAnimationSafely(undefined, 'c1', 'enter')).toBeNull();
  });

  it('returns the parsed variant on success', async () => {
    const variant = { initial: { opacity: 0 }, animate: { opacity: 1 } };
    mockParse.mockResolvedValueOnce(variant as never);
    expect(await parseAnimationSafely('fade-in', 'c1', 'enter')).toBe(variant);
  });

  it('returns null and logs when the parser yields nothing (dev)', async () => {
    process.env.NODE_ENV = 'development';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockParse.mockResolvedValueOnce(null as never);

    expect(await parseAnimationSafely('bogus', 'c1', 'exit')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns null silently when the parser yields nothing (prod)', async () => {
    process.env.NODE_ENV = 'production';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockParse.mockResolvedValueOnce(null as never);

    expect(await parseAnimationSafely('bogus', 'c1', 'exit')).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns null and logs when the parser throws (dev)', async () => {
    process.env.NODE_ENV = 'development';
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockParse.mockRejectedValueOnce(new Error('boom'));

    expect(await parseAnimationSafely('explode', 'c1', 'loop')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
