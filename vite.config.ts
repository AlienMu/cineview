import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// command === 'build' 时移除 console/debugger；dev server（serve）保留，
// 以免吞掉框架的开发期诊断（Scene 层级错误、循环依赖告警等）。
export default defineConfig(({ command }) => ({
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
      filter: /\.(js|mjs|cjs|json|css|html)$/i,
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
      fileName: (format) => (format === 'umd' ? 'cineview.umd.js' : 'cineview.es.mjs'),
    },
    rollupOptions: {
      // 外部化依赖，不打包到 bundle 中
      external: [
        'react',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-dom',
        'framer-motion',
      ],
      output: {
        // UMD 格式的全局变量名
        globals: {
          react: 'React',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'react/jsx-dev-runtime': 'ReactJSXDevRuntime',
          'react-dom': 'ReactDOM',
          'framer-motion': 'FramerMotion',
        },
        // 代码分割配置 - 动画预设通过动态 import 自动分割
        // 注意：库模式下 Vite 会自动处理动态 import，无需手动配置 manualChunks
      },
    },
    // 使用 esbuild 压缩。注意：lib 多格式（es + umd）下用 terser 时，terser 只会
    // 压缩 umd 输出而静默跳过 es 输出（Vite 已知问题），导致 es 包未压缩、体积翻倍且
    // console 残留。esbuild 对两种格式都可靠压缩，并通过 esbuild.drop 移除 console。
    minify: 'esbuild',
    // 优化配置
    sourcemap: true,
    chunkSizeWarningLimit: 500, // chunk 大小警告阈值 (KB)
  },
  // 生产构建移除 console 与 debugger（terser 的 drop_console 等价物）；
  // dev server 保留，避免吞掉开发期诊断输出。
  esbuild: command === 'build' ? { drop: ['console', 'debugger'] } : {},
}));
