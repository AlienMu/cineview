import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// command === 'build' 时移除 console/debugger；dev server（serve）保留，
// 以免吞掉框架的开发期诊断（Scene 层级错误、循环依赖告警等）。
export default defineConfig(({ command }) => ({
  define:
    command === 'build'
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
        }
      : undefined,
  plugins: [
    react(),
    // 生成 TypeScript 类型定义文件
    dts({
      include: ['src'],
      // 排除所有非导出链文件：测试、测试环境搭建（setupTests 的 `declare global`
      // 曾泄漏进 dist/index.d.ts，把 `var act` 打进消费者全局作用域）、编译期
      // type-assert fixture。dist 类型只应包含 src/index.ts 导出链可达的声明。
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        'src/setupTests.ts',
        '**/*.type-assert.*',
      ],
      rollupTypes: true, // 将所有类型定义打包到单个文件
    }),
    // Gzip 压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      filter: /\.(js|mjs|cjs|json|css|html)$/i,
      threshold: 1024, // 只压缩大于 1KB 的文件
      compressionOptions: { level: 9 },
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
      output: [
        {
          format: 'es',
          entryFileNames: 'cineview.es.mjs',
          chunkFileNames: '[name]-[hash].mjs',
          // ESM consumers can load internal chunks natively. Keep the public entry
          // comfortably below the 50 KB gzip budget without removing runtime APIs.
          manualChunks(id) {
            if (id.endsWith('/src/utils/performanceMonitor.ts')) {
              return 'performance-monitor';
            }
            if (id.endsWith('/src/components/Scene/useSceneAnimationRegistry.ts')) {
              return 'scene-animation-registry';
            }
            if (id.endsWith('/src/components/Scene/useDragSceneEngine.ts')) {
              return 'drag-scene-engine';
            }
            if (id.endsWith('/src/components/Scene/useElementTrack.ts')) {
              return 'element-track';
            }
          },
        },
        {
          format: 'umd',
          name: 'CineView',
          entryFileNames: 'cineview.umd.js',
          inlineDynamicImports: true,
          // UMD remains a single-file artifact for script-tag/CommonJS consumers.
          globals: {
            react: 'React',
            'react/jsx-runtime': 'ReactJSXRuntime',
            'react/jsx-dev-runtime': 'ReactJSXDevRuntime',
            'react-dom': 'ReactDOM',
            'framer-motion': 'FramerMotion',
          },
        },
      ],
    },
    // Node 18+ 与项目支持的现代浏览器均原生支持 ES2020；保留现代语法可避免
    // 无意义的转译辅助代码。esbuild 先做可靠的多格式压缩，构建后脚本再仅压缩
    // 局部/顶层标识符（绝不改写公共对象属性）。
    target: 'es2020',
    minify: 'esbuild',
    // 优化配置
    sourcemap: true,
    chunkSizeWarningLimit: 500, // chunk 大小警告阈值 (KB)
  },
  // 生产构建移除 console 与 debugger（terser 的 drop_console 等价物）；
  // dev server 保留，避免吞掉开发期诊断输出。
  esbuild: command === 'build' ? { drop: ['console', 'debugger'], pure: ['debugDrag'] } : {},
}));
