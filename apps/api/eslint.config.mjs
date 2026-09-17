import { baseConfig } from '@revn/config/eslint/base.mjs';

export default [
  ...baseConfig,
  {
    rules: {
      // NestJS DI relies on empty constructors and decorator-only classes.
      '@typescript-eslint/no-extraneous-class': 'off',
      // NestJS's DI and ValidationPipe both read constructor-parameter types
      // from `design:paramtypes` reflection metadata at runtime. `import
      // type` erases the import entirely, so a class used only as a
      // constructor param type (an injected service) or an @Body() DTO type
      // silently becomes `undefined` in that metadata — the app still
      // typechecks and builds, but crashes at boot with
      // "Nest can't resolve dependencies". `eslint --fix` cannot tell an
      // injected/validated class apart from a plain type reference, so this
      // rule is off here rather than risk it "fixing" a real bug in.
      // See docs/DECISIONS.md.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    ignores: ['dist/**'],
  },
];
