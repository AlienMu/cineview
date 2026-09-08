/**
 * Property-Based Test: Relative Position Accumulation
 * **Validates: Requirements 10.4**
 *
 * Property 5: Each component's final position equals the sum of all preceding component positions
 * Formalized: Ci.finalX = Σ(Cj.x + Cj.offsetX) for j ∈ [1, i]
 */

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

describe('Property: Relative Position Accumulation', () => {
  // Create test context
  const createTestContext = (designSize: number, viewportWidth: number): CineViewContextValue => {
    const scale = viewportWidth / designSize;
    return {
      scale,
      convert: (size: number): number => size * scale,
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
        .filter((pos: PositionConfig) => pos.x !== undefined || pos.offsetX !== undefined), // at least one defined
      { minLength: 2, maxLength: 5 }
    ),
  ])(
    'Relative positioning sequence: each component final position should equal the sum of all preceding positions',
    (designSize: number, viewportWidth: number, positions: PositionConfig[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const pos = positions;

      const context = createTestContext(ds, vw);

      // Calculate expected final position for each component
      // Position component uses percentage system: all coordinates are design coordinates
      let cumulativeX = 0;
      const expectedPositions: number[] = [];

      pos.forEach((p) => {
        if (p.x !== undefined) {
          // Absolute positioning: use design coordinate directly
          cumulativeX = p.x;
        } else if (p.offsetX !== undefined) {
          // Relative positioning: accumulate design coordinate
          cumulativeX += p.offsetX;
        }
        // Convert to actual pixel position after percentage: (design coordinate / design size) * viewport width
        expectedPositions.push((cumulativeX / ds) * vw);
      });

      // Render nested components to implement accumulation
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
          <div style={{ width: `${vw}px`, position: 'relative' }}>{renderNestedPositions(pos)}</div>
        </CineViewContext.Provider>
      );

      // Verify actual position of each element
      // forEach over an empty array asserts nothing; pin the count first.
      expect(pos.length).toBeGreaterThan(0);
      pos.forEach((_, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        // Must assert non-null first: `if (element)` would let those 100 runs where the wrapper never rendered all pass empty.
        expect(element).not.toBeNull();
        const style = window.getComputedStyle(element!);
        const actualLeft = parseFloat(style.left || '0');

        // Allow floating-point error (percentage conversion may lose precision)
        expect(Math.abs(actualLeft - expectedPositions[index])).toBeLessThanOrEqual(1);
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
    fc.array(fc.integer({ min: -50, max: 50 }), { minLength: 1, maxLength: 5 }),
  ])(
    'Mixed positioning: first component uses absolute positioning, subsequent components use relative positioning',
    (designSize: number, viewportWidth: number, absoluteX: number, relativeOffsets: number[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const absX = absoluteX;
      const offsets = relativeOffsets;

      const context = createTestContext(ds, vw);

      // Calculate expected positions
      const expectedPositions: number[] = [];
      // Absolute positioning: design coordinate to percentage
      let currentX = absX;
      expectedPositions.push((currentX / ds) * vw);

      offsets.forEach((offset) => {
        // Relative positioning: accumulate design coordinate
        currentX += offset;
        expectedPositions.push((currentX / ds) * vw);
      });

      // Render nested components
      const renderNestedPositions = (): React.ReactElement => {
        let result: React.ReactElement = <></>;

        // Build nested structure backwards
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
          <div style={{ width: `${vw}px`, position: 'relative' }}>{renderNestedPositions()}</div>
        </CineViewContext.Provider>
      );

      // Verify positions
      // forEach over an empty array asserts nothing; pin the count first.
      expect(expectedPositions.length).toBeGreaterThan(0);
      expectedPositions.forEach((expectedX, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        // Must assert non-null first: `if (element)` would let those runs where the wrapper never rendered all pass empty.
        expect(element).not.toBeNull();
        const style = window.getComputedStyle(element!);
        const actualLeft = parseFloat(style.left || '0');
        // Allow floating-point error (percentage conversion may lose precision)
        expect(Math.abs(actualLeft - expectedX)).toBeLessThanOrEqual(1);
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.array(fc.integer({ min: 10, max: 100 }), { minLength: 2, maxLength: 5 }),
  ])(
    'Pure relative positioning sequence: verify accumulation',
    (designSize: number, viewportWidth: number, offsets: number[]) => {
      const ds = designSize;
      const vw = viewportWidth;
      const offs = offsets;

      const context = createTestContext(ds, vw);

      // Calculate cumulative positions
      let cumulativeX = 0;
      const expectedPositions = offs.map((offset) => {
        // Accumulate design coordinate
        cumulativeX += offset;
        // Convert to actual pixel position
        return (cumulativeX / ds) * vw;
      });

      // Render nested components
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

      // Verify accumulation
      // forEach over an empty array asserts nothing; pin the count first.
      expect(expectedPositions.length).toBeGreaterThan(0);
      expectedPositions.forEach((expectedX, index) => {
        const element = container.querySelector(`[data-testid="element-${index}"]`)?.parentElement;
        // Must assert non-null first: `if (element)` would let those runs where the wrapper never rendered all pass empty.
        expect(element).not.toBeNull();
        const style = window.getComputedStyle(element!);
        const actualLeft = parseFloat(style.left || '0');
        // Allow floating-point error (percentage conversion may lose precision)
        expect(Math.abs(actualLeft - expectedX)).toBeLessThanOrEqual(1);
      });
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
  ])(
    'Edge case: single absolute positioning component, position should equal x * scale',
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
      // Must assert non-null first: `if (element)` would let those runs where the wrapper never rendered all pass empty.
      expect(element).not.toBeNull();
      const style = window.getComputedStyle(element!);
      const actualLeft = parseFloat(style.left || '0');
      // Percentage system: (design coordinate / design size) * viewport width
      const expectedLeft = (xPos / ds) * vw;
      // Allow floating-point error (percentage conversion may lose precision)
      expect(Math.abs(actualLeft - expectedLeft)).toBeLessThanOrEqual(1);
    }
  );

  test.prop([
    fc.integer({ min: 300, max: 2000 }),
    fc.integer({ min: 320, max: 1920 }),
    fc.integer({ min: 0, max: 500 }),
    fc.integer({ min: -100, max: 100 }),
  ])(
    'Edge case: absolute positioning takes precedence over relative positioning',
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
      // Must assert non-null first: `if (element)` would let those runs where the wrapper never rendered all pass empty.
      expect(element).not.toBeNull();
      const style = window.getComputedStyle(element!);
      const actualLeft = parseFloat(style.left || '0');
      // Should use absolute positioning x, not offsetX
      const expectedLeft = (xPos / ds) * vw;
      // Allow floating-point error (percentage conversion may lose precision)
      expect(Math.abs(actualLeft - expectedLeft)).toBeLessThanOrEqual(1);
    }
  );
});
