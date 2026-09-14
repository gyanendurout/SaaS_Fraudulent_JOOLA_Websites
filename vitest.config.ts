import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // types.ts is type declarations only - no runtime code to cover.
      exclude: ['src/lib/types.ts', 'src/lib/**/*.test.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
