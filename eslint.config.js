// Flat config (ESLint 9+ default, required by 10). Replaces .eslintrc.js —
// `extends` / `env` / `overrides` are gone; presets are spread as objects and
// per-glob relaxations are just later entries in the array.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, ...globals.jest },
    },
    // Pinned rather than 'detect': eslint-plugin-react 7.37.5 (its latest) resolves
    // 'detect' through context.getFilename(), which ESLint 10 removed — the plugin
    // throws before linting a single file. Keep this in step with the React dev
    // dependency; the rules it gates are prop-types/lifecycle ones we disable anyway.
    settings: { react: { version: '18.3' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // 测试文件中放宽规则：jest mock 工厂需要 require()，mock 组件/签名常用 any，
    // mock 的 motion 组件参数（onPan 等）按位置声明可不消费
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/__tests__/**/*.{ts,tsx}',
      // Fixtures are test support, not shipped code: they deliberately model
      // consumer-shaped (often untyped) usage.
      '**/__fixtures__/**/*.{ts,tsx,js,jsx}',
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  prettier,
];
