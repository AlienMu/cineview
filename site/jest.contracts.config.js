/** Site content contracts: the documentation pages' structure, links and frontmatter. */
import { fileURLToPath } from 'node:url';

export default {
  rootDir: fileURLToPath(new URL('.', import.meta.url)),
  roots: ['<rootDir>/tests'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', target: 'ES2022', esModuleInterop: true, isolatedModules: true } },
    ],
  },
};
