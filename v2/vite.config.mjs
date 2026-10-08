import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Serves 2.0 fixtures (v2/src) and 1.x fixtures (root dist, React) side by side for the gate.
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here('./fixtures'),
  resolve: {
    alias: { cineview: here('../dist/cineview.es.mjs'), '@v2': here('./src/index.ts') },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 4360, strictPort: true, fs: { allow: [here('..')] } },
  build: {
    outDir: here('./fixtures-dist'),
    emptyOutDir: true,
    rollupOptions: { input: { v2: here('./fixtures/v2.html'), v1: here('./fixtures/v1/index.html') } },
  },
});
