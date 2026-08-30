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

CineView 不把 React 和 Framer Motion 打进包里。两者都是 peer dependency，由你的应用提供：

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

全量入口的 `CineView` 是一个派发器：按 `mode` 选择 drag 引擎或 scroll 引擎。派发器**静态引用**两个引擎，所以 tree-shaking 一套也删不掉。哪怕你只写 `mode="scroll"`，打出来的 ESM bundle 里两套引擎都在。

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

| 消费方式                              | 选什么                                             | 代价                             |
| ------------------------------------- | -------------------------------------------------- | -------------------------------- |
| ESM 打包器（Vite / webpack / Rollup） | `cineview` 全量入口                                | 两套引擎都在包里，摇不掉         |
| `<script>` 标签，只用一种模式         | `cineview-drag.umd.js` 或 `cineview-scroll.umd.js` | 无，这是最省的路径               |
| `<script>` 标签，两种模式都要         | `cineview.umd.js`                                  | 单文件无代码拆分，必然含两套引擎 |
| CJS `require`，只用一种模式           | `cineview/drag` 或 `cineview/scroll`               | 无                               |

「UMD 单文件里有两套引擎」不是缺陷，是单文件格式的定义。UMD 与 IIFE 不支持代码拆分，Rollup 遇到就直接报 `UMD and IIFE output formats are not supported for code-splitting builds`。

所以要给单模式消费者减重只有一个办法：单独构建一份产物，也就是 `cineview/drag` 与 `cineview/scroll` 这两个子路径。选对入口没有多余体积，选错则包里多出一套用不到的引擎。

## 单模式产物会拒绝错误的 mode

`cineview/drag`（以及 `cineview-drag.umd.js`）在构造时校验 `mode`。传了 `mode="scroll"` 会**直接抛错**，错误信息指出该加载哪个产物（`src/entry-drag.ts:35-49`）。

这是有意的。这份产物里没有 scroll 引擎，而 drag 引擎内部约 30 处逻辑读 `props.mode` 并在不等于 `'drag'` 时跳过执行。静默按 drag 渲染会让人以为「滚动模式坏了」。script-tag 与 CJS 消费者没有类型保护，只有运行时抛错才真的堵得住。

scroll 侧**不镜像这个检查**。`DirectScrollCineView` 从不读 `props.mode`，它把 `mode: 'scroll'` 写死在自己发出的事件里。传错 `mode` 不会让它失效，所以没有需要防的静默故障（`src/entry-scroll.ts:8-13`）。

## TypeScript 类型

类型定义随包分发，不需要单独的 `@types/*` 包。入口类型（`CineViewDragProps` / `CineViewScrollProps`）从对应子路径导出。这部分在 ESM 侧也能解析，因为 `types` 条件是齐的。

下一步：[快速上手](/docs/03-quickstart)。
