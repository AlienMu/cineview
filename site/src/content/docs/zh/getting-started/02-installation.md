---
title: 安装
eyebrow: GETTING STARTED / INSTALLATION
---

本文档对应 `cineview@1.0.1` 的 `Cineview` API。安装下方指定版本即可运行示例。

## 安装 Cineview 及其依赖

```bash
npm install cineview@1.0.1 react@19 react-dom@19 framer-motion@13
```

使用 pnpm：

```bash
pnpm add cineview@1.0.1 react@19 react-dom@19 framer-motion@13
```

1.0.0 导出 `CineView`，API 与本文不同。升级到 1.0.1 时，请按本文档更新导入名称和配置。

应用需要提供 React、React DOM 和 Framer Motion，并与 Cineview 共用它们。重复安装 React 可能导致 Hook 错误。

| 包 | 版本要求 |
| --- | --- |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `framer-motion` | `^13.0.0` |

## 导入组件

从主入口导入组件：

```tsx
import { Animate, AnimateVideo, Cineview, Scene } from 'cineview';
```

主入口支持拖动和滚动模式。接下来可阅读[快速上手](/docs/03-quickstart)，也可运行下方本地示例来修改框架源码。

## 运行仓库示例

开发本仓库使用 pnpm 10.22.0 和 Node.js `^22.22.1 || >=24.0.0`。npm 包声明的 Node.js 最低版本是 18，应用还需满足自身构建工具的要求。

```bash
git clone https://github.com/AlienMu/cineview.git
cd cineview
pnpm install --frozen-lockfile
pnpm build
pnpm --dir examples/minimal install --frozen-lockfile
pnpm --dir examples/minimal dev
```

在其他应用中验证本地修改时，先构建 Cineview，再执行 `pnpm pack`。将生成的 `.tgz` 文件安装到目标应用。

## 其他包入口

主入口支持 ECMAScript 模块（ESM）和 CommonJS，并包含两种模式的代码。设置 `mode` 只决定运行哪种模式，不会从构建产物中移除另一种。

| 应用环境 | 入口或文件 | 包含的模式 |
| --- | --- | --- |
| ES 模块或 CommonJS | `cineview` | drag 与 scroll |
| CommonJS | `cineview/drag` | drag |
| CommonJS | `cineview/scroll` | scroll |
| 浏览器脚本 | `cineview-drag.umd.js` | drag |
| 浏览器脚本 | `cineview-scroll.umd.js` | scroll |
| 浏览器脚本 | `cineview.umd.js` | drag 与 scroll |

CommonJS 应用可以选择单模式入口，减少包含的引擎代码：

```js
const { Cineview } = require('cineview/drag');
```

**两个模式子路径不提供 ES 模块运行时入口。** TypeScript 能解析其类型，但 ESM 应用仍需从 `cineview` 导入运行时对象。

`cineview/drag` 固定使用 drag，传入其他 `mode` 会报错。`cineview/scroll` 固定使用 scroll。需要切换模式的应用使用主入口。

通用模块定义（UMD）文件用于浏览器脚本加载。页面需先提供 React、React DOM 和 Framer Motion 全局对象。

## 类型与性能面板

类型定义随包提供。共享类型从 `cineview` 导入。`CineviewDragProps` 和 `CineviewScrollProps` 分别从对应模式子路径导入。

要采集帧指标，在 Cineview 上设置 `monitor`。要显示性能面板，从 `cineview/dev` 导入 `PerfPanel`，并单独导入样式：

```tsx
import { PerfPanel } from 'cineview/dev';
import 'cineview/dev/style.css';
```

在 `callbacks.onReady` 中接收 Cineview 引用，传给 `<PerfPanel source={ref} />`。scroll 模式的 `debug` 只输出锁定区布局诊断属性，不显示面板。同一入口还提供 `usePerfMonitor`，用于自定义指标展示。完整示例见[性能](/docs/01-performance)。

继续阅读[快速上手](/docs/03-quickstart)。
