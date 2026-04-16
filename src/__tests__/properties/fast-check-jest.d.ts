/**
 * 类型声明文件：修复 @fast-check/jest 的类型问题
 *
 * @fast-check/jest 的类型定义在某些情况下会导致 TypeScript 报错
 * "Type 'Arbitrary<T>' is missing the following properties from type 'Arbitrary<T>': noShrink, noBias"
 *
 * 这个文件提供了更宽松的类型定义来解决这个问题
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
