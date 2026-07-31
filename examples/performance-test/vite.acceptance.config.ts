import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      cineview: path.resolve(__dirname, '../../dist/cineview.es.mjs'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  optimizeDeps: {
    exclude: ['cineview'],
  },
  build: {
    outDir: 'dist-acceptance',
    emptyOutDir: true,
    sourcemap: true,
  },
});
