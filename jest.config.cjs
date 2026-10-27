/**
 * Unit tests for 2.0 (src). Separate from the 1.x suite, whose roots are the root src/.
 * Type-checking is `tsc -p tsconfig.json`; here ts-jest only transpiles.
 */
module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  testMatch: ['**/*.test.ts'],
  globals: { __DEV__: true },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};
