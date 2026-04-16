/**
 * Property-Based Test: 尺寸换算一致性
 * **Validates: Requirements 1.5**
 *
 * 属性 1: 对于任意设计稿尺寸和视口宽度，换算后的尺寸比例应保持一致
 * 形式化：∀ designSize d, viewportWidth v, elementSize e: convertedSize / v = e / d
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { convertSize } from '../../utils/sizeConverter';
import type { SizeUnit } from '../../types';

describe('Property: 尺寸换算一致性', () => {
  test.prop([
    fc.integer({ min: 300, max: 2000 }), // designSize
    fc.integer({ min: 320, max: 1920 }), // viewportWidth
    fc.integer({ min: 1, max: 1000 }), // elementSize
    fc.constantFrom<SizeUnit>('vw', 'rem'), // unit (非 px)
  ])(
    '对于任意设计稿尺寸和视口宽度，换算后的尺寸比例应保持一致',
    (designSize: number, viewportWidth: number, elementSize: number, unit: SizeUnit) => {
      // 类型断言以修复 TypeScript 推断问题
      const ds = designSize;
      const vw = viewportWidth;
      const es = elementSize;
      const u = unit;
      // 使用 convertSize 函数进行换算
      const convertedSize = convertSize(es, ds, vw, u);

      // 验证属性：convertedSize / viewportWidth = elementSize / designSize
      const leftRatio = convertedSize / vw;
      const rightRatio = es / ds;

      // 使用浮点数比较，允许微小误差
      expect(Math.abs(leftRatio - rightRatio)).toBeLessThan(0.0001);
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.constantFrom<SizeUnit>('vw', 'rem'),
  ])(
    '边界情况：元素尺寸为 0 时，换算后的尺寸也应为 0',
    (designSize: number, viewportWidth: number, unit: SizeUnit) => {
      const ds = designSize;
      const vw = viewportWidth;
      const u = unit;
      const convertedSize = convertSize(0, ds, vw, u);

      expect(convertedSize).toBe(0);
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.constantFrom<SizeUnit>('vw', 'rem'),
  ])(
    '特殊情况：元素尺寸等于设计稿尺寸时，换算后应等于视口宽度',
    (designSize: number, viewportWidth: number, unit: SizeUnit) => {
      const ds = designSize;
      const vw = viewportWidth;
      const u = unit;
      const convertedSize = convertSize(ds, ds, vw, u);

      // 允许浮点数误差
      expect(Math.abs(convertedSize - vw)).toBeLessThan(0.01);
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 1, max: 1000 }),
    fc.constantFrom<SizeUnit>('px', 'vw', 'rem'),
  ])(
    '所有单位都应该进行换算',
    (designSize: number, viewportWidth: number, elementSize: number, unit: SizeUnit) => {
      const ds = designSize;
      const vw = viewportWidth;
      const es = elementSize;
      const u = unit;
      const convertedSize = convertSize(es, ds, vw, u);

      // 验证换算比例
      const expectedSize = (es * vw) / ds;
      expect(Math.abs(convertedSize - expectedSize)).toBeLessThan(0.01);
    }
  );
});
