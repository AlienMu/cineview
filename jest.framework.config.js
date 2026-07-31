const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testPathIgnorePatterns: [
    ...(baseConfig.testPathIgnorePatterns || []),
    '<rootDir>/src/__tests__/site/',
  ],
};
