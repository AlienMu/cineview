import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 与 vite.acceptance.config.ts 同构：吃构建后的 dist，测的是发布产物。
// root 必须显式钉死：pnpm exec 会把子目录命令跑在包根，不钉 root 会 build 到
// performance-test/dist（2026-08-16 探针跑错对象的根因）。
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      cineview: path.resolve(__dirname, '../../../dist/cineview.es.mjs'),
    },
    dedupe: ['react', 'react-dom', 'framer-motion'],
  },
  optimizeDeps: {
    exclude: ['cineview'],
  },
});
