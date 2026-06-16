import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS relies on emitDecoratorMetadata; vitest's default esbuild transform
// drops decorator metadata, so we use the SWC plugin to preserve it.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['reflect-metadata'],
    // Integration specs share one Postgres and TRUNCATE between cases, so test
    // files must run serially — parallel files would wipe each other's data.
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
