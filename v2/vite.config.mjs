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
  // 2.0 sources use a build-time flag for craft warnings (v2/build.mjs defines it per build).
  // Measurements run without them (CV_DEV=0), as the production build would.
  define: { __DEV__: process.env.CV_DEV === '0' ? 'false' : 'true' },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.CV_PORT ?? 4360),
    strictPort: true,
    fs: { allow: [here('..')] },
  },
  build: {
    outDir: here('./fixtures-dist'),
    emptyOutDir: true,
    rollupOptions: { input: { v2: here('./fixtures/v2.html'), v1: here('./fixtures/v1/index.html') } },
  },
});
