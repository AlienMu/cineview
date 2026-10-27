import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Serves the fixtures (fixtures/, runtime from src) for the gate. The 1.x comparison fixtures
// (fixtures/v1) load the 1.x build kept in review/2026-10-28-v2-release/v1-baseline (not in Git).
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  root: here('./fixtures'),
  resolve: {
    alias: {
      cineview: here('./review/2026-10-28-v2-release/v1-baseline/dist/cineview.es.mjs'),
      '@v2': process.env.CV_V2_ENTRY ? resolve(process.env.CV_V2_ENTRY) : here('./src/index.ts'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  esbuild: { jsx: 'automatic' },
  // 2.0 sources use a build-time flag for craft warnings (build.mjs defines it per build).
  // Measurements run without them (CV_DEV=0), as the production build would.
  define: { __DEV__: process.env.CV_DEV === '0' ? 'false' : 'true' },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.CV_PORT ?? 4360),
    strictPort: true,
    fs: { allow: [here('.')] },
  },
  build: {
    outDir: here('./fixtures-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: { v2: here('./fixtures/v2.html'), v1: here('./fixtures/v1/index.html') },
    },
  },
});
