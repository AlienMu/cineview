import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// /hero/ is a static 2.0 page in public/ (the homepage preview). Cloudflare Pages serves a
// directory's index.html; Vite's dev and preview servers fall back to the React app instead, so map
// the directory URL to its file here.
const serveHero: Connect.NextHandleFunction = (req, _res, next) => {
  const path = req.url?.split('?')[0];
  const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  // /hero/ and its pages (/hero/drag/) are static: send each directory to its index.html.
  const page = /^\/hero(?:\/(drag))?\/?$/.exec(path ?? '');
  if (page) req.url = `/hero/${page[1] ? page[1] + '/' : ''}index.html${query}`;
  next();
};
const heroPage = (): Plugin => ({
  name: 'cineview-hero-page',
  configureServer: (server) => void server.middlewares.use(serveHero),
  configurePreviewServer: (server) => void server.middlewares.use(serveHero),
});

// Site references the BUILT cineview package (dist), not source — see Q12.
// No src alias: resolves via package.json main/module → dist/cineview.es.mjs.
export default defineConfig({
  plugins: [heroPage(), react()],
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
