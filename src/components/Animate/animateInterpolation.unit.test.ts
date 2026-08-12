/**
 * animateInterpolation 纯函数直测。补齐 parseNumericValue 的 fallback 分支
 * 与 lerpTransformValue 的各匹配/回退分支（此前仅经 hook 间接覆盖，有空洞）。
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
  it('clamp 夹在 [min,max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('lerp 线性插值', () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 1)).toBe(100);
  });
});

describe('lerpTransformValue', () => {
  it('number × number → 数值插值', () => {
    expect(lerpTransformValue(0, 10, 0.5)).toBe(5);
  });

  it('单位后缀字符串（100% / 12px / 45deg）→ 带单位插值', () => {
    expect(lerpTransformValue('0%', '100%', 0.5)).toBe('50%');
    expect(lerpTransformValue('0px', '12px', 0.5)).toBe('6px');
    expect(lerpTransformValue('0deg', '90deg', 1 / 3)).toBe('30deg');
  });

  it('无单位数字字符串 → 返回裸数值（unit 空分支）', () => {
    expect(lerpTransformValue('0', '10', 0.5)).toBe(5);
  });

  it('transform 函数（同名单参）→ 函数内插值', () => {
    expect(lerpTransformValue('translateY(0%)', 'translateY(100%)', 0.5)).toBe('translateY(50%)');
  });

  it('transform 函数无单位 → 保留函数壳', () => {
    expect(lerpTransformValue('scale(0)', 'scale(2)', 0.5)).toBe('scale(1)');
  });

  it('函数名不同 → 落到 progress 阈值回退分支', () => {
    expect(lerpTransformValue('translateX(0px)', 'translateY(10px)', 0.4)).toBe('translateX(0px)');
    expect(lerpTransformValue('translateX(0px)', 'translateY(10px)', 1)).toBe('translateY(10px)');
  });

  it('完全不可解析的字符串 → progress 阈值回退', () => {
    expect(lerpTransformValue('none', 'blur(4px)', 0.2)).toBe('none');
    expect(lerpTransformValue('none', 'blur(4px)', 1)).toBe('blur(4px)');
  });
});

describe('parseNumericValue', () => {
  it('有限数直接返回', () => {
    expect(parseNumericValue(42, 0)).toBe(42);
  });

  it('可解析数字字符串 → parseFloat', () => {
    expect(parseNumericValue('0.7', 0)).toBe(0.7);
    expect(parseNumericValue('12px', 0)).toBe(12);
  });

  it('非有限数（NaN/Infinity）→ fallback', () => {
    expect(parseNumericValue(NaN, -1)).toBe(-1);
    expect(parseNumericValue(Infinity, -1)).toBe(-1);
  });

  it('不可解析字符串 → fallback（line 82）', () => {
    expect(parseNumericValue('abc', 7)).toBe(7);
    expect(parseNumericValue('', 7)).toBe(7);
  });

  it('非数字非字符串（undefined/null/object）→ fallback（line 82）', () => {
    expect(parseNumericValue(undefined, 3)).toBe(3);
    expect(parseNumericValue(null, 3)).toBe(3);
    expect(parseNumericValue({}, 3)).toBe(3);
  });
});

describe('getDefaultValue', () => {
  it('opacity：initial/exit → 0，animate → 1', () => {
    expect(getDefaultValue('opacity', 'initial')).toBe(0);
    expect(getDefaultValue('opacity', 'exit')).toBe(0);
    expect(getDefaultValue('opacity', 'animate')).toBe(1);
  });

  it('scale → 1，filter → none，其它 → 0', () => {
    expect(getDefaultValue('scale', 'initial')).toBe(1);
    expect(getDefaultValue('filter', 'initial')).toBe('none');
    expect(getDefaultValue('x', 'initial')).toBe(0);
    expect(getDefaultValue('rotate', 'animate')).toBe(0);
  });
});

describe('getVariantValue', () => {
  it('存在键 → 返回值；缺失 → fallback', () => {
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
