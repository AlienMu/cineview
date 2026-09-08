---
title: 安装
eyebrow: GETTING STARTED / INSTALLATION
---

在使用 React 19 和 Framer Motion 13 的 React 应用中安装 CineView 1.0.0。

## 在 React 应用中安装

```bash
npm install cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

使用 pnpm：

```bash
pnpm add cineview@1.0.0 react@19 react-dom@19 framer-motion@13
```

## 运行本地示例

仓库使用 pnpm 10.22.0，Node.js 版本要求为 `^22.22.1 || >=24.0.0`。

```bash
git clone https://github.com/AlienMu/cineview.git
cd cineview
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

要在其他应用中测试本地修改，先构建 CineView，再在仓库执行 `pnpm pack`，将生成的 `.tgz` 文件安装到目标应用。

## Peer 依赖

以下三个运行时由应用提供：

| 包              | 版本要求  |
| --------------- | --------- |
| `react`         | `^19.0.0` |
| `react-dom`     | `^19.0.0` |
| `framer-motion` | `^13.0.0` |

应用的构建产物中，每个运行时保留一份。

## 三个运行时入口

| 入口              | 内容                       | 模块支持           |
| ----------------- | -------------------------- | ------------------ |
| `cineview`        | 两套引擎，通过 `mode` 选择 | ES 模块与 CommonJS |
| `cineview/drag`   | drag 引擎                  | CommonJS           |
| `cineview/scroll` | scroll 引擎                | CommonJS           |

```tsx
import { CineView, Scene, Animate } from 'cineview';
```

## 完整 ES 模块入口包含两套引擎

Vite、webpack 或 Rollup 应用使用 `cineview`。完整入口引用两套引擎，设置单个 `mode` 不会从构建产物中移除另一套引擎。

## 按模式子路径支持 CommonJS

两个子路径提供 `types` 与 `require` 条件，没有 `import` 条件。TypeScript 可以解析其中的类型，但 ESM 应用无法通过这些子路径导入运行时对象。

```js
const { CineView } = require('cineview/drag');
```

应用已提供 React、React DOM 和 Framer Motion 全局对象时，可通过脚本加载独立的 UMD 文件。这些文件不包含上述运行时。

## 选择入口

| 应用环境              | 入口或文件               |
| --------------------- | ------------------------ |
| ESM 打包器            | `cineview`               |
| CommonJS，仅 drag     | `cineview/drag`          |
| CommonJS，仅 scroll   | `cineview/scroll`        |
| 浏览器脚本，仅 drag   | `cineview-drag.umd.js`   |
| 浏览器脚本，仅 scroll | `cineview-scroll.umd.js` |
| 浏览器脚本，两种模式  | `cineview.umd.js`        |

每个 UMD 文件在单个构建包中包含所选引擎的代码。

## 单模式入口的行为

drag 入口始终使用拖拽模式；JavaScript 调用方传入其他 `mode` 值时会收到错误。scroll 入口始终使用滚动模式，不读取传入的 `mode`。需要在运行时选择模式时，使用完整入口 `cineview`。

## TypeScript 与开发工具

类型定义随包提供。共享类型从 `cineview` 导入，`CineViewDragProps` 和 `CineViewScrollProps` 分别由对应的按模式子路径导出。

按需导入性能面板和样式：

```tsx
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';
```

在 CineView 上启用 `monitor`，将 `callbacks.onReady` 提供的引用传给面板的 `source` 属性。同一入口还导出 `usePerfMonitor`，用于自定义指标展示。可用指标见[性能](/docs/01-performance)。

继续阅读[快速上手](/docs/03-quickstart)。
