import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    // 生成 TypeScript 类型定义文件
    dts({
      include: ['src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      rollupTypes: true, // 将所有类型定义打包到单个文件
    }),
    // Gzip 压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024, // 只压缩大于 1KB 的文件
      deleteOriginFile: false,
    }),
    // Bundle 分析报告
    visualizer({
      open: false, // 不自动打开浏览器
      gzipSize: true,
      brotliSize: true,
      filename: 'stats.html',
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'CineView',
      formats: ['es', 'umd'],
      fileName: (format) => `cineview.${format}.js`,
    },
    rollupOptions: {
      // 外部化依赖，不打包到 bundle 中
      external: ['react', 'react-dom', 'framer-motion'],
      output: {
        // UMD 格式的全局变量名
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'framer-motion': 'FramerMotion',
        },
        // 代码分割配置 - 动画预设通过动态 import 自动分割
        // 注意：库模式下 Vite 会自动处理动态 import，无需手动配置 manualChunks
      },
    },
    // 使用 Terser 压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 移除 console
        drop_debugger: true, // 移除 debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 移除特定函数调用
      },
      format: {
        comments: false, // 移除注释
      },
    },
    // 优化配置
    sourcemap: false, // 生产环境不生成 sourcemap
    chunkSizeWarningLimit: 500, // chunk 大小警告阈值 (KB)
  },
});
