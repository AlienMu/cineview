/**
 * Type declaration file: fixes type issues with @fast-check/jest
 *
 * @fast-check/jest's type definitions can cause TypeScript errors in some cases:
 * "Type 'Arbitrary<T>' is missing the following properties from type 'Arbitrary<T>': noShrink, noBias"
 *
 * This file provides a more permissive type definition to resolve the issue
 */

declare module '@fast-check/jest' {
  import type { Arbitrary } from 'fast-check';

  export interface TestProp {
    <T extends unknown[]>(
      arbitraries: { [K in keyof T]: Arbitrary<T[K]> },
      params?: unknown
    ): (label: string, predicate: (...args: T) => void | Promise<void>) => void;
  }

  export const test: {
    prop: TestProp;
  } & typeof import('@jest/globals').test;
}
