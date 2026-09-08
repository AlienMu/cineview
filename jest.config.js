module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.type-assert.tsx',
  ],
  // Above setupTests.ts's RTL asyncUtilTimeout (5000ms). If the two are equal — and
  // jest's default per-test timeout IS 5000 — a retrying waitFor consumes the whole
  // test budget and jest reports an opaque "Exceeded timeout" instead of the
  // assertion that never became true. The headroom is what makes a slow-but-correct
  // wait report properly rather than looking like a hang.
  testTimeout: 15000,
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
  },
};
