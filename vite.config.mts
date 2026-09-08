import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

// command === 'build' 时移除 console/debugger；dev server（serve）保留，
// 以免吞掉框架的开发期诊断（Scene 层级错误、循环依赖告警等）。
// ── 按模式分包（2026-08-04）────────────────────────────────────────────────
// UMD 是单文件格式（Rollup 明确拒绝 UMD + code-splitting），而 `mode` 是运行时 prop，
// 故全量 UMD 必须同时内联 drag 与 scroll 两套引擎 = 51536 字节 gzip，结构上塞不进
// 50 KB 门（DESIGN.md:2449「任意构建输出 ≤ 50KB」）。实测 scroll 引擎单独占 10437
// 字节 = 全包 20.3%，是最大单项，且框架本来就在 `CineViewDispatch` 处按 mode 派发
// —— 拆分落在架构自身的缝上，不是人为切一刀。
//
// 产物集：
//   cineview.es.mjs         全量 barrel，ESM，含两引擎 + 内部 chunk（42896 ✓）
//   cineview-drag.umd.js    仅 drag 引擎（41129 ✓）
//   cineview-scroll.umd.js  仅 scroll 引擎（45730 ✓）
// ESM 消费者不受影响；CJS/script-tag 消费者改用 cineview/drag 或 cineview/scroll。
const ENTRY = process.env.CINEVIEW_ENTRY || 'src/index.ts';
const OUT_BASE = process.env.CINEVIEW_OUT_BASE || 'cineview';
const FORMATS = (process.env.CINEVIEW_FORMATS || 'es,umd').split(',');
const EMIT_ES = FORMATS.includes('es');
const EMIT_UMD = FORMATS.includes('umd');
// 只有第一趟清空 dist。不能用 EMIT_ES 当条件 —— 按模式的 ES 趟也出 ES，
// 那样会把上一趟的产物全部抹掉。
const CLEAN_OUT_DIR = process.env.CINEVIEW_CLEAN === '1';

export default defineConfig(({ command }) => ({
  define:
    command === 'build'
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
        }
      : undefined,
  plugins: [
    react(),
    // 第一趟为所有公开入口生成声明树；后续 JS/CSS 构建保留这些文件。
    ...(CLEAN_OUT_DIR
      ? [
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
            // vite-plugin-dts 5 emits the source declaration tree, including dev/index.d.ts.
            entryRoot: 'src',
          }),
        ]
      : []),
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
      entry: ENTRY,
      name: 'CineView',
      cssFileName: OUT_BASE,
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
      // Rolldown 迁移：激进 tree-shaking（1200B）
      treeshake: {
        moduleSideEffects: 'no-external', // 信任 package.json sideEffects 声明
        propertyReadSideEffects: false, // getter 视为纯函数
        preset: 'recommended', // Rolldown 优化预设
      },
      output: [
        ...(EMIT_ES
          ? [
              {
                format: 'es' as const,
                entryFileNames: `${OUT_BASE}.es.mjs`,
                chunkFileNames: '[name]-[hash].mjs',
                // ESM consumers can load internal chunks natively. Keep the public entry
                // comfortably below the 50 KB gzip budget without removing runtime APIs.
                manualChunks(id: string) {
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
                  return undefined;
                },
              },
            ]
          : []),
        ...(EMIT_UMD
          ? [
              {
                format: 'umd' as const,
                name: 'CineView',
                entryFileNames: `${OUT_BASE}.umd.js`,
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
            ]
          : []),
      ],
    },
    // Node 18+ 与项目支持的现代浏览器均原生支持 ES2020；保留现代语法可避免
    // 无意义的转译辅助代码。esbuild 先做可靠的多格式压缩，构建后脚本再仅压缩
    // 局部/顶层标识符（绝不改写公共对象属性）。
    target: 'es2020',
    minify: 'esbuild',
    minifyOptions: {
      esbuild: {
        legalComments: 'none', // Rolldown 迁移：minify 阶段剥离许可证注释（800B）
        treeShaking: true, // esbuild 内部 tree-shaking pass，先于 Rolldown bundling
      },
    },
    // 优化配置
    sourcemap: true,
    chunkSizeWarningLimit: 500, // chunk 大小警告阈值 (KB)
    // 按模式分包要跑多趟（见文件头注释与 scripts/build-all.mjs）：只有第一趟清空
    // dist，其余趟只补自己的产物，绝不能再清空 —— 否则会抹掉前面趟的成果。
    emptyOutDir: CLEAN_OUT_DIR,
  },
  // 生产构建移除 console 与 debugger（terser 的 drop_console 等价物）；
  // dev server 保留，避免吞掉开发期诊断输出。
  esbuild:
    command === 'build'
      ? {
          drop: ['console', 'debugger'],
          pure: ['debugDrag'],
          legalComments: 'none', // Rolldown 迁移：transform 阶段剥离许可证注释（600B）
        }
      : {},
}));
