import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['src/**/*.ts', 'server/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // Allow explicit `any` with a warning — useful for Express handler signatures
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars are warnings, underscore-prefixed are fully exempt
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      // Empty catch blocks are intentional (fetch error swallowing pattern used throughout)
      'no-empty': ['warn', { allowEmptyCatch: true }],
      // Allow empty object types
      '@typescript-eslint/no-empty-object-type': 'warn',
      // no-unused-expressions: allow expression statements (e.g. chained optional calls)
      '@typescript-eslint/no-unused-expressions': 'warn',
      // Consistent import style
      'no-duplicate-imports': 'error',
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**', 'dist-server/**', 'coverage/**', '*.config.js'],
  },
);
