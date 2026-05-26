import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'src/shared/components/ui/dropdown-menu.tsx',
        'src/shared/components/ui/separator.tsx',
      ],
    },
  },
  resolve: {
    alias: [
      // Shim for the unpublished `airweave-connect` workspace pkg that
      // `@airweave/connect-react` declares as a dep. Mirrors vite.config.ts.
      // The suite-level vi.mock('@airweave/connect-react', ...) in
      // src/test/setup.ts still wins for tests that exercise the SDK
      // surface; this alias is the belt-and-suspenders for any test that
      // transitively imports the SDK module graph without a local mock.
      {
        find: /^airweave-connect\/lib\/(.*)$/,
        replacement: path.resolve(__dirname, './src/shims/airweave-connect/lib/$1'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@shared', replacement: path.resolve(__dirname, './src/shared') },
      { find: '@features', replacement: path.resolve(__dirname, './src/features') },
    ],
  },
});
