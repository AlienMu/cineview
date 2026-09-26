import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Consume the built package through its public exports, as an installed app does.
// Build the root package before starting this example.
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  // Linked package: keep it out of dep pre-bundling so its own bare imports
  // (react, framer-motion) resolve through this app's node_modules.
  optimizeDeps: {
    exclude: ['cineview'],
  },
  server: {
    port: 4100,
    open: true,
  },
});
