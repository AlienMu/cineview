/**
 * Direct unit tests for animateInterpolation pure functions. Covers parseNumericValue
 * fallback branches and lerpTransformValue match/fallback branches (previously only
 * indirectly covered through hooks, leaving gaps).
 */
import {
  clamp,
  lerp,
  lerpTransformValue,
  parseNumericValue,
  getDefaultValue,
  getVariantTerminalValue,
  getVariantValue,
  interpolateVariantValue,
} from './animateInterpolation';

describe('clamp / lerp', () => {
  it('clamp constrains to [min,max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp performs linear interpolation', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 1)).toBe(100);
  });
});

describe('lerpTransformValue', () => {
  it('number × number → numeric interpolation', () => {
    expect(lerpTransformValue(0, 10, 0.5)).toBe(5);
  });

  it('unit-suffixed strings (100% / 12px / 45deg) → interpolate with unit', () => {
    expect(lerpTransformValue('0%', '100%', 0.5)).toBe('50%');
    expect(lerpTransformValue('0px', '12px', 0.5)).toBe('6px');
    expect(lerpTransformValue('0deg', '90deg', 1 / 3)).toBe('30deg');
  });

  it('unitless numeric strings → return bare number (empty unit branch)', () => {
    expect(lerpTransformValue('0', '10', 0.5)).toBe(5);
  });

  it('transform functions (same name, single param) → interpolate inside function', () => {
    expect(lerpTransformValue('translateY(0%)', 'translateY(100%)', 0.5)).toBe('translateY(50%)');
  });

  it('transform functions without unit → preserve function wrapper', () => {
    expect(lerpTransformValue('scale(0)', 'scale(2)', 0.5)).toBe('scale(1)');
  });

  it('mismatched function names → fall back to progress threshold branch', () => {
    expect(lerpTransformValue('translateX(0px)', 'translateY(10px)', 0.4)).toBe('translateX(0px)');
    expect(lerpTransformValue('translateX(0px)', 'translateY(10px)', 1)).toBe('translateY(10px)');
  });

  it('completely unparseable strings → progress threshold fallback', () => {
    expect(lerpTransformValue('none', 'blur(4px)', 0.2)).toBe('none');
    expect(lerpTransformValue('none', 'blur(4px)', 1)).toBe('blur(4px)');
  });
});

describe('parseNumericValue', () => {
  it('finite number returned directly', () => {
    expect(parseNumericValue(42, 0)).toBe(42);
  });

  it('parseable numeric string → parseFloat', () => {
    expect(parseNumericValue('0.7', 0)).toBe(0.7);
    expect(parseNumericValue('12px', 0)).toBe(12);
  });

  it('non-finite (NaN/Infinity) → fallback', () => {
    expect(parseNumericValue(NaN, -1)).toBe(-1);
    expect(parseNumericValue(Infinity, -1)).toBe(-1);
  });

  it('unparseable string → fallback (line 82)', () => {
    expect(parseNumericValue('abc', 7)).toBe(7);
    expect(parseNumericValue('', 7)).toBe(7);
  });

  it('non-number non-string (undefined/null/object) → fallback (line 82)', () => {
    expect(parseNumericValue(undefined, 3)).toBe(3);
    expect(parseNumericValue(null, 3)).toBe(3);
    expect(parseNumericValue({}, 3)).toBe(3);
  });
});

describe('getDefaultValue', () => {
  it('opacity: initial/exit → 0, animate → 1', () => {
    expect(getDefaultValue('opacity', 'initial')).toBe(0);
    expect(getDefaultValue('opacity', 'exit')).toBe(0);
    expect(getDefaultValue('opacity', 'animate')).toBe(1);
  });

  it('scale → 1, filter → none, others → 0', () => {
    expect(getDefaultValue('scale', 'initial')).toBe(1);
    expect(getDefaultValue('filter', 'initial')).toBe('none');
    expect(getDefaultValue('x', 'initial')).toBe(0);
    expect(getDefaultValue('rotate', 'animate')).toBe(0);
  });
});

describe('getVariantValue', () => {
  it('key exists → return value; missing → fallback', () => {
    expect(getVariantValue({ opacity: 0.5 }, 'opacity', 1)).toBe(0.5);
    expect(getVariantValue({}, 'opacity', 1)).toBe(1);
    expect(getVariantValue({ x: '10px' }, 'x', '0px')).toBe('10px');
  });
});

describe('variant keyframe interpolation', () => {
  it('scrubs full keyframe sequences using authored transition.times', () => {
    const exit = {
      opacity: [1, 1, 0],
      transition: { times: [0, 0.65, 1] },
    };

    expect(interpolateVariantValue(1, exit, 'opacity', 0, 0.5)).toBe(1);
    expect(interpolateVariantValue(1, exit, 'opacity', 0, 0.825)).toBeCloseTo(0.5);
    expect(interpolateVariantValue(1, exit, 'opacity', 0, 1)).toBe(0);
  });

  it('uses property-specific times and interpolates unit values', () => {
    const animate = {
      x: ['0px', '20px', '40px'],
      transition: { x: { times: [0, 0.25, 1] } },
    };

    expect(interpolateVariantValue('0px', animate, 'x', '0px', 0.625)).toBe('30px');
  });

  it('falls back to evenly spaced frames for invalid times and resolves null from the prior value', () => {
    const animate = {
      scale: [null, 2, 1],
      transition: { times: [0, 1] },
    };

    expect(interpolateVariantValue(1, animate, 'scale', 1, 0.25)).toBe(1.5);
    expect(getVariantTerminalValue(animate, 'scale', 1)).toBe(1);
  });
});
