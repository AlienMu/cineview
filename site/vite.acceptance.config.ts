import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      cineview: path.resolve(__dirname, '../dist/cineview.es.mjs'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  optimizeDeps: {
    exclude: ['cineview'],
  },
  build: {
    outDir: 'dist-acceptance',
    rollupOptions: { input: path.resolve(__dirname, 'acceptance.html') },
    emptyOutDir: true,
    sourcemap: true,
  },
});
