const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  coverageReporters: [...baseConfig.coverageReporters, 'json-summary'],
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '<rootDir>/src/__tests__/site/',
  ],
};
