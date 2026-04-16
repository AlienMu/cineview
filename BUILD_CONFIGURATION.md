# CineView 构建配置文档

## 概述

CineView 使用 Vite 作为构建工具，配置了完整的构建优化、代码分割、类型定义生成和 Bundle 分析功能。

## 构建目标

- ✅ **ES 模块和 UMD 模块**: 支持现代浏览器和传统环境
- ✅ **TypeScript 类型定义**: 完整的类型支持
- ✅ **代码分割**: 动画预设按需加载
- ✅ **Terser 压缩**: 移除 console 和 debugger
- ✅ **Gzip 压缩**: 减小传输体积
- ✅ **Bundle 分析**: 可视化 Bundle 组成
- ✅ **Bundle 大小限制**: 主包 < 50KB (gzipped)

## 构建输出

### 主要文件

```
dist/
├── cineview.es.js          # ES 模块 (~101 KB, ~22 KB gzipped)
├── cineview.es.js.gz       # ES 模块 gzip 压缩版本
├── cineview.umd.js         # UMD 模块 (~45 KB, ~14 KB gzipped)
├── cineview.umd.js.gz      # UMD 模块 gzip 压缩版本
├── index.d.ts              # TypeScript 类型定义 (~12 KB)
└── [animation-chunks].mjs  # 动画预设代码分割 chunks
```

### 代码分割 Chunks

动画预设按分类自动分割成独立的 chunks，实现按需加载：

```
dist/
├── fade-[hash].mjs         # 淡入淡出动画 (~0.35 KB)
├── slide-[hash].mjs        # 滑动动画 (~0.58 KB)
├── zoom-[hash].mjs         # 缩放动画 (~0.59 KB)
├── rotate-[hash].mjs       # 旋转动画 (~0.66 KB)
├── flip-[hash].mjs         # 翻转动画 (~0.47 KB)
├── bounce-[hash].mjs       # 弹跳动画 (~0.77 KB)
├── blink-[hash].mjs        # 闪烁动画 (~0.70 KB)
├── shake-[hash].mjs        # 抖动动画 (~1.28 KB)
├── blur-[hash].mjs         # 模糊动画 (~0.58 KB)
├── elastic-[hash].mjs      # 弹性动画 (~1.12 KB)
└── special-[hash].mjs      # 特殊效果动画 (~1.99 KB)
```

## Vite 配置详解

### 插件配置

#### 1. React 插件

```typescript
react()
```

提供 React Fast Refresh 和 JSX 转换支持。

#### 2. TypeScript 类型定义生成 (vite-plugin-dts)

```typescript
dts({
  include: ['src'],
  exclude: ['**/*.test.ts', '**/*.test.tsx'],
  rollupTypes: true, // 将所有类型定义打包到单个文件
})
```

**功能**:
- 自动生成 TypeScript 类型定义文件
- 排除测试文件
- 将所有类型定义合并到 `dist/index.d.ts`

#### 3. Gzip 压缩 (vite-plugin-compression)

```typescript
compression({
  algorithm: 'gzip',
  ext: '.gz',
  threshold: 1024, // 只压缩大于 1KB 的文件
  deleteOriginFile: false,
})
```

**功能**:
- 为所有大于 1KB 的文件生成 gzip 压缩版本
- 保留原始文件
- 减小传输体积，提升加载速度

#### 4. Bundle 分析 (rollup-plugin-visualizer)

```typescript
visualizer({
  open: false, // 不自动打开浏览器
  gzipSize: true,
  brotliSize: true,
  filename: 'stats.html',
})
```

**功能**:
- 生成可视化的 Bundle 分析报告
- 显示 gzip 和 brotli 压缩后的大小
- 帮助识别 Bundle 大小问题

### 构建配置

#### 库模式配置

```typescript
build: {
  lib: {
    entry: 'src/index.ts',
    name: 'CineView',
    formats: ['es', 'umd'],
    fileName: (format) => `cineview.${format}.js`,
  }
}
```

**说明**:
- **entry**: 入口文件
- **name**: UMD 格式的全局变量名
- **formats**: 输出 ES 模块和 UMD 模块
- **fileName**: 输出文件名格式

#### Rollup 配置

```typescript
rollupOptions: {
  external: ['react', 'react-dom', 'framer-motion'],
  output: {
    globals: {
      react: 'React',
      'react-dom': 'ReactDOM',
      'framer-motion': 'FramerMotion',
    },
  },
}
```

**说明**:
- **external**: 外部化依赖，不打包到 bundle 中
- **globals**: UMD 格式的全局变量映射

#### Terser 压缩配置

```typescript
minify: 'terser',
terserOptions: {
  compress: {
    drop_console: true,      // 移除 console
    drop_debugger: true,     // 移除 debugger
    pure_funcs: [            // 移除特定函数调用
      'console.log',
      'console.info',
      'console.debug'
    ],
  },
  format: {
    comments: false,         // 移除注释
  },
}
```

**说明**:
- 生产环境自动移除 console 和 debugger
- 移除所有注释
- 减小 bundle 体积

#### 优化配置

```typescript
sourcemap: false,              // 生产环境不生成 sourcemap
chunkSizeWarningLimit: 500,    // chunk 大小警告阈值 (KB)
```

## 代码分割机制

### 动画预设按需加载

动画预设通过动态 `import()` 实现按需加载：

```typescript
// src/animations/presets/index.ts
export const loadAnimationModule = async (category: string) => {
  switch (category) {
    case 'fade':
      return (await import('./fade')).fadeAnimations;
    case 'slide':
      return (await import('./slide')).slideAnimations;
    // ... 其他分类
  }
};
```

**优势**:
- 减小初始 bundle 大小
- 只加载实际使用的动画
- Vite 自动处理代码分割

### 分类映射

```typescript
const animationCategoryMap: Record<string, string> = {
  'fade': 'fade',
  'fade-in': 'fade',
  'fade-out': 'fade',
  'slide-up': 'slide',
  'slide-down': 'slide',
  // ... 其他映射
};
```

每个动画名称映射到对应的分类，确保相关动画在同一个 chunk 中。

## 构建脚本

### 基础构建

```bash
pnpm run build
```

执行 Vite 构建，生成所有输出文件。

### 构建验证

```bash
pnpm run build:verify
```

执行构建并运行验证脚本，检查：
- ✅ ES 模块和 UMD 模块是否生成
- ✅ Gzip 压缩文件是否生成
- ✅ TypeScript 类型定义是否生成
- ✅ 代码分割 chunks 是否正确
- ✅ Bundle 大小是否符合要求 (< 50KB gzipped)
- ✅ Bundle 分析报告是否生成

### Bundle 分析

```bash
pnpm run analyze
```

执行构建并自动打开 Bundle 分析报告 (`stats.html`)。

## 验证脚本

### 使用方法

```bash
node scripts/verify-build.js
```

### 验证项目

1. **ES 模块**: 检查 `cineview.es.js` 是否存在
2. **ES 模块 (gzipped)**: 检查 `cineview.es.js.gz` 是否存在
3. **UMD 模块**: 检查 `cineview.umd.js` 是否存在
4. **UMD 模块 (gzipped)**: 检查 `cineview.umd.js.gz` 是否存在
5. **TypeScript 类型定义**: 检查 `index.d.ts` 是否存在
6. **代码分割**: 检查动画预设 chunks 是否正确生成
7. **Gzip 压缩**: 检查 gzip 文件是否生成
8. **Bundle 分析报告**: 检查 `stats.html` 是否生成

### 输出示例

```
=== CineView 构建验证 ===

1. 检查 ES 模块输出:
✓ ES 模块: cineview.es.js (101.04 KB)
✓ ES 模块 (gzipped): cineview.es.js.gz (21.61 KB)

2. 检查 UMD 模块输出:
✓ UMD 模块: cineview.umd.js (44.76 KB)
✓ UMD 模块 (gzipped): cineview.umd.js.gz (14.17 KB)

3. 检查 TypeScript 类型定义:
✓ TypeScript 类型定义: index.d.ts (12.27 KB)

4. 检查代码分割 (动画预设):
  找到 11 个代码分割 chunk:
    - fade-C2-2S6uN.mjs (0.35 KB)
    - slide-DP5EKiq-.mjs (0.58 KB)
    - zoom-B9Wgd2OT.mjs (0.59 KB)
    ...

5. 检查 Gzip 压缩文件:
  找到 5 个 gzip 压缩文件

6. 检查 Bundle 分析报告:
  ✓ Bundle 分析报告已生成: stats.html

=== 验证总结 ===

✓ ES 模块
✓ ES 模块 (gzipped)
✓ UMD 模块
✓ UMD 模块 (gzipped)
✓ TypeScript 类型定义
✓ 代码分割
✓ Gzip 压缩
✓ Bundle 分析报告

通过: 8/8

ES 模块 gzip 大小: 21.61 KB (目标: < 50 KB)
UMD 模块 gzip 大小: 14.17 KB (目标: < 50 KB)

✓ 构建验证通过！
```

## 性能指标

### Bundle 大小

| 文件 | 原始大小 | Gzip 大小 | 目标 | 状态 |
|------|---------|----------|------|------|
| ES 模块 | ~101 KB | ~22 KB | < 50 KB | ✅ 通过 |
| UMD 模块 | ~45 KB | ~14 KB | < 50 KB | ✅ 通过 |

### 代码分割效果

- **总 chunks**: 11 个动画预设 chunks
- **平均 chunk 大小**: ~0.8 KB
- **最大 chunk 大小**: ~2 KB (special effects)
- **最小 chunk 大小**: ~0.35 KB (fade)

### 优化效果

- **初始加载**: 仅加载主包 (~22 KB gzipped)
- **按需加载**: 动画预设按需加载 (~0.3-2 KB per chunk)
- **总体积**: 主包 + 所有 chunks < 30 KB (gzipped)

## 发布前检查

在发布前，`prepublishOnly` 脚本会自动执行以下检查：

```bash
pnpm run type-check      # TypeScript 类型检查
pnpm run lint            # ESLint 代码检查
pnpm run test:coverage   # 测试覆盖率检查
pnpm run build:verify    # 构建验证
```

所有检查通过后才能发布到 npm。

## 故障排查

### 问题 1: Bundle 大小超过限制

**症状**: 验证脚本报告 Bundle 大小超过 50 KB

**解决方案**:
1. 运行 `pnpm run analyze` 查看 Bundle 组成
2. 检查是否有不必要的依赖被打包
3. 确认 `external` 配置正确
4. 检查是否有大型库未被外部化

### 问题 2: 代码分割未生效

**症状**: 没有生成动画预设 chunks

**解决方案**:
1. 检查动画预设是否使用动态 `import()`
2. 确认 Vite 配置中没有 `inlineDynamicImports: true`
3. 检查 `loadAnimationModule` 函数是否正确

### 问题 3: TypeScript 类型定义缺失

**症状**: `dist/index.d.ts` 不存在或不完整

**解决方案**:
1. 检查 `vite-plugin-dts` 配置
2. 确认 `tsconfig.json` 配置正确
3. 运行 `pnpm run type-check` 检查类型错误

### 问题 4: Gzip 文件未生成

**症状**: 没有 `.gz` 文件

**解决方案**:
1. 检查 `vite-plugin-compression` 配置
2. 确认文件大小超过 `threshold` (1KB)
3. 检查插件是否正确安装

## 最佳实践

### 1. 定期检查 Bundle 大小

```bash
pnpm run build:verify
```

在每次重大更改后运行验证脚本。

### 2. 使用 Bundle 分析

```bash
pnpm run analyze
```

定期查看 Bundle 组成，识别优化机会。

### 3. 保持依赖最新

```bash
pnpm update
```

定期更新依赖，获取性能改进和 bug 修复。

### 4. 监控构建时间

关注构建时间变化，及时发现性能问题。

### 5. 测试生产构建

```bash
pnpm run build
pnpm run preview
```

在发布前测试生产构建，确保功能正常。

## 相关文件

- `vite.config.ts`: Vite 构建配置
- `scripts/verify-build.js`: 构建验证脚本
- `package.json`: 构建脚本定义
- `tsconfig.json`: TypeScript 配置
- `stats.html`: Bundle 分析报告

## 参考资源

- [Vite 官方文档](https://vitejs.dev/)
- [Rollup 官方文档](https://rollupjs.org/)
- [vite-plugin-dts](https://github.com/qmhc/vite-plugin-dts)
- [vite-plugin-compression](https://github.com/vbenjs/vite-plugin-compression)
- [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer)
