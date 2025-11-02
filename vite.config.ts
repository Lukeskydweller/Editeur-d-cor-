import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  // Assure le support workers module et assets .wasm chargés via ?url
  worker: { format: "es" },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    css: true,
    coverage: { reporter: ['text', 'html'] },
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
