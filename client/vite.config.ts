/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.API_URL ?? 'http://127.0.0.1:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
