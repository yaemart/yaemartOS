import { createRequire } from 'module';
import tseslint from 'typescript-eslint';

const require = createRequire(import.meta.url);
const baseConfig = require('@yaemartos/eslint-config');

export default tseslint.config(
  ...baseConfig,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      '**/.next/**',
      '.next/**',
      '**/dist/**',
      'out/**',
      'build/**',
      '**/*.tsbuildinfo',
      'apps/api/generated/**',
      'apps/api/src/generated/**',
      'storybook-static/**',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      curly: ['warn', 'all'],
    },
  },
);
