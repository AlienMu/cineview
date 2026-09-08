import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      cineview: path.resolve(__dirname, '../../src/index.ts'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  optimizeDeps: {
    exclude: ['cineview'],
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    setupFiles: ['./src/testSetup.ts'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for performance monitoring
      },
    },
  },
});
