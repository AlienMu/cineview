---
title: 安装
eyebrow: GETTING STARTED / INSTALLATION
---

装好 `cineview` 和它的两个 peer 依赖，选一个入口，就可以开始。

## 包安装

```bash
pnpm add cineview framer-motion
# 或
npm install cineview framer-motion
```

## Peer 依赖

CineView 不将 React 和 Framer Motion 内置于构建包中。两者均为 peer dependencies，由宿主应用提供：

| 包              | 版本要求               |
| --------------- | ---------------------- |
| `react`         | `^18.0.0 \|\| ^19.0.0` |
| `react-dom`     | `^18.0.0 \|\| ^19.0.0` |
| `framer-motion` | `>=10.0.0`             |

应用 bundle 里每个运行时只保留一份，不要把 framer-motion 重复打进 vendor chunk。

## 三个入口

| 入口              | 内容                                                   | 何时用                   |
| ----------------- | ------------------------------------------------------ | ------------------------ |
| `cineview`        | 全量入口，drag + scroll 两套引擎，运行时按 `mode` 派发 | 两种模式都要用，或还没定 |
| `cineview/drag`   | 只含拖拽引擎，导出 `CineViewDragProps`                 | 只用 drag 分页           |
| `cineview/scroll` | 只含滚动引擎，导出 `CineViewScrollProps`               | 只用 scroll 模式         |

```tsx
import { CineView } from 'cineview'; // 全量入口，运行时按 mode 派发
```

## ESM（ES 模块）侧：全量入口带两套引擎

全量入口的 `CineView` 是一个运行时分发器：按 `mode` 调度 drag 引擎或 scroll 引擎。分发器**静态引用**两套引擎实现，因此 tree-shaking 无法单向剔除。即使声明仅使用 `mode="scroll"`，生成的 ESM bundle 中依然包含两套引擎。

这是构建脚本明确接受的代价（`scripts/build-all.mjs:23-28`），不是待修的缺口。ESM 全量在体积预算内，等真有 ESM 消费者反馈体积再拆。想现在就避开这份重量，只有 UMD（浏览器全局脚本）或 CJS（CommonJS）一条路，见「按模式入口只有 require 条件」一节。

## 按模式入口只有 require 条件

`cineview/drag` 与 `cineview/scroll` 在 `package.json` 的 `exports` 里只声明了 `types` 与 `require` 两个条件，**没有 `import` 条件**（`package.json:14-21`）。

后果是不对称的。TypeScript 能解析这两个子路径的类型（`types` 条件在），编辑器补全正常、`tsc` 不报错。ESM 打包器按 `import` 条件查找，查不到就报解析失败。所以 `import { CineView } from 'cineview/drag'` 在 Vite / webpack 的 ESM 图里**过不了构建**，尽管类型层看着完全正常。

这两个子路径的存在理由只有一个：UMD 单文件不能代码拆分。它们服务的是 `<script>` 引入和 CJS 环境：

```html
<script src="cineview-drag.umd.js"></script>
```

```js
const { CineView } = require('cineview/drag');
```

## 入口选择的权衡

| 消费方式                              | 选什么                                             | 代价                               |
| ------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| ESM 打包器（Vite / webpack / Rollup） | `cineview` 全量入口                                | 包含双模式引擎代码，运行时按需分发 |
| `<script>` 标签，只用一种模式         | `cineview-drag.umd.js` 或 `cineview-scroll.umd.js` | 仅加载目标引擎，体积最轻量         |
| `<script>` 标签，两种模式都要         | `cineview.umd.js`                                  | 单文件完整分发包，包含双模式引擎   |
| CJS `require`，只用一种模式           | `cineview/drag` 或 `cineview/scroll`               | 无                                 |

受分发格式约束，单文件 UMD/IIFE 无法支持动态代码拆分。为向浏览器 `<script>` 标签及单模式消费者提供轻量化体验，CineView 针对 drag 与 scroll 提供了独立的 UMD 构建分发文件。

## 模式参数校验

`cineview/drag`（以及 `cineview-drag.umd.js`）在初始化时会校验 `mode` 参数。若传入 `mode="scroll"`，引擎将抛出明确的异常，提示切换至对应的滚动模式包（`src/entry-drag.ts:35-49`）。

`DirectScrollCineView` 原生运行于滚动模式，并在内部事件中固定注入 `mode: 'scroll'` 常量，无需额外的模式校验守卫（`src/entry-scroll.ts:8-13`）。

## TypeScript 类型

类型定义随包分发，无需额外安装 `@types/*`。入口类型（`CineViewDragProps` / `CineViewScrollProps`）可从对应的子路径导入。

下一步：[快速上手](/docs/03-quickstart)。
