/**
 * Property-Based Test: 相对定位累加性
 * **Validates: Requirements 10.4**
 *
 * 属性 5: 每个组件的最终位置等于所有前置组件位置的累加
 * 形式化：Ci.finalX = Σ(Cj.x + Cj.offsetX) for j ∈ [1, i]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '@testing-library/react';
import { Position } from '../../components/Position/Position';
import { CineViewContext, type CineViewContextValue } from '../../context/CineViewContext';

interface PositionConfig {
  x?: number;
  offsetX?: number;
}

describe('Property: 相对定位累加性', () => {
  // 创建测试用的上下文
  const createTestContext = (designSize: number, viewportWidth: number): CineViewContextValue => {
    const scale = viewportWidth / designSize;
    return {
      designSize,
      unit: 'px' as const,
      viewportWidth,
      viewportHeight: 1080,
      scale,
      convertSize: (size: number): number => size * scale,
    };
  };

  test.prop([
    fc.integer({ min: 300, max: 2000 }), // designSize
    fc.integer({ min: 320, max: 1920 }), // viewportWidth
    fc.array(
      fc
        .record({
          x: fc.option(fc.integer({ min: 0, max: 500 }), { nil: undefined }),
          offsetX: fc.option(fc.integer({ min: -100, max: 100 }), { nil: undefined }),
        })
        .filter((pos: PositionConfig) => pos.x !== undefined || pos.offsetX !== undefined), // 至少有一个定义
      { minLength: 2, maxLength: 5 }
    ),
  ])(
    '相对定位组件序列：每个组件的最终位置应该等于所有前置组件位置的累加',
    (designSize: number, viewportWidth: number, positions: PositionConfig[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const pos = positions;

      const context = createTestContext(ds, vw);
      const scale = context.scale;

      // 计算每个组件的期望最终位置
      // Position 组件使用百分比系统：所有坐标都是设计稿坐标
      let cumulativeX = 0;
      const expectedPositions: number[] = [];

      pos.forEach((p) => {
        if (p.x !== undefined) {
          // 绝对定位：直接使用设计稿坐标
          cumulativeX = p.x;
        } else if (p.offsetX !== undefined) {
          // 相对定位：累加设计稿坐标
          cumulativeX += p.offsetX;
        }
        // 转换为百分比后的实际像素位置：(设计稿坐标 / 设计稿尺寸) * 视口宽度
        expectedPositions.push((cumulativeX / ds) * vw);
      });

      // 渲染嵌套组件以实现累加
      const renderNestedPositions = (
        positions: PositionConfig[],
        index: number = 0
      ): React.ReactElement => {
        if (index >= positions.length) {
          return <></>;
        }

        const p = positions[index];
        return (
          <Position x={p.x} offsetX={p.offsetX}>
            <div data-testid={`element-${index}`}>Element {index}</div>
            {renderNestedPositions(positions, index + 1)}
          </Position>
        );
      };

      const { container } = render(
        <CineViewContext.Provider value={context}>
          <div style={{ width: `${vw}px`, position: 'relative' }}>
            {renderNestedPositions(pos)}
          </div>
        </CineViewContext.Provider>
      );

      // 验证每个元素的实际位置
      pos.forEach((_, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          const actualLeft = parseFloat(style.left || '0');

          // 允许浮点数误差（百分比转换可能有精度损失）
          expect(Math.abs(actualLeft - expectedPositions[index])).toBeLessThanOrEqual(1);
        }
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
    fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 5 }),
  ])(
    '混合定位：第一个组件使用绝对定位，后续组件使用相对定位',
    (designSize: number, viewportWidth: number, absoluteX: number, relativeOffsets: number[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const absX = absoluteX;
      const offsets = relativeOffsets;

      const context = createTestContext(ds, vw);
      const scale = context.scale;

      // 计算期望位置
      const expectedPositions: number[] = [];
      // 绝对定位：设计稿坐标转百分比
      let currentX = absX;
      expectedPositions.push((currentX / ds) * vw);

      offsets.forEach((offset) => {
        // 相对定位：累加设计稿坐标
        currentX += offset;
        expectedPositions.push((currentX / ds) * vw);
      });

      // 渲染嵌套组件
      const renderNestedPositions = (): React.ReactElement => {
        let result: React.ReactElement = <></>;

        // 从后往前构建嵌套结构
        for (let i = offsets.length; i >= 0; i--) {
          if (i === 0) {
            result = (
              <Position x={absX}>
                <div data-testid="element-0">Element 0</div>
                {result}
              </Position>
            );
          } else {
            const offset = offsets[i - 1];
            result = (
              <Position offsetX={offset}>
                <div data-testid={`element-${i}`}>Element {i}</div>
                {result}
              </Position>
            );
          }
        }

        return result;
      };

      const { container } = render(
        <CineViewContext.Provider value={context}>
          <div style={{ width: `${vw}px`, position: 'relative' }}>
            {renderNestedPositions()}
          </div>
        </CineViewContext.Provider>
      );

      // 验证位置
      expectedPositions.forEach((expectedX, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          const actualLeft = parseFloat(style.left || '0');
          // 允许浮点数误差（百分比转换可能有精度损失）
          expect(Math.abs(actualLeft - expectedX)).toBeLessThanOrEqual(1);
        }
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.array(fc.integer({ min: 10, max: 100 }), { minLength: 2, maxLength: 5 }),
  ])(
    '纯相对定位序列：验证累加性',
    (designSize: number, viewportWidth: number, offsets: number[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const offs = offsets;

      const context = createTestContext(ds, vw);
      const scale = context.scale;

      // 计算累加位置
      let cumulativeX = 0;
      const expectedPositions = offs.map((offset) => {
        // 累加设计稿坐标
        cumulativeX += offset;
        // 转换为实际像素位置
        return (cumulativeX / ds) * vw;
      });

      // 渲染嵌套组件
      const renderNestedPositions = (offsets: number[], index: number = 0): React.ReactElement => {
        if (index >= offsets.length) {
          return <></>;
        }

        return (
          <Position offsetX={offsets[index]}>
            <div data-testid={`element-${index}`}>Element {index}</div>
            {renderNestedPositions(offsets, index + 1)}
          </Position>
        );
      };

      const { container } = render(
        <CineViewContext.Provider value={context}>
          {renderNestedPositions(offs)}
        </CineViewContext.Provider>
      );

      // 验证累加性
      expectedPositions.forEach((expectedX, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        if (element) {
          const style = window.getComputedStyle(element);
          const actualLeft = parseFloat(style.left || '0');
          // 允许浮点数误差（百分比转换可能有精度损失）
          expect(Math.abs(actualLeft - expectedX)).toBeLessThanOrEqual(1);
        }
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
  ])(
    '边界情况：单个绝对定位组件，位置应该等于 x * scale',
    (designSize: number, viewportWidth: number, x: number) => {
      const ds = designSize;
      const vw = viewportWidth;
      const xPos = x;

      const context = createTestContext(ds, vw);

      const { container } = render(
        <CineViewContext.Provider value={context}>
          <div style={{ width: `${vw}px`, position: 'relative' }}>
            <Position x={xPos}>
              <div data-testid="element-0">Element</div>
            </Position>
          </div>
        </CineViewContext.Provider>
      );

      const element = container.querySelector('[data-testid="element-0"]')?.parentElement;
      if (element) {
        const style = window.getComputedStyle(element);
        const actualLeft = parseFloat(style.left || '0');
        // 百分比系统：(设计稿坐标 / 设计稿尺寸) * 视口宽度
        const expectedLeft = (xPos / ds) * vw;
        // 允许浮点数误差（百分比转换可能有精度损失）
        expect(Math.abs(actualLeft - expectedLeft)).toBeLessThanOrEqual(1);
      }
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
    fc.integer({ min: -100, max: 100 }),
  ])(
    '边界情况：绝对定位优先于相对定位',
    (designSize: number, viewportWidth: number, x: number, offsetX: number) => {
      const ds = designSize;
      const vw = viewportWidth;
      const xPos = x;
      const offX = offsetX;

      const context = createTestContext(ds, vw);

      const { container } = render(
        <CineViewContext.Provider value={context}>
          <div style={{ width: `${vw}px`, position: 'relative' }}>
            <Position x={xPos} offsetX={offX}>
              <div data-testid="element-0">Element</div>
            </Position>
          </div>
        </CineViewContext.Provider>
      );

      const element = container.querySelector('[data-testid="element-0"]')?.parentElement;
      if (element) {
        const style = window.getComputedStyle(element);
        const actualLeft = parseFloat(style.left || '0');
        // 应该使用绝对定位 x，而不是 offsetX
        const expectedLeft = (xPos / ds) * vw;
        // 允许浮点数误差（百分比转换可能有精度损失）
        expect(Math.abs(actualLeft - expectedLeft)).toBeLessThanOrEqual(1);
      }
    }
  );
});
