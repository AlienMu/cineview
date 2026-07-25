import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Site references the BUILT cineview package (dist), not source — see Q12.
// No src alias: resolves via package.json main/module → dist/cineview.es.mjs.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  server: {
    port: 4000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
