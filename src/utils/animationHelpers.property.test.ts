/**
 * Property-Based Tests for Animation Helpers
 * Validates mathematical properties and boundary conditions of animation helper functions
 */

import { test } from '@fast-check/jest';
import * as fc from 'fast-check';
import { interpolateVariant } from './animationHelpers';

describe('Property: interpolateVariant', () => {
  describe('Mathematical properties', () => {
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
      'Property 1: Start interpolation (progress=0) returns start value',
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
      'Property 2: End interpolation (progress=1) returns end value',
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
      'Property 3: Midpoint interpolation (progress=0.5) returns middle value',
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
      'Property 4: Linear interpolation formula result = start + (end - start) * progress',
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

  describe('Monotonicity properties', () => {
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
      'Property 5: Monotonicity - if progress1 < progress2, interpolation result changes monotonically between start and end',
      (start: Record<string, number>, end: Record<string, number>, p1: number, p2: number) => {
        const progress1 = Math.min(p1, p2);
        const progress2 = Math.max(p1, p2);

        if (progress1 === progress2) return;

        const result1 = interpolateVariant(start, end, progress1);
        const result2 = interpolateVariant(start, end, progress2);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const val1 = result1[key] as number;
          const val2 = result2[key] as number;

          if (startVal < endVal) {
            expect(val1).toBeLessThanOrEqual(val2 + 1e-10);
          } else if (startVal > endVal) {
            expect(val1).toBeGreaterThanOrEqual(val2 - 1e-10);
          } else {
            expect(val1).toBeCloseTo(val2, 10);
          }
        });
      }
    );
  });

  describe('Boundary conditions', () => {
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
      'Property 6: Interpolation result stays within [min(start, end), max(start, end)] range',
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
      'Property 7: When start === end, any progress returns the same value',
      (start: Record<string, number>, _end: Record<string, number>) => {
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

  describe('String value handling', () => {
    test.prop([
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      'Property 8: px string values interpolate correctly',
      (startNum: number, endNum: number, progress: number) => {
        const start = { x: `${startNum}px` };
        const end = { x: `${endNum}px` };

        const result = interpolateVariant(start, end, progress);

        const expected = startNum + (endNum - startNum) * progress;
        const resultNum = parseFloat(result.x as string);

        expect(resultNum).toBeCloseTo(expected, 5);
        expect(result.x).toMatch(/^-?\d+(\.\d+)?(e[+-]?\d+)?px$/);
      }
    );

    test.prop([fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })])(
      'Property 9: px string at progress=0 returns start value',
      (startNum: number, endNum: number) => {
        const start = { width: `${startNum}px` };
        const end = { width: `${endNum}px` };

        const result = interpolateVariant(start, end, 0);

        expect(result.width).toBe(`${startNum}px`);
      }
    );

    test.prop([fc.integer({ min: 0, max: 1000 }), fc.integer({ min: 0, max: 1000 })])(
      'Property 10: px string at progress=1 returns end value',
      (startNum: number, endNum: number) => {
        const start = { width: `${startNum}px` };
        const end = { width: `${endNum}px` };

        const result = interpolateVariant(start, end, 1);

        expect(result.width).toBe(`${endNum}px`);
      }
    );
  });

  describe('Non-numeric type handling', () => {
    test.prop([
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.constantFrom('visible', 'hidden', 'collapse'),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      'Property 11: Non-numeric type at progress <= 0.5 returns start value',
      (startVal: string, endVal: string, progress: number) => {
        if (progress > 0.5) return;

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
      'Property 12: Non-numeric type at progress > 0.5 returns end value',
      (startVal: string, endVal: string, progress: number) => {
        if (progress <= 0.5) return;

        const start = { visibility: startVal };
        const end = { visibility: endVal };

        const result = interpolateVariant(start, end, progress);

        expect(result.visibility).toBe(endVal);
      }
    );
  });

  describe('Missing value handling', () => {
    test.prop([
      fc.record({
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
      fc.double({ min: 0, max: 1, noNaN: true }),
    ])(
      'Property 13: When start is missing properties, use default values (opacity=1, others=0)',
      (end: Record<string, number>, progress: number) => {
        const start = {};

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
    ])('Property 14: Missing opacity defaults to 1', (end: Record<string, number>) => {
      const start = {};

      const result = interpolateVariant(start, end, 0);

      if (end.opacity !== undefined) {
        expect(result.opacity).toBeCloseTo(1, 10);
      }
    });

    test.prop([
      fc.record({
        x: fc.double({ min: -1000, max: 1000, noNaN: true }),
        y: fc.double({ min: -1000, max: 1000, noNaN: true }),
      }),
    ])(
      'Property 15: Missing non-opacity properties default to 0',
      (end: Record<string, number>) => {
        const start = {};

        const result = interpolateVariant(start, end, 0);

        Object.keys(end).forEach((key) => {
          if (key !== 'opacity') {
            expect(result[key]).toBeCloseTo(0, 10);
          }
        });
      }
    );
  });

  describe('Transition property handling', () => {
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
      'Property 16: Transition properties are ignored and excluded from result',
      (start: Record<string, unknown>, end: Record<string, unknown>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        expect(result.transition).toBeUndefined();
      }
    );
  });

  describe('Combined property tests', () => {
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
      'Property 17: Multiple properties interpolate independently',
      (start: Record<string, number>, end: Record<string, number>, progress: number) => {
        const result = interpolateVariant(start, end, progress);

        Object.keys(end).forEach((key) => {
          const startVal = start[key] as number;
          const endVal = end[key] as number;
          const expected = startVal + (endVal - startVal) * progress;

          expect(result[key]).toBeCloseTo(expected, 10);
        });

        expect(Object.keys(result).length).toBeGreaterThanOrEqual(Object.keys(end).length);
      }
    );
  });
});
