import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import excludeJson from './coverage-exclude.json' assert { type: 'json' };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    css: true,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        // ⚠️ Exclusions temporaires (budget géré par coverage-exclude.json)
        // TODO: Gradually add tests and remove from coverage-exclude.json
        // Budget enforced by scripts/check-coverage-exclude.mjs (CI gate)
        ...excludeJson.files,
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        autoUpdate: false,
        perFile: true, // ✅ Strict per-file enforcement
        // ⚠️ LIMITATION: Vitest 4.0.6 ne supporte PAS les glob patterns dans thresholds
        // Les patterns ci-dessous ne fonctionnent pas, d'où l'exclusion via coverage.exclude
        // Cf. https://github.com/vitest-dev/vitest/issues/4828
        // SOCLE STRICT (garde-fou)
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
});
