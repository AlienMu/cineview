/**
 * Property-Based Tests for Animation Helpers
 * 验证动画辅助函数的数学属性和边界条件
 */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { interpolateVariant } from './animationHelpers';

describe('Property: interpolateVariant', () => {
  describe('数学属性', () => {
    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
      }),
    ])(
      '属性1: 起点插值 (progress=0) 应该返回起始值',
      (start: Record<string, number>, end: Record<string, number>) => {
        const result = interpolateVariant(start, end, 0);

        Object.keys(end).forEach((key) => {
          expect(result[key]).toBeCloseTo(start[key] as number, 10);
        });
      }
    );

    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
      }),
    ])(
      '属性2: 终点插值 (progress=1) 应该返回结束值',
      (start: Record<string, number>, end: Record<string, number>) => {
        const result = interpolateVariant(start, end, 1);

        Object.keys(end).forEach((key) => {
          expect(result[key]).toBeCloseTo(end[key] as number, 10);
        });
      }
    );

    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
    ])(
      '属性3: 中点插值 (progress=0.5) 应该返回中间值',
      (start: Record<string, number>, end: Record<string, number>) => {
        const result = interpolateVariant(start, end, 0.5);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const expected = (startVal + endVal) / 2;
          expect(result[key]).toBeCloseTo(expected, 10);
        });
      }
    );

    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性4: 线性插值公式 result = start + (end - start) * progress',
      (start: Record<string, number>, end: Record<string, number>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const expected = startVal + (endVal - startVal) * progress;
          expect(result[key]).toBeCloseTo(expected, 10);
        });
      }
    );
  });

  describe('单调性属性', () => {
    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性5: 单调性 - 如果 progress1 < progress2，则插值结果应该在 start 和 end 之间单调变化',
      (start: Record<string, number>, end: Record<string, number>, p1: number, p2: number) => {
        // 确保 p1 < p2
        const progress1 = Math.min(p1, p2);
        const progress2 = Math.max(p1, p2);

        if (progress1 === progress2) return; // 跳过相等的情况

        const result1 = interpolateVariant(start, end, progress1);
        const result2 = interpolateVariant(start, end, progress2);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const val1 = result1[key] as number;
          const val2 = result2[key] as number;

          if (startVal < endVal) {
            // 递增情况: val1 <= val2
            expect(val1).toBeLessThanOrEqual(val2 + 1e-10);
          } else if (startVal > endVal) {
            // 递减情况: val1 >= val2
            expect(val1).toBeGreaterThanOrEqual(val2 - 1e-10);
          } else {
            // 相等情况: val1 === val2
            expect(val1).toBeCloseTo(val2, 10);
          }
        });
      }
    );
  });

  describe('边界条件', () => {
    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性6: 插值结果应该在 [min(start, end), max(start, end)] 范围内',
      (start: Record<string, number>, end: Record<string, number>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const val = result[key] as number;

          const min = Math.min(startVal, endVal);
          const max = Math.max(startVal, endVal);

          expect(val).toBeGreaterThanOrEqual(min - 1e-10);
          expect(val).toBeLessThanOrEqual(max + 1e-10);
        });
      }
    );

    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
      }),
    ])(
      '属性7: 当 start === end 时，任何 progress 都应该返回相同的值',
      (start: Record<string, number>, _end: Record<string, number>) => {
        // 使用相同的值作为 start 和 end
        const end = { ...start };

        const result1 = interpolateVariant(start, end, 0);
        const result2 = interpolateVariant(start, end, 0.5);
        const result3 = interpolateVariant(start, end, 1);

        Object.keys(end).forEach((key) => {
          expect(result1[key]).toBeCloseTo(start[key] as number, 10);
          expect(result2[key]).toBeCloseTo(start[key] as number, 10);
          expect(result3[key]).toBeCloseTo(start[key] as number, 10);
        });
      }
    );
  });

  describe('字符串值处理', () => {
    test.prop([
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])('属性8: px 字符串值应该正确插值', (startNum: number, endNum: number, progress: number) => {
      const start = { x: `${startNum}px` };
      const end = { x: `${endNum}px` };

      const result = interpolateVariant(start, end, progress);

      const expected = startNum + (endNum - startNum) * progress;
      const resultNum = parseFloat(result.x as string);

      expect(resultNum).toBeCloseTo(expected, 5);
      // 允许科学计数法格式
      expect(result.x).toMatch(/^-?\d+(\.\d+)?(e[+-]?\d+)?px$/);
    });

    test.prop([fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })])(
      '属性9: px 字符串在 progress=0 时返回起始值',
      (startNum: number, endNum: number) => {
        const start = { width: `${startNum}px` };
        const end = { width: `${endNum}px` };

        const result = interpolateVariant(start, end, 0);

        expect(result.width).toBe(`${startNum}px`);
      }
    );

    test.prop([fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })])(
      '属性10: px 字符串在 progress=1 时返回结束值',
      (startNum: number, endNum: number) => {
        const start = { width: `${startNum}px` };
        const end = { width: `${endNum}px` };

        const result = interpolateVariant(start, end, 1);

        expect(result.width).toBe(`${endNum}px`);
      }
    );
  });

  describe('非数值类型处理', () => {
    test.prop([
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性11: 非数值类型在 progress <= 0.5 时返回起始值',
      (startVal: string, endVal: string, progress: number) => {
        if (progress > 0.5) return; // 只测试 <= 0.5 的情况

        const start = { visibility: startVal };
        const end = { visibility: endVal };

        const result = interpolateVariant(start, end, progress);

        expect(result.visibility).toBe(startVal);
      }
    );

    test.prop([
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性12: 非数值类型在 progress > 0.5 时返回结束值',
      (startVal: string, endVal: string, progress: number) => {
        if (progress <= 0.5) return; // 只测试 > 0.5 的情况

        const start = { visibility: startVal };
        const end = { visibility: endVal };

        const result = interpolateVariant(start, end, progress);

        expect(result.visibility).toBe(endVal);
      }
    );
  });

  describe('缺失值处理', () => {
    test.prop([
      fc.record({
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性13: 当 start 缺少某个属性时，应该使用默认值 (opacity=1, 其他=0)',
      (end: Record<string, number>, progress: number) => {
        const start = {}; // 空对象

        const result = interpolateVariant(start, end, progress);

        Object.keys(end).forEach((key) => {
          const defaultVal = key === 'opacity' ? 1 : 0;
          const endVal = end[key] as number;
          const expected = defaultVal + (endVal - defaultVal) * progress;

          expect(result[key]).toBeCloseTo(expected, 10);
        });
      }
    );

    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
    ])('属性14: opacity 缺失时默认为 1', (end: Record<string, number>) => {
      const start = {}; // 没有 opacity

      const result = interpolateVariant(start, end, 0);

      if (end.opacity !== undefined) {
        // 如果 end 有 opacity，start 应该默认为 1
        expect(result.opacity).toBeCloseTo(1, 10);
      }
    });

    test.prop([
      fc.record({
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
    ])('属性15: 非 opacity 属性缺失时默认为 0', (end: Record<string, number>) => {
      const start = {}; // 没有 x, y

      const result = interpolateVariant(start, end, 0);

      Object.keys(end).forEach((key) => {
        if (key !== 'opacity') {
          expect(result[key]).toBeCloseTo(0, 10);
        }
      });
    });
  });

  describe('transition 属性处理', () => {
    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        transition: fc.record({
          duration: fc.integer({ min: 100, max: 2000 }),
          ease: fc.constantFrom('linear', 'easeIn', 'easeOut'),
        }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        transition: fc.record({
          duration: fc.integer({ min: 100, max: 2000 }),
          ease: fc.constantFrom('linear', 'easeIn', 'easeOut'),
        }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性16: transition 属性应该被忽略，不出现在结果中',
      (start: Record<string, unknown>, end: Record<string, unknown>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        expect(result.transition).toBeUndefined();
      }
    );
  });

  describe('组合属性测试', () => {
    test.prop([
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
        rotate: fc.double({ min: -360, max: 360, noNaN: true }),
      }),
      fc.record({
        opacity: fc.double({ min: 0, max: 1, noNaN: true }),
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
        scale: fc.double({ min: 0, max: 5, noNaN: true }),
        rotate: fc.double({ min: -360, max: 360, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      '属性17: 多个属性同时插值应该独立计算',
      (start: Record<string, number>, end: Record<string, number>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        // 验证每个属性都独立插值
        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const expected = startVal + (endVal - startVal) * progress;

          expect(result[key]).toBeCloseTo(expected, 10);
        });

        // 验证结果包含所有 end 的属性
        expect(Object.keys(result).length).toBeGreaterThanOrEqual(Object.keys(end).length);
      }
    );
  });
});
