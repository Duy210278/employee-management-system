import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC thay esbuild để giữ decorator metadata mà NestJS cần cho dependency injection
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
