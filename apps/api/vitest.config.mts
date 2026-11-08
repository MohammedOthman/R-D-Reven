import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    // NestJS's DI reads constructor parameter types from decorator metadata,
    // which esbuild (Vitest's default transform) does not emit. SWC does.
    // Module output is forced to ES modules here regardless of .swcrc (which
    // targets CommonJS for `nest build`'s Node output) — Vitest requires ESM.
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
  test: {
    environment: 'node',
    globals: true,
    root: './',
  },
});
