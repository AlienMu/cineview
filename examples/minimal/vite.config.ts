import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Unlike examples/performance-test (aliased to src/ for framework coverage
// work), this teaching example consumes the built package exactly like a real
// consumer: `cineview: link:../../` resolves through package.json exports to
// dist/. Run `pnpm build` at the repo root first — then `pnpm dev` here runs
// the published artifact, and `pnpm type-check` acts as a public-API drift
// sentinel against dist/index.d.ts.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  // Linked package: keep it out of dep pre-bundling so its own bare imports
  // (react, framer-motion) resolve through this app's node_modules — same
  // single-instance fix performance-test uses.
  optimizeDeps: {
    exclude: ['cineview'],
  },
  server: {
    port: 4100,
    open: true,
  },
});
