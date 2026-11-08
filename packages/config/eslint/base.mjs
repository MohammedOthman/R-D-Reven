// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

// Deliberately just .ts/.tsx — not .mts/.cts. eslint-config-next's own
// `next/typescript` config (apps/web only) re-establishes the
// typescript-eslint parser for .ts/.tsx after its broader `next` config sets
// a different one for every extension including .mts/.cts, so those two
// extensions would fail here with "no parser services" in apps/web specifically.
const TS_FILES = ['**/*.ts', '**/*.tsx'];

/** Shared ESLint flat config used as the base for every app/package. */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    // Scoped to TS files only — these rules need typescript-eslint's parser
    // services, which aren't available when a file is linted under a
    // different parser (e.g. a plain .mjs config file).
    files: TS_FILES,
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**', 'generated/**'],
  },
);

export default baseConfig;
