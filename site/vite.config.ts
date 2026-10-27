import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The homepage (/), the drag demo (/drag/) and the examples (/examples/<name>/) are static pages in
// public/; the docs (/docs, /docs/<slug>) are the React app in docs-app.html. Cloudflare Pages serves
// a directory's index.html and _redirects rewrites /docs paths to docs-app (not docs.html: Pages drops
// the .html, so /docs.html would redirect to /docs and loop); the dev and preview servers do the same.
const route: Connect.NextHandleFunction = (req, _res, next) => {
  const [path, query = ''] = (req.url ?? '').split(/\?(.*)/s);
  const q = query ? `?${query}` : '';
  if (path === '/' || path === '/index.html') req.url = `/index.html${q}`;
  else if (path === '/drag' || path === '/drag/') req.url = `/drag/index.html${q}`;
  else if (/^\/examples\/[a-z0-9-]+\/?$/.test(path)) req.url = `${path.replace(/\/?$/, '/')}index.html${q}`;
  else if (path === '/docs' || path.startsWith('/docs/')) req.url = `/docs-app.html${q}`;
  next();
};
const pages = (): Plugin => ({
  name: 'cineview-site-pages',
  configureServer: (server) => void server.middlewares.use(route),
  configurePreviewServer: (server) => void server.middlewares.use(route),
});

export default defineConfig({
  plugins: [pages(), react()],
  server: { port: 4000, open: '/' },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: { input: { docs: 'docs-app.html' } },
  },
});
