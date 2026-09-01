# CineView

[English README](./README.md)

CineView 是一个用于全屏叙事型界面的 React 框架。它提供两种导航模式、按场景划分的动画时间线、认宽的响应式坐标换算、图片预加载，以及限定在所属场景内的 fixed layer。

## 包状态

`cineview@1.0.0` 尚未发布到 npm。仓库中的示例使用本地 `dist` 产物。发布前请完成[发布清单](./task-flows/2026-08-31-comprehensive-audit-remediation.md)。

从仓库运行示例：

```bash
pnpm install
pnpm build
pnpm --dir examples/minimal install
pnpm --dir examples/minimal dev
```

包发布后，安装命令为：

```bash
pnpm add cineview framer-motion react react-dom
```

React、React DOM 和 Framer Motion 是 peer 依赖，CineView 不会把它们打进包里。

## 选择模式

同一套组件结构可以使用两种导航模式：

| 模式     | 行为                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| `drag`   | 一次指针手势在场景之间移动。释放阈值决定切换提交，或回到当前场景。                                |
| `scroll` | 文档按正常方式滚动。声明 `scroll` zone 的 `Scene` 变为 center-lock 区间，其余场景保持普通文档流。 |

## 快速开始

```tsx
import { Animate, CineView, Scene } from 'cineview';

export default function App() {
  return (
    <CineView designWidth={750} mode="scroll">
      <Scene sceneId="hero" scroll={{ zoneId: 'hero', trigger: 'center-lock' }}>
        <Animate animateId="title" enterAnimation="fade-in" duration={{ enter: 800 }}>
          <h1>Opening frame</h1>
        </Animate>
      </Scene>
    </CineView>
  );
}
```

默认模式是 `drag`。删除 `scroll` 配置即可使用手势翻页。完整可运行示例见[`examples/minimal`](./examples/minimal)。

## 核心组件

| 组件           | 用途                                                                |
| -------------- | ------------------------------------------------------------------- |
| `CineView`     | 选择模式，提供响应式换算基准，调度预加载，并暴露命令式 ref。        |
| `Scene`        | 定义章节边界、场景布局、可见性回调和可选的 scroll zone。            |
| `Animate`      | 使用预设或自定义动画，并配置 `timeline`、`duration`、`visibility`。 |
| `Position`     | 按设计稿坐标定位节点，或挂载场景范围内的 fixed layer。              |
| `Container`    | 将盒模型长度从设计像素换算到视口尺寸。                              |
| `Image`        | 通过共享预加载缓存加载图片。                                        |
| `AnimateVideo` | 将场景或滚动进度映射到视频的 `currentTime`。                        |

`designWidth` 默认值为 `750`。Position 坐标和盒模型长度使用 `viewportWidth / designWidth` 换算，比例只随宽度变化，不按视口高度缩放。

## 包入口

主 ESM 入口是 `cineview`，包含两套引擎。`cineview/drag` 和 `cineview/scroll` 子路径目前只提供 `types` 和 CommonJS `require` 条件。请在 `require()` 或对应的 UMD 文件中使用，不要写成 ESM `import`。

```js
const { CineView } = require('cineview/drag');
```

包还提供 `cineview.umd.js`、`cineview-drag.umd.js` 和 `cineview-scroll.umd.js`，可通过浏览器 script 标签加载。

## 无障碍和输入

框架会保留宿主应用中的原生链接、按钮、表单控件和可编辑字段。drag 模式目前没有内置的键盘切换场景功能，也没有框架级 reduced-motion 开关。应用仍需提供键盘操作、可访问名称和 reduced-motion 策略。非活动场景不会自动添加 `aria-hidden` 或 `inert`。

连续数值通过 `useAnimateTimeline()` 读取，并将返回的 MotionValue 绑定到样式。不要把每帧 progress 写入 React state。scroll zone 中，声明时长的 1 毫秒对应真实滚动距离的 1 像素。

## 验证状态

以下数据是本地基线，发布前必须重新运行命令生成：

| 检查项          | 基线         |
| --------------- | ------------ |
| 框架测试        | 1,533 项通过 |
| 行覆盖率        | 96.57%       |
| 函数覆盖率      | 95.64%       |
| 分支覆盖率      | 90.57%       |
| 类型检查和 lint | 通过         |
| 构建验证        | 14/14        |

运行静态检查：

```bash
pnpm verify:framework:static
pnpm type-check:site
pnpm test:site-contracts
pnpm --dir site build
```

单元测试不能代替浏览器验收。真实浏览器中需要验证 drag 和 scroll 的正反向移动、键盘与 scrollbar 输入、大位移输入，以及多动画同时运行的情况。

## 文档

文档站位于[`site`](./site)，包含入门、概念、组件参考、模式行为和排错页面。中英文页面使用相同的目录与 URL 结构。

## 贡献代码

修改代码或文档前先阅读[`AGENTS.md`](./AGENTS.md)。其中记录当前规格、任务流要求、验证命令和文档规则。Pull request 流程见[`CONTRIBUTING.md`](./CONTRIBUTING.md)。

## 许可证

MIT，详见[`package.json`](./package.json)。
