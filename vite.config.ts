import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/// <reference types="vitest" />

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  // Assure le support workers module et assets .wasm chargés via ?url
  worker: { format: 'es' },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
});
